/**
 * Plan Upgrade Service — Shared transactional logic for applying plan upgrades.
 *
 * Used by:
 * - POST /api/payments/webhook  (Razorpay webhook)
 * - POST /api/payments/verify   (synchronous verification fallback)
 * - POST /api/user/upgrade      (manual upgrade endpoint)
 *
 * Consolidates the duplicated upgrade logic into a single place.
 */

import { PLAN_CONFIGS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { adminDb } from "@/lib/firebase/admin";
import { createTransaction } from "./transactions";

export interface PlanUpgradeResult {
    plan: PlanType;
    planStatus: string;
    planStart: number;
    planExpiry: number | null;
    planRenewals: number;
    planEraStart?: number;
    cumulativeQuota: number;
    updatedAt: number;
}

/**
 * Apply a plan upgrade or renewal inside a Firestore transaction.
 * Also logs the transaction history.
 *
 * @param planId      The target plan to upgrade to
 * @param userId      The user's ID
 * @param orderId     The Razorpay order ID (optional for manual downgrades)
 * @param paymentId   The Razorpay payment ID (optional)
 * @param t           An existing Firestore Transaction (optional)
 */
export async function applyPlanUpgrade(
    planId: PlanType,
    userId: string,
    orderId?: string,
    paymentId?: string,
    t?: FirebaseFirestore.Transaction
): Promise<PlanUpgradeResult> {
    const now = Date.now();
    
    // Execute logic within provided transaction or create a new one
    const executeLogic = async (transaction: FirebaseFirestore.Transaction) => {
        // --- ALL READS MUST HAPPEN BEFORE ANY WRITES ---
        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        const existingUser = userSnap.exists ? userSnap.data() ?? null : null;

        let orderRef: FirebaseFirestore.DocumentReference | null = null;
        let orderSnap: FirebaseFirestore.DocumentSnapshot | null = null;

        if (orderId && planId !== "free") {
            orderRef = adminDb.collection("orders").doc(orderId);
            orderSnap = await transaction.get(orderRef);

            if (orderSnap.exists) {
                const orderData = orderSnap.data()!;
                if (orderData.status === "consumed") {
                    // Idempotent return: The order is already consumed. Avoid double upgrade.
                    return {
                        plan: existingUser?.plan || "free",
                        planStatus: existingUser?.planStatus || "active",
                        planStart: existingUser?.planStart || now,
                        planExpiry: existingUser?.planExpiry || null,
                        planRenewals: existingUser?.planRenewals || 1,
                        cumulativeQuota: existingUser?.cumulativeQuota || 0,
                        updatedAt: existingUser?.updatedAt || now
                    } as PlanUpgradeResult;
                }
            }
        }

        // --- COMPUTATIONS ---
        // Detect renewal (same plan while still active) vs upgrade/new plan
        const isRenewal =
            planId !== "free" &&
            existingUser?.plan === planId &&
            existingUser?.planStatus === "active" &&
            (!existingUser?.planExpiry || existingUser?.planExpiry > now);

        // Legacy fallback: Initialize cumulativeQuota based on past renewals if it doesn't exist yet
        let currentCumulativeQuota = existingUser?.cumulativeQuota || 0;
        if (!existingUser?.cumulativeQuota && existingUser?.plan && existingUser.plan !== "free") {
            const legacyPlanConfig = PLAN_CONFIGS[existingUser.plan as PlanType];
            if (legacyPlanConfig) {
                currentCumulativeQuota = legacyPlanConfig.limit * (existingUser.planRenewals || 1);
            }
        }

        const newPlanConfig = PLAN_CONFIGS[planId];

        const result: PlanUpgradeResult = {
            plan: planId,
            planStatus: "active",
            planStart: now,
            planExpiry: planId === "free" ? null : now + 30 * 24 * 60 * 60 * 1000, // +30 days
            planRenewals: 1,
            // Add the new plan's limit to the user's permanent cumulative quota
            cumulativeQuota: planId === "free" ? currentCumulativeQuota : currentCumulativeQuota + newPlanConfig.limit,
            updatedAt: now,
        };

        if (isRenewal) {
            // Keep tracking renewals for analytics/display
            result.planRenewals = (existingUser?.planRenewals || 1) + 1;
        } else {
            result.planRenewals = 1;
            result.planEraStart = now;
        }

        if (planId === "free") {
            result.planRenewals = 1;
            result.planEraStart = now;
        }

        // --- ALL WRITES MUST HAPPEN AFTER ALL READS ---
        
        // Apply user updates
        transaction.set(userRef, result, { merge: true });

        // Update order status if orderId is provided
        if (orderRef) {
            if (orderSnap && orderSnap.exists) {
                transaction.update(orderRef, { status: "consumed", consumedAt: now, updatedAt: now });
            } else {
                transaction.set(orderRef, {
                    orderId,
                    userId,
                    planId,
                    status: "consumed",
                    consumedAt: now,
                    createdAt: now,
                    updatedAt: now
                });
            }
        }

        // Log transaction history
        let action: "upgrade" | "renew" | "downgrade" = "upgrade";
        if (isRenewal) action = "renew";
        if (planId === "free" && existingUser?.plan !== "free") action = "downgrade";

        await createTransaction({
            userId,
            planType: planId,
            action,
            linksAllocated: planId === "free" ? 0 : newPlanConfig.limit,
            orderId,
            paymentId
        }, transaction);

        return result;
    };

    if (t) {
        return await executeLogic(t);
    } else {
        return await adminDb.runTransaction(executeLogic);
    }
}

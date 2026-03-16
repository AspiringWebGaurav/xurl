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
import { createTransaction, type TransactionSource } from "./transactions";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { logger } from "@/lib/utils/logger";
import { encryptApiKey, generateApiKey, hashApiKey } from "@/lib/api/crypto";
import type { OrderDocument, PromoCodeDocument, PromoRedemptionDocument } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

export interface PlanUpgradeResult {
    plan: PlanType;
    planStatus: string;
    planStart: number;
    planExpiry: number | null;
    planRenewals: number;
    planEraStart?: number;
    cumulativeQuota: number;
    apiEnabled?: boolean;
    apiQuotaTotal?: number;
    apiRequestsUsed?: number;
    apiKeyHash?: string | null;
    apiKeyEncrypted?: string | null;
    apiKeyLastRotatedAt?: number | null;
    updatedAt: number;
}

export interface PlanUpgradeOptions {
    /**
     * Optional override for how long the plan should be active.
     * If provided, planExpiry will be now + overrideExpiryMs instead of the default 30 days.
     */
    overrideExpiryMs?: number | null;
    /**
     * Optional source for the transaction log (e.g. "razorpay", "developer_mode", "admin_grant").
     */
    source?: TransactionSource;
    /**
     * Optional amount in paise for the transaction history entry.
     * For non-monetary upgrades (admin grants, dev-mode), this should usually be 0.
     */
    amountPaise?: number;
    /**
     * Optional human-readable reason to store alongside the transaction.
     */
    reason?: string;
    recipientEmail?: string | null;
    adminEmail?: string | null;
    grantType?: "plan" | "link_gift";
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
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
 * @param options     Optional overrides for expiry, transaction source, and amount
 */
export async function applyPlanUpgrade(
    planId: PlanType,
    userId: string,
    orderId?: string,
    paymentId?: string,
    t?: FirebaseFirestore.Transaction,
    options?: PlanUpgradeOptions
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
        let orderData: OrderDocument | null = null;
        let promoRef: FirebaseFirestore.DocumentReference | null = null;
        let promoSnap: FirebaseFirestore.DocumentSnapshot | null = null;

        if (orderId && planId !== "free") {
            orderRef = adminDb.collection("orders").doc(orderId);
            orderSnap = await transaction.get(orderRef);

            if (orderSnap.exists) {
                orderData = orderSnap.data() as OrderDocument;
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

                if (orderData.promoCodeId) {
                    promoRef = adminDb.collection("promo_codes").doc(orderData.promoCodeId);
                    promoSnap = await transaction.get(promoRef);
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
        const apiAccessEnabled = Boolean(newPlanConfig.apiAccess);
        const apiQuotaTotal = apiAccessEnabled ? (newPlanConfig.apiQuotaTotal || 0) : 0;
        let apiKeyHash = existingUser?.apiKeyHash || null;
        let apiKeyEncrypted = existingUser?.apiKeyEncrypted || null;
        let apiKeyLastRotatedAt = existingUser?.apiKeyLastRotatedAt || null;

        if (apiAccessEnabled && (!apiKeyHash || !apiKeyEncrypted)) {
            const apiKey = generateApiKey();
            apiKeyHash = hashApiKey(apiKey);
            apiKeyEncrypted = encryptApiKey(apiKey);
            apiKeyLastRotatedAt = now;
        }

        const defaultExpiry =
            planId === "free"
                ? null
                : now + 30 * 24 * 60 * 60 * 1000; // +30 days

        const effectiveExpiry =
            planId === "free"
                ? null
                : options?.overrideExpiryMs === undefined
                    ? defaultExpiry
                    : options.overrideExpiryMs === null
                        ? null
                        : now + options.overrideExpiryMs;

        const result: PlanUpgradeResult = {
            plan: planId,
            planStatus: "active",
            planStart: now,
            planExpiry: effectiveExpiry,
            planRenewals: 1,
            // Add the new plan's limit to the user's permanent cumulative quota
            cumulativeQuota: planId === "free" ? currentCumulativeQuota : currentCumulativeQuota + newPlanConfig.limit,
            apiEnabled: apiAccessEnabled,
            apiQuotaTotal,
            apiRequestsUsed: 0,
            apiKeyHash,
            apiKeyEncrypted,
            apiKeyLastRotatedAt,
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

        if (promoRef) {
            const currentPromoUsage = promoSnap?.exists ? ((promoSnap.data() as PromoCodeDocument).usageCount || 0) : 0;
            transaction.set(
                promoRef,
                {
                    usageCount: currentPromoUsage + 1,
                    lastUsedAt: now,
                    updatedAt: now,
                    redemptionCount: FieldValue.increment(1),
                },
                { merge: true }
            );

            const promoData = promoSnap?.exists ? (promoSnap.data() as PromoCodeDocument) : null;
            const redemptionRef = adminDb.collection("promo_redemptions").doc();
            const redemption: PromoRedemptionDocument = {
                promoCodeId: promoRef.id,
                promoCode: promoData?.code || orderData?.promoCode || "",
                userId,
                planId,
                orderId: orderId || null,
                discountType: promoData?.discountType || (orderData?.promoDiscountType as any) || "fixed",
                discountValue: promoData?.discountValue ?? (orderData?.promoDiscountValue || 0),
                redeemedAt: now,
            };
            transaction.set(redemptionRef, redemption);
        }

        // Log transaction history
        let action: "upgrade" | "renew" | "downgrade" | "admin_grant" = "upgrade";
        if (options?.source === "admin_grant") {
            action = "admin_grant";
        } else {
            if (isRenewal) action = "renew";
            if (planId === "free" && existingUser?.plan !== "free") action = "downgrade";
        }

        await createTransaction(
            {
                userId,
                planType: planId,
                action,
                linksAllocated: planId === "free" ? 0 : newPlanConfig.limit,
                orderId,
                paymentId,
                source: options?.source,
                amount: options?.amountPaise,
                reason: options?.reason,
                recipientEmail: options?.recipientEmail ?? existingUser?.email ?? null,
                adminEmail: options?.adminEmail ?? null,
                grantType: options?.grantType,
                durationOption: options?.durationOption,
                customValue: options?.customValue,
                customUnit: options?.customUnit,
                overrideExpiryMs: options?.overrideExpiryMs ?? null,
                previousPlan: existingUser?.plan ?? null,
                previousPlanStatus: existingUser?.planStatus ?? null,
                previousPlanStart: existingUser?.planStart ?? null,
                previousPlanExpiry: existingUser?.planExpiry ?? null,
                previousPlanRenewals: existingUser?.planRenewals ?? null,
                previousPlanEraStart: existingUser?.planEraStart ?? null,
                previousCumulativeQuota: existingUser?.cumulativeQuota ?? null,
                previousApiEnabled: existingUser?.apiEnabled ?? null,
                previousApiQuotaTotal: existingUser?.apiQuotaTotal ?? null,
                previousApiRequestsUsed: existingUser?.apiRequestsUsed ?? null,
                previousApiKeyHash: existingUser?.apiKeyHash ?? null,
                previousApiKeyEncrypted: existingUser?.apiKeyEncrypted ?? null,
                previousApiKeyLastRotatedAt: existingUser?.apiKeyLastRotatedAt ?? null,
            },
            transaction
        );

        return result;
    };

    let result: PlanUpgradeResult;
    if (t) {
        result = await executeLogic(t);
    } else {
        result = await adminDb.runTransaction(executeLogic);
    }

    const eventType = options?.source === "admin_grant" ? "ADMIN_GRANTED_PLAN" : "PLAN_PURCHASED";
    try {
        await writeActivityEvent({
            type: eventType,
            actor: userId,
            sourceCollection: "orders",
            metadata: {
                planId,
                source: options?.source ?? null,
                orderId: orderId ?? null,
                amountPaise: options?.amountPaise ?? null,
                reason: options?.reason ?? null,
                recipientEmail: options?.recipientEmail ?? null,
                adminEmail: options?.adminEmail ?? null,
                grantType: options?.grantType ?? null,
                durationOption: options?.durationOption ?? null,
                customValue: options?.customValue ?? null,
                customUnit: options?.customUnit ?? null,
            },
            severity: options?.source === "admin_grant" ? "ADMIN" : "BILLING",
        });
    } catch (error) {
        logger.error("activity_event_write", `Failed to write ${eventType} event`, {
            userId,
            planId,
            source: options?.source ?? null,
            error: String(error),
        });
    }

    return result;
}

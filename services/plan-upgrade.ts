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
import { createNotificationForUser } from "@/services/notifications";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { logger } from "@/lib/utils/logger";
import { encryptApiKey, generateApiKey, hashApiKey } from "@/lib/api/crypto";
import type { OrderDocument, PromoCodeDocument, PromoRedemptionDocument } from "@/types";
import { FieldValue } from "firebase-admin/firestore";
import type { PartialOffer } from "./partial-offers";

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
    transactionId?: string | null;
    isCurated?: boolean;
    planSource?: string;
    promoInfo?: {
        code: string;
        discountType: string;
        discountValue: number;
    } | null;
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
     * Optional currency code (defaults to "INR").
     */
    currency?: string;
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

        // Check if there is an associated curated custom proposal for links & API quota
        let customLinkLimit: number | null = null;
        let customApiQuota: number | null = null;
        let customReqRef: FirebaseFirestore.DocumentReference | null = null;
        let customReqExistingConsumedCount = 0;
        let offerRefToConsume: FirebaseFirestore.DocumentReference | null = null;
        let offerDataToConsume: PartialOffer | null = null;

        if (orderData?.promoCodeId) {
            try {
                const offerRef = adminDb.collection("partial_offers").doc(orderData.promoCodeId);
                const offerSnap = await transaction.get(offerRef);
                if (offerSnap.exists) {
                    const offerData = offerSnap.data() as PartialOffer;
                    offerRefToConsume = offerRef;
                    offerDataToConsume = offerData;
                    if (offerData.discountType === "custom_price") {
                        if (offerData.customLinks) customLinkLimit = Number(offerData.customLinks);
                        if (offerData.customApiQuota) customApiQuota = Number(offerData.customApiQuota);
                    }
                }
            } catch {
                // Ignore read error in transaction
            }
        }

        // Always check custom pricing request by offer ID or user email
        const userEmail = (existingUser?.email || options?.recipientEmail || "").trim().toLowerCase();
        if (userEmail) {
            try {
                let customReqQuery = orderData?.promoCodeId
                    ? adminDb.collection("custom_pricing_requests").where("curatedOfferId", "==", orderData.promoCodeId).limit(1)
                    : null;
                let customReqSnap = customReqQuery ? await transaction.get(customReqQuery) : null;
                
                if (!customReqSnap || customReqSnap.empty) {
                    customReqQuery = adminDb.collection("custom_pricing_requests")
                        .where("email", "==", userEmail)
                        .where("status", "==", "curated")
                        .limit(1);
                    customReqSnap = await transaction.get(customReqQuery);
                }

                if (customReqSnap && !customReqSnap.empty) {
                    const reqDoc = customReqSnap.docs[0];
                    const reqData = reqDoc.data();
                    if (!customLinkLimit) {
                        customLinkLimit = Number(reqData.curatedLinks) || Number(reqData.linksNeeded) || null;
                    }
                    if (!customApiQuota) {
                        customApiQuota = Number(reqData.curatedApiQuota) || Number(reqData.apiQuotaNeeded) || null;
                    }
                    customReqRef = reqDoc.ref;
                    customReqExistingConsumedCount = Number(reqData.consumedCount) || 0;
                }
            } catch {
                // Ignore query error in transaction
            }
        }

        // --- COMPUTATIONS ---
        // Detect renewal (same plan while still active) vs upgrade/new plan
        const isRenewal =
            planId !== "free" &&
            existingUser?.plan === planId &&
            existingUser?.planStatus === "active" &&
            (!existingUser?.planExpiry || existingUser?.planExpiry > now);

        // Model 2: Lifetime Link Credit Bank
        // Cumulative quota accumulates on any paid plan purchase or renewal.
        let currentCumulativeQuota = existingUser?.cumulativeQuota || 0;
        if (!existingUser?.cumulativeQuota && existingUser?.plan && existingUser.plan !== "free") {
            const legacyPlanConfig = PLAN_CONFIGS[existingUser.plan as PlanType];
            if (legacyPlanConfig) {
                currentCumulativeQuota = legacyPlanConfig.limit * (existingUser.planRenewals || 1);
            }
        }

        const newPlanConfig = PLAN_CONFIGS[planId];
        const allocatedLinks = customLinkLimit ?? newPlanConfig.limit;
        const newCumulativeQuota = planId === "free" ? 0 : currentCumulativeQuota + allocatedLinks;
        const apiAccessEnabled = Boolean(newPlanConfig.apiAccess) || Boolean(customApiQuota);
        const apiQuotaTotal = customApiQuota ?? (apiAccessEnabled ? (newPlanConfig.apiQuotaTotal || 0) : 0);
        let apiKeyHash = existingUser?.apiKeyHash || null;
        let apiKeyEncrypted = existingUser?.apiKeyEncrypted || null;
        let apiKeyLastRotatedAt = existingUser?.apiKeyLastRotatedAt || null;

        if (apiAccessEnabled && (!apiKeyHash || !apiKeyEncrypted)) {
            const apiKey = generateApiKey();
            apiKeyHash = hashApiKey(apiKey);
            apiKeyEncrypted = encryptApiKey(apiKey);
            apiKeyLastRotatedAt = now;
        }

        let baseExpiryTime = now;
        if (isRenewal && existingUser?.planExpiry) {
            baseExpiryTime = Math.max(now, existingUser.planExpiry);
        }

        let defaultExpiry: number | null = null;
        if (planId !== "free") {
            if (isRenewal && existingUser?.planExpiry === null) {
                // Keep permanent plan permanent on renewal/promo
                defaultExpiry = null;
            } else {
                defaultExpiry = baseExpiryTime + 30 * 24 * 60 * 60 * 1000; // +30 days
            }
        }

        const effectiveExpiry =
            planId === "free"
                ? null
                : options?.overrideExpiryMs === undefined
                    ? defaultExpiry
                    : options.overrideExpiryMs === null
                        ? null
                        : baseExpiryTime + options.overrideExpiryMs;

        const result: PlanUpgradeResult = {
            plan: planId,
            planStatus: "active",
            planStart: now,
            planExpiry: effectiveExpiry,
            planRenewals: 1,
            // Model 2: Link quota is banked permanently into cumulativeQuota
            cumulativeQuota: newCumulativeQuota,
            apiEnabled: apiAccessEnabled,
            apiQuotaTotal,
            apiRequestsUsed: 0,
            apiKeyHash,
            apiKeyEncrypted,
            apiKeyLastRotatedAt,
            updatedAt: now,
            transactionId: null,
            promoInfo: null,
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

        const isCuratedUpgrade = Boolean(
            planId === "vip" ||
            customReqRef ||
            offerDataToConsume?.discountType === "custom_price" ||
            (orderData?.promoDiscountType as string) === "custom_price" ||
            options?.source === "admin_grant" ||
            options?.source === "partial_offer"
        );

        if (isCuratedUpgrade) {
            result.plan = "vip";
            result.isCurated = true;
            result.planSource = options?.source || "admin_curated";
        }

        // Apply user updates
        transaction.set(userRef, result, { merge: true });

        // If a curated proposal was redeemed, mark it as consumed in Firestore & track consumption count
        if (customReqRef) {
            transaction.update(customReqRef, {
                status: "consumed",
                consumedAt: now,
                consumedOrderId: orderId || null,
                consumedCount: customReqExistingConsumedCount + 1,
                usageLimit: 1,
                updatedAt: now,
            });
        }

        // Also consume the partial offer if single use
        if (offerRefToConsume && offerDataToConsume) {
            const nextRedemptions = (offerDataToConsume.redemptionCount || 0) + 1;
            const limit = offerDataToConsume.usageLimit ?? 1;
            const isExhausted = nextRedemptions >= limit;
            transaction.update(offerRefToConsume, {
                redemptionCount: nextRedemptions,
                isActive: isExhausted ? false : offerDataToConsume.isActive,
                status: isExhausted ? "consumed" : "active",
                consumedAt: isExhausted ? now : null,
                updatedAt: now,
            });
        }

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

        let promoInfo: PlanUpgradeResult["promoInfo"] = null;
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
                discountType: promoData?.discountType || (orderData?.promoDiscountType as "percentage" | "fixed" | "free_plan") || "fixed",
                discountValue: promoData?.discountValue ?? (orderData?.promoDiscountValue || 0),
                redeemedAt: now,
            };
            transaction.set(redemptionRef, redemption);
            promoInfo = {
                code: redemption.promoCode,
                discountType: String(redemption.discountType),
                discountValue: Number(redemption.discountValue || 0),
            };
        }

        // Log transaction history
        let action: "upgrade" | "renew" | "downgrade" | "admin_grant" = "upgrade";
        if (options?.source === "admin_grant") {
            action = "admin_grant";
        } else {
            if (isRenewal) action = "renew";
            if (planId === "free" && existingUser?.plan !== "free") action = "downgrade";
        }

        const transactionId = await createTransaction(
            {
                userId,
                planType: planId,
                action,
                linksAllocated: planId === "free" ? 0 : allocatedLinks,
                orderId,
                paymentId,
                source: options?.source,
                amount: options?.amountPaise,
                currency: options?.currency || "INR",
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

        result.transactionId = transactionId;
        result.promoInfo = promoInfo;

        return result;
    };

    let result: PlanUpgradeResult;
    if (t) {
        result = await executeLogic(t);
    } else {
        result = await adminDb.runTransaction(executeLogic);
    }

    if (result.promoInfo && result.transactionId) {
        const actionUrl = `/dashboard/purchase-history?highlight=${result.transactionId}`;
        await createNotificationForUser({
            userId,
            type: "PROMO",
            title: "Promo redeemed",
            message: `Promo ${result.promoInfo.code} was applied to your purchase.`,
            data: {
                promoCode: result.promoInfo.code,
                discountType: result.promoInfo.discountType,
                discountValue: result.promoInfo.discountValue,
                transactionId: result.transactionId,
            },
            action: {
                type: "REDIRECT",
                url: actionUrl,
                label: "View Gift",
            },
        });
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

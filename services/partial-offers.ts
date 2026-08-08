import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

export const DiscountTypeSchema = z.enum(["percentage", "flat", "custom_price"]);
export type PartialOfferDiscountType = z.infer<typeof DiscountTypeSchema>;

export const PartialOfferSchema = z.object({
    id: z.string().optional(),
    targetEmail: z.string().email(),
    title: z.string().min(1, "Title is required"),
    description: z.string().default(""),
    discountType: DiscountTypeSchema,
    discountValue: z.number().min(0),
    plans: z.array(z.string()).min(1, "Select at least one plan"),
    billingCycle: z.enum(["all", "monthly", "annual"]).default("all"),
    startsAt: z.number().nullable().default(null),
    expiresAt: z.number().nullable().default(null),
    usageLimit: z.number().nullable().default(null),
    redemptionCount: z.number().default(0),
    perUserLimit: z.number().nullable().default(1),
    priority: z.number().default(10),
    isActive: z.boolean().default(true),
    isRevoked: z.boolean().default(false),
    revokedAt: z.number().nullable().default(null),
    notes: z.string().default(""),
    createdBy: z.string().default("system"),
    createdAt: z.number().default(() => Date.now()),
    updatedAt: z.number().default(() => Date.now()),
});

export type PartialOffer = z.infer<typeof PartialOfferSchema>;

/**
 * Log partial offer audit events to Firestore collections (admin_logs and admin_activity).
 */
export async function logPartialOfferAudit(params: {
    action: "OFFER_CREATED" | "OFFER_UPDATED" | "OFFER_DISABLED" | "OFFER_ENABLED" | "OFFER_DELETED" | "OFFER_REDEEMED" | "OFFER_EXPIRED" | "OFFER_REVOKED";
    offerId: string;
    targetEmail: string;
    adminEmail: string | null;
    details: string;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
}) {
    const now = Date.now();
    try {
        const batch = adminDb.batch();

        const logRef = adminDb.collection("admin_logs").doc();
        batch.set(logRef, {
            adminEmail: params.adminEmail || "system",
            action: params.action,
            details: params.details,
            targetEmail: params.targetEmail,
            offerId: params.offerId,
            previousValue: params.previousValue || null,
            newValue: params.newValue || null,
            createdAt: now,
        });

        const activityRef = adminDb.collection("admin_activity").doc();
        batch.set(activityRef, {
            type: "promo_created", // maps nicely to activity widget
            message: `${params.action.replace("_", " ")} for ${params.targetEmail}: ${params.details}`,
            timestamp: now,
            details: {
                action: params.action,
                offerId: params.offerId,
                targetEmail: params.targetEmail,
                adminEmail: params.adminEmail,
            },
        });

        await batch.commit();
    } catch (err) {
        logger.error("partial_offers_audit", "Failed to write partial offer audit log", { error: String(err) });
    }
}

/**
 * Creates a new targeted partial offer.
 */
export async function createPartialOffer(data: Omit<PartialOffer, "id" | "createdAt" | "updatedAt" | "redemptionCount">, adminEmail: string): Promise<PartialOffer> {
    const parsed = PartialOfferSchema.parse({
        ...data,
        targetEmail: data.targetEmail.trim().toLowerCase(),
        createdBy: adminEmail,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        redemptionCount: 0,
    });

    const docRef = adminDb.collection("partial_offers").doc();
    const finalOffer: PartialOffer = { ...parsed, id: docRef.id };

    await docRef.set(finalOffer);

    await logPartialOfferAudit({
        action: "OFFER_CREATED",
        offerId: docRef.id,
        targetEmail: finalOffer.targetEmail,
        adminEmail,
        details: `Created partial offer "${finalOffer.title}" (${finalOffer.discountType} ${finalOffer.discountValue})`,
        newValue: finalOffer as Record<string, unknown>,
    });

    return finalOffer;
}

/**
 * Gets all partial offers for admin console with optional email filter.
 */
export async function getAllPartialOffers(targetEmail?: string): Promise<PartialOffer[]> {
    let q: FirebaseFirestore.Query = adminDb.collection("partial_offers").orderBy("createdAt", "desc");
    if (targetEmail) {
        q = adminDb.collection("partial_offers").where("targetEmail", "==", targetEmail.trim().toLowerCase());
    }

    const snap = await q.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PartialOffer));
}

/**
 * Updates an existing partial offer.
 */
export async function updatePartialOffer(
    id: string,
    updates: Partial<PartialOffer>,
    adminEmail: string
): Promise<PartialOffer> {
    const docRef = adminDb.collection("partial_offers").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new Error("Partial offer not found");
    }

    const prevData = snap.data() as PartialOffer;
    const merged = {
        ...prevData,
        ...updates,
        updatedAt: Date.now(),
    };

    if (updates.targetEmail) {
        merged.targetEmail = updates.targetEmail.trim().toLowerCase();
    }

    const validated = PartialOfferSchema.parse(merged);
    await docRef.update(validated);

    await logPartialOfferAudit({
        action: "OFFER_UPDATED",
        offerId: id,
        targetEmail: validated.targetEmail,
        adminEmail,
        details: `Updated partial offer "${validated.title}"`,
        previousValue: prevData as Record<string, unknown>,
        newValue: validated as Record<string, unknown>,
    });

    return { ...validated, id };
}

/**
 * Deletes a partial offer.
 */
export async function deletePartialOffer(id: string, adminEmail: string): Promise<void> {
    const docRef = adminDb.collection("partial_offers").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data() as PartialOffer;
    await docRef.delete();

    await logPartialOfferAudit({
        action: "OFFER_DELETED",
        offerId: id,
        targetEmail: data.targetEmail,
        adminEmail,
        details: `Deleted partial offer "${data.title}"`,
        previousValue: data as Record<string, unknown>,
    });
}

/**
 * Evaluates active targeted partial offers for a given user email and planId.
 */
export async function getApplicablePartialOfferForUser(
    email: string,
    planId: string
): Promise<PartialOffer | null> {
    if (!email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    const snap = await adminDb
        .collection("partial_offers")
        .where("targetEmail", "==", normalizedEmail)
        .where("isActive", "==", true)
        .get();

    if (snap.empty) return null;

    const candidateOffers: PartialOffer[] = [];

    for (const doc of snap.docs) {
        const offer = { id: doc.id, ...doc.data() } as PartialOffer;

        // Check start date
        if (offer.startsAt && offer.startsAt > now) continue;

        // Check expiry date
        if (offer.expiresAt && offer.expiresAt <= now) continue;

        // Check total usage limit
        if (offer.usageLimit !== null && offer.redemptionCount >= offer.usageLimit) continue;

        // Check plan eligibility
        const planMatch =
            offer.plans.includes("all") ||
            offer.plans.includes(planId.toLowerCase());

        if (planMatch) {
            candidateOffers.push(offer);
        }
    }

    if (candidateOffers.length === 0) return null;

    // Sort candidate offers by priority (descending), then created date (descending)
    candidateOffers.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.createdAt - a.createdAt;
    });

    return candidateOffers[0];
}

/**
 * Calculates final price in INR based on base price and partial offer.
 */
export function calculatePartialOfferPrice(basePriceINR: number, offer: PartialOffer): {
    finalPriceINR: number;
    discountAmountINR: number;
} {
    let finalPriceINR = basePriceINR;

    if (offer.discountType === "percentage") {
        const discountFraction = Math.min(100, Math.max(0, offer.discountValue)) / 100;
        finalPriceINR = basePriceINR * (1 - discountFraction);
    } else if (offer.discountType === "flat") {
        finalPriceINR = Math.max(0, basePriceINR - offer.discountValue);
    } else if (offer.discountType === "custom_price") {
        finalPriceINR = Math.max(0, offer.discountValue);
    }

    finalPriceINR = Math.round(finalPriceINR * 100) / 100; // 2 decimal precision
    const discountAmountINR = Math.max(0, Math.round((basePriceINR - finalPriceINR) * 100) / 100);

    return { finalPriceINR, discountAmountINR };
}

/**
 * Increments redemption count when an offer is redeemed, storing previous user plan.
 */
export async function recordPartialOfferRedemption(params: {
    offerId: string;
    userId: string;
    userEmail: string;
    planId: string;
    orderId: string;
}): Promise<void> {
    try {
        const offerRef = adminDb.collection("partial_offers").doc(params.offerId);
        const redemptionRef = adminDb.collection("partial_offer_redemptions").doc();
        const userRef = adminDb.collection("users").doc(params.userId);

        const now = Date.now();

        // Get user's plan & quota prior to redemption
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : null;
        const previousPlan = userData?.plan || "free";
        const previousCumulativeQuota = userData?.cumulativeQuota || 0;
        const previousPlanRenewals = userData?.planRenewals || 1;

        await adminDb.runTransaction(async (transaction) => {
            const offerSnap = await transaction.get(offerRef);
            if (!offerSnap.exists) return;

            const offerData = offerSnap.data() as PartialOffer;
            const newCount = (offerData.redemptionCount || 0) + 1;
            const isExhausted = offerData.usageLimit !== null && offerData.usageLimit !== undefined && newCount >= offerData.usageLimit;

            transaction.update(offerRef, {
                redemptionCount: newCount,
                isActive: isExhausted ? false : offerData.isActive,
                updatedAt: now,
            });

            transaction.set(redemptionRef, {
                offerId: params.offerId,
                userId: params.userId,
                userEmail: params.userEmail.toLowerCase(),
                planId: params.planId,
                previousPlan,
                previousCumulativeQuota,
                previousPlanRenewals,
                orderId: params.orderId,
                status: "active",
                redeemedAt: now,
            });
        });

        await logPartialOfferAudit({
            action: "OFFER_REDEEMED",
            offerId: params.offerId,
            targetEmail: params.userEmail,
            adminEmail: "system",
            details: `Redeemed partial offer on plan ${params.planId} (Order ${params.orderId})`,
        });
    } catch (err) {
        logger.error("partial_offers_redemption", "Failed to record redemption", { error: String(err) });
    }
}

/**
 * Revokes a claimed partial offer and reverts the targeted user's account to their previous plan.
 * Existing links remain active until their scheduled creation expiration time!
 */
export async function revokePartialOfferAndRevertUser(
    offerId: string,
    adminEmail: string
): Promise<{
    revokedCount: number;
    revertedEmails: string[];
}> {
    const now = Date.now();
    const offerRef = adminDb.collection("partial_offers").doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) {
        throw new Error("Partial offer not found");
    }
    const offerData = offerSnap.data() as PartialOffer;

    if (offerData.isRevoked) {
        return {
            revokedCount: 0,
            revertedEmails: [],
        };
    }

    const redemptionsSnap = await adminDb
        .collection("partial_offer_redemptions")
        .where("offerId", "==", offerId)
        .get();

    const revertedEmails: string[] = [];
    let revokedCount = 0;

    for (const rDoc of redemptionsSnap.docs) {
        const rData = rDoc.data();
        if (rData.status === "revoked") continue;

        const userEmail = rData.userEmail || offerData.targetEmail;
        const targetUserId = rData.userId;
        const previousPlan = rData.previousPlan || "free";
        const previousCumulativeQuota = previousPlan === "free" ? 0 : (rData.previousCumulativeQuota || 0);
        const previousPlanRenewals = previousPlan === "free" ? 1 : (rData.previousPlanRenewals || 1);

        if (targetUserId) {
            const uRef = adminDb.collection("users").doc(targetUserId);
            const uSnap = await uRef.get();
            if (uSnap.exists) {
                await uRef.update({
                    plan: previousPlan,
                    planExpiry: null,
                    cumulativeQuota: previousCumulativeQuota,
                    planRenewals: previousPlanRenewals,
                    planStatus: "active",
                    updatedAt: now,
                });
            }
        } else if (userEmail) {
            const usersByEmail = await adminDb
                .collection("users")
                .where("email", "==", userEmail.toLowerCase())
                .limit(1)
                .get();

            if (!usersByEmail.empty) {
                await usersByEmail.docs[0].ref.update({
                    plan: previousPlan,
                    planExpiry: null,
                    cumulativeQuota: previousCumulativeQuota,
                    planRenewals: previousPlanRenewals,
                    planStatus: "active",
                    updatedAt: now,
                });
            }
        }

        await rDoc.ref.update({
            status: "revoked",
            revokedAt: now,
            revokedBy: adminEmail,
        });

        revokedCount++;
        if (userEmail && !revertedEmails.includes(userEmail)) {
            revertedEmails.push(userEmail);
        }
    }

    // Mark offer as inactive & revoked
    await offerRef.update({
        isActive: false,
        isRevoked: true,
        revokedAt: now,
        updatedAt: now,
    });

    await logPartialOfferAudit({
        action: "OFFER_REVOKED",
        offerId,
        targetEmail: offerData.targetEmail,
        adminEmail,
        details: `Revoked offer "${offerData.title}" and reverted ${revokedCount} user plan(s) back to previous plan`,
        previousValue: offerData as Record<string, unknown>,
    });

    return { revokedCount, revertedEmails };
}

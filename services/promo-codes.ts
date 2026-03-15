import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getPricePaise, PLAN_CONFIGS, resolvePlanType, type PlanType } from "@/lib/plans";
import type { PromoCodeDocument, PromoRedemptionDocument } from "@/types";

export interface PromoCodeInput {
    code?: string;
    discountType?: "percentage" | "fixed" | "free_plan";
    discountValue?: number;
    expiresAt?: number | null;
    usageLimit?: number | null;
    planRestriction?: PlanType | null;
    isActive?: boolean;
    perUserLimit?: number | null;
}

export interface PromoPricingSummary {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
}

export interface PromoValidationSuccess extends PromoPricingSummary {
    valid: true;
    promoId: string;
    code: string;
    normalizedCode: string;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
    expiresAt: number | null;
    usageLimit: number | null;
    usageCount: number;
    planRestriction: PlanType | null;
    perUserLimit: number | null;
}

export interface PromoValidationFailure extends PromoPricingSummary {
    valid: false;
    reason:
        | "missing_code"
        | "not_found"
        | "inactive"
        | "expired"
        | "usage_limit_reached"
        | "plan_restricted";
    message: string;
}

export type PromoValidationResult = PromoValidationSuccess | PromoValidationFailure;

function generatePromoCode(length: number = 10): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(crypto.randomBytes(length))
        .map((byte) => alphabet[byte % alphabet.length])
        .join("");
}

export function normalizePromoCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

function getPlanPriceSummary(planId: PlanType): PromoPricingSummary {
    const originalAmount = getPricePaise(planId);
    return {
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
    };
}

function calculateDiscountAmount(originalAmount: number, discountType: "percentage" | "fixed", discountValue: number): number {
    if (discountType === "percentage") {
        const percentage = Math.max(Math.min(discountValue, 100), 0);
        return Math.round((originalAmount * percentage) / 100);
    }

    return Math.max(Math.min(Math.round(discountValue * 100), originalAmount), 0);
}

function buildPricingSummary(planId: PlanType, promo: PromoCodeDocument | null): PromoPricingSummary {
    const base = getPlanPriceSummary(planId);
    if (!promo) {
        return base;
    }

    if (promo.discountType === "free_plan") {
        return {
            originalAmount: base.originalAmount,
            discountAmount: base.originalAmount,
            finalAmount: 0,
        };
    }

    const discountAmount = calculateDiscountAmount(base.originalAmount, promo.discountType, promo.discountValue);
    return {
        originalAmount: base.originalAmount,
        discountAmount,
        finalAmount: Math.max(base.originalAmount - discountAmount, 0),
    };
}

async function getPromoDocByCode(normalizedCode: string): Promise<{ id: string; data: PromoCodeDocument } | null> {
    const snapshot = await adminDb
        .collection("promo_codes")
        .where("normalizedCode", "==", normalizedCode)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        data: doc.data() as PromoCodeDocument,
    };
}

export async function validatePromoCodeForPlan(
    code: string | null | undefined,
    rawPlanId: string | null | undefined,
    userId?: string | null
): Promise<PromoValidationResult> {
    const planId = resolvePlanType(rawPlanId);
    const base = getPlanPriceSummary(planId);

    if (!code) {
        return {
            valid: false,
            reason: "missing_code",
            message: "Enter a promo code.",
            ...base,
        };
    }

    const normalizedCode = normalizePromoCode(code);
    if (!normalizedCode) {
        return {
            valid: false,
            reason: "missing_code",
            message: "Enter a promo code.",
            ...base,
        };
    }

    const promo = await getPromoDocByCode(normalizedCode);
    if (!promo) {
        return {
            valid: false,
            reason: "not_found",
            message: "Promo code not found.",
            ...base,
        };
    }

    const now = Date.now();
    const data = promo.data;

    if (!data.isActive) {
        return {
            valid: false,
            reason: "inactive",
            message: "This promo code is disabled.",
            ...base,
        };
    }

    if (data.expiresAt && data.expiresAt <= now) {
        return {
            valid: false,
            reason: "expired",
            message: "This promo code has expired.",
            ...base,
        };
    }

    if (data.usageLimit !== null && data.usageLimit !== undefined && data.usageCount >= data.usageLimit) {
        return {
            valid: false,
            reason: "usage_limit_reached",
            message: "This promo code has reached its usage limit.",
            ...base,
        };
    }

    if (data.planRestriction && resolvePlanType(data.planRestriction) !== planId) {
        return {
            valid: false,
            reason: "plan_restricted",
            message: `This promo code only applies to the ${PLAN_CONFIGS[data.planRestriction].label} plan.`,
            ...base,
        };
    }

    // Per-user limit check via redemptions collection
    if (userId && data.perUserLimit !== null && data.perUserLimit !== undefined) {
        const redemptionsSnap = await adminDb
            .collection("promo_redemptions")
            .where("promoCodeId", "==", promo.id)
            .where("userId", "==", userId)
            .get();

        if (redemptionsSnap.size >= data.perUserLimit) {
            return {
                valid: false,
                reason: "usage_limit_reached",
                message: "You have already used this promo code the maximum number of times.",
                ...base,
            };
        }
    }

    const pricing = buildPricingSummary(planId, data);
    return {
        valid: true,
        promoId: promo.id,
        code: data.code,
        normalizedCode: data.normalizedCode,
        discountType: data.discountType,
        discountValue: data.discountValue,
        expiresAt: data.expiresAt,
        usageLimit: data.usageLimit,
        usageCount: data.usageCount,
        planRestriction: data.planRestriction,
        perUserLimit: data.perUserLimit ?? null,
        ...pricing,
    };
}

export async function listPromoCodes(): Promise<Array<PromoCodeDocument & { id: string }>> {
    const snapshot = await adminDb.collection("promo_codes").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PromoCodeDocument) }));
}

export async function listPromoRedemptions(promoCodeId: string): Promise<Array<PromoRedemptionDocument & { id: string }>> {
    const snap = await adminDb
        .collection("promo_redemptions")
        .where("promoCodeId", "==", promoCodeId)
        .orderBy("redeemedAt", "desc")
        .limit(100)
        .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PromoRedemptionDocument) }));
}

async function ensureUniquePromoCode(normalizedCode: string, excludeId?: string): Promise<void> {
    const existing = await getPromoDocByCode(normalizedCode);
    if (existing && existing.id !== excludeId) {
        throw new Error("A promo code with this code already exists.");
    }
}

export async function createPromoCode(input: PromoCodeInput, adminUid: string): Promise<{ id: string; data: PromoCodeDocument }> {
    const now = Date.now();
    const generatedCode = input.code?.trim() || generatePromoCode();
    const normalizedCode = normalizePromoCode(generatedCode);

    if (!normalizedCode) {
        throw new Error("Promo code cannot be empty.");
    }

    if (!input.discountType || input.discountValue === undefined) {
        throw new Error("Discount type and value are required.");
    }

    if (input.discountType === "percentage" && (input.discountValue <= 0 || input.discountValue > 100)) {
        throw new Error("Percentage discounts must be between 1 and 100.");
    }

    if (input.discountType === "fixed" && input.discountValue <= 0) {
        throw new Error("Fixed discounts must be greater than 0.");
    }

    if (input.discountType === "free_plan") {
        input.discountValue = 100; // normalized placeholder, pricing will set finalAmount 0
    }

    await ensureUniquePromoCode(normalizedCode);

    const ref = adminDb.collection("promo_codes").doc();
    const data: PromoCodeDocument = {
        code: generatedCode.toUpperCase(),
        normalizedCode,
        discountType: input.discountType,
        discountValue: input.discountValue,
        expiresAt: input.expiresAt ?? null,
        usageLimit: input.usageLimit ?? null,
        usageCount: 0,
        planRestriction: input.planRestriction ? resolvePlanType(input.planRestriction) : null,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminUid,
        updatedBy: adminUid,
        lastUsedAt: null,
        perUserLimit: input.perUserLimit ?? null,
        redemptionCount: 0,
    };

    await ref.set(data);
    return { id: ref.id, data };
}

export async function updatePromoCode(id: string, input: PromoCodeInput & { usageCount?: number }, adminUid: string): Promise<PromoCodeDocument> {
    const ref = adminDb.collection("promo_codes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new Error("Promo code not found.");
    }

    const existing = snap.data() as PromoCodeDocument;
    const nextCode = input.code?.trim() ? input.code.trim().toUpperCase() : existing.code;
    const nextNormalizedCode = normalizePromoCode(nextCode);
    await ensureUniquePromoCode(nextNormalizedCode, id);

    const nextDiscountType = input.discountType ?? existing.discountType;
    const nextDiscountValue = input.discountValue ?? existing.discountValue;
    if (nextDiscountType === "percentage" && (nextDiscountValue <= 0 || nextDiscountValue > 100)) {
        throw new Error("Percentage discounts must be between 1 and 100.");
    }
    if (nextDiscountType === "fixed" && nextDiscountValue <= 0) {
        throw new Error("Fixed discounts must be greater than 0.");
    }
    if (nextDiscountType === "free_plan") {
        // force value to a sentinel for consistency
        input.discountValue = 100;
    }

    const updated: PromoCodeDocument = {
        ...existing,
        code: nextCode,
        normalizedCode: nextNormalizedCode,
        discountType: nextDiscountType,
        discountValue: nextDiscountValue,
        expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
        usageLimit: input.usageLimit === undefined ? existing.usageLimit : input.usageLimit,
        usageCount: input.usageCount === undefined ? existing.usageCount : input.usageCount,
        planRestriction: input.planRestriction === undefined
            ? existing.planRestriction
            : input.planRestriction
                ? resolvePlanType(input.planRestriction)
                : null,
        isActive: input.isActive === undefined ? existing.isActive : input.isActive,
        updatedAt: Date.now(),
        updatedBy: adminUid,
        perUserLimit:
            input.perUserLimit === undefined
                ? existing.perUserLimit ?? null
                : input.perUserLimit !== null
                    ? Number(input.perUserLimit)
                    : null,
        redemptionCount: existing.redemptionCount ?? 0,
    };

    await ref.set(updated, { merge: true });
    return updated;
}

export async function deletePromoCode(id: string): Promise<void> {
    const redemptions = await adminDb
        .collection("promo_redemptions")
        .where("promoCodeId", "==", id)
        .get();

    const batch = adminDb.batch();
    redemptions.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(adminDb.collection("promo_codes").doc(id));
    await batch.commit();
}

export async function createPromoRedemption(
    data: Omit<PromoRedemptionDocument, "redeemedAt">
): Promise<string> {
    const ref = adminDb.collection("promo_redemptions").doc();
    const payload: PromoRedemptionDocument = {
        ...data,
        redeemedAt: Date.now(),
    };
    await ref.set(payload);

    // best-effort increment redemptionCount on promo
    if (data.promoCodeId) {
        const promoRef = adminDb.collection("promo_codes").doc(data.promoCodeId);
        await promoRef.set({ redemptionCount: FieldValue.increment(1) }, { merge: true });
    }
    return ref.id;
}


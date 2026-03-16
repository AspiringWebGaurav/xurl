import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getPricePaise, PLAN_CONFIGS, resolvePlanType, type PlanType } from "@/lib/plans";
import type { PromoCodeDocument, PromoRedemptionDocument } from "@/types";

export interface PromoCodeInput {
    code?: string;
    discountType?: "percentage" | "fixed" | "free_plan";
    discountValue?: number;
    startsAt?: number | null;
    expiresAt?: number | null;
    usageLimit?: number | null;
    planRestriction?: PlanType | null;
    planRestrictions?: PlanType[] | null;
    status?: "ACTIVE" | "PAUSED" | "DISABLED";
    isActive?: boolean;
    perUserLimit?: number | null;
    firstTimeOnly?: boolean;
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
    status: "ACTIVE" | "PAUSED" | "DISABLED" | "EXPIRED";
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
    startsAt: number | null;
    expiresAt: number | null;
    usageLimit: number | null;
    usageCount: number;
    planRestriction: PlanType | null;
    planRestrictions: PlanType[] | null;
    perUserLimit: number | null;
    firstTimeOnly: boolean;
}

export interface PromoValidationFailure extends PromoPricingSummary {
    valid: false;
    reason:
        | "missing_code"
        | "not_found"
        | "inactive"
        | "expired"
        | "usage_limit_reached"
        | "plan_restricted"
        | "not_started"
        | "first_time_only";
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

function resolveStatus(promo: PromoCodeDocument): "ACTIVE" | "PAUSED" | "DISABLED" {
    if (promo.status) {
        return promo.status;
    }
    return promo.isActive ? "ACTIVE" : "DISABLED";
}

function resolvePlanRestrictions(promo: PromoCodeDocument): PlanType[] {
    if (promo.planRestrictions && promo.planRestrictions.length) {
        return promo.planRestrictions.map((plan) => resolvePlanType(plan));
    }
    return promo.planRestriction ? [resolvePlanType(promo.planRestriction)] : [];
}

async function hasPaidTransaction(userId: string): Promise<boolean> {
    const snapshot = await adminDb
        .collection("transactions")
        .where("userId", "==", userId)
        .where("source", "==", "razorpay")
        .limit(1)
        .get();
    return !snapshot.empty;
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
    const status = resolveStatus(data);
    const isExpired = Boolean(data.expiresAt && data.expiresAt <= now);
    const startsAt = data.startsAt ?? null;
    const effectiveStatus: PromoValidationSuccess["status"] =
        status === "ACTIVE" && isExpired ? "EXPIRED" : status;

    if (effectiveStatus !== "ACTIVE") {
        const message =
            effectiveStatus === "EXPIRED"
                ? "Promo expired."
                : "This promo code is temporarily disabled by the administrator.";
        return {
            valid: false,
            reason: effectiveStatus === "EXPIRED" ? "expired" : "inactive",
            message,
            ...base,
        };
    }

    if (startsAt && startsAt > now) {
        return {
            valid: false,
            reason: "not_started",
            message: "This promo code is not active yet.",
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

    const planRestrictions = resolvePlanRestrictions(data);
    if (planRestrictions.length && !planRestrictions.includes(planId)) {
        const restriction = planRestrictions[0];
        const restrictionLabel = planRestrictions.length === 1
            ? PLAN_CONFIGS[restriction]?.label
            : "selected plans";
        return {
            valid: false,
            reason: "plan_restricted",
            message: `Promo not valid for this plan. ${restrictionLabel ? `Applies to ${restrictionLabel}.` : ""}`.trim(),
            ...base,
        };
    }

    if (userId && data.firstTimeOnly) {
        const alreadyPaid = await hasPaidTransaction(userId);
        if (alreadyPaid) {
            return {
                valid: false,
                reason: "first_time_only",
                message: "Promo already used by this account.",
                ...base,
            };
        }
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
        status: effectiveStatus,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startsAt,
        expiresAt: data.expiresAt,
        usageLimit: data.usageLimit,
        usageCount: data.usageCount,
        planRestriction: data.planRestriction,
        planRestrictions: planRestrictions.length ? planRestrictions : null,
        perUserLimit: data.perUserLimit ?? null,
        firstTimeOnly: Boolean(data.firstTimeOnly),
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

    const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PromoRedemptionDocument) }));
    const userIds = Array.from(new Set(rows.map((row) => row.userId).filter(Boolean)));
    if (!userIds.length) return rows;

    const userEmailMap = new Map<string, string | null>();
    const chunkSize = 50;
    for (let i = 0; i < userIds.length; i += chunkSize) {
        const chunk = userIds.slice(i, i + chunkSize);
        const refs = chunk.map((uid) => adminDb.collection("users").doc(uid));
        const snapshots = await adminDb.getAll(...refs);
        snapshots.forEach((snap) => {
            if (!snap.exists) return;
            const data = snap.data() as { email?: string | null };
            userEmailMap.set(snap.id, data?.email ?? null);
        });
    }

    return rows.map((row) => ({
        ...row,
        userEmail: userEmailMap.get(row.userId) ?? row.userEmail ?? null,
    }));
}

async function ensureUniquePromoCode(normalizedCode: string, excludeId?: string): Promise<void> {
    const existing = await getPromoDocByCode(normalizedCode);
    if (existing && existing.id !== excludeId) {
        throw new Error("A promo code with this code already exists.");
    }
}

export async function createPromoCode(
    input: PromoCodeInput,
    adminUid: string,
    adminEmail?: string | null
): Promise<{ id: string; data: PromoCodeDocument }> {
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

    const status = input.status ?? (input.isActive === false ? "DISABLED" : "ACTIVE");
    const isActive = status === "ACTIVE";
    const planRestrictions = input.planRestrictions?.length
        ? input.planRestrictions.map((plan) => resolvePlanType(plan))
        : null;

    const ref = adminDb.collection("promo_codes").doc();
    const data: PromoCodeDocument = {
        code: generatedCode.toUpperCase(),
        normalizedCode,
        status,
        discountType: input.discountType,
        discountValue: input.discountValue,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        usageLimit: input.usageLimit ?? null,
        usageCount: 0,
        planRestriction: input.planRestriction ? resolvePlanType(input.planRestriction) : null,
        planRestrictions,
        isActive,
        firstTimeOnly: input.firstTimeOnly ?? false,
        createdAt: now,
        updatedAt: now,
        createdBy: adminUid,
        updatedBy: adminUid,
        lastUsedAt: null,
        perUserLimit: input.perUserLimit ?? null,
        redemptionCount: 0,
    };

    await ref.set(data);
    await logPromoAdminAction({
        action: "PROMO_CREATE",
        promoCode: data.code,
        promoId: ref.id,
        adminUid,
        adminEmail: adminEmail ?? null,
    });
    return { id: ref.id, data };
}

export async function updatePromoCode(
    id: string,
    input: PromoCodeInput & { usageCount?: number },
    adminUid: string,
    adminEmail?: string | null
): Promise<PromoCodeDocument> {
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

    const nextStatus = input.status
        ?? (input.isActive !== undefined ? (input.isActive ? "ACTIVE" : "DISABLED") : resolveStatus(existing));
    const nextIsActive = nextStatus === "ACTIVE";
    const nextPlanRestrictions = input.planRestrictions === undefined
        ? existing.planRestrictions ?? null
        : input.planRestrictions && input.planRestrictions.length
            ? input.planRestrictions.map((plan) => resolvePlanType(plan))
            : null;

    const updated: PromoCodeDocument = {
        ...existing,
        code: nextCode,
        normalizedCode: nextNormalizedCode,
        status: nextStatus,
        discountType: nextDiscountType,
        discountValue: nextDiscountValue,
        startsAt: input.startsAt === undefined ? existing.startsAt ?? null : input.startsAt,
        expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
        usageLimit: input.usageLimit === undefined ? existing.usageLimit : input.usageLimit,
        usageCount: input.usageCount === undefined ? existing.usageCount : input.usageCount,
        planRestriction: input.planRestriction === undefined
            ? existing.planRestriction
            : input.planRestriction
                ? resolvePlanType(input.planRestriction)
                : null,
        planRestrictions: nextPlanRestrictions,
        isActive: nextIsActive,
        updatedAt: Date.now(),
        updatedBy: adminUid,
        perUserLimit:
            input.perUserLimit === undefined
                ? existing.perUserLimit ?? null
                : input.perUserLimit !== null
                    ? Number(input.perUserLimit)
                    : null,
        firstTimeOnly: input.firstTimeOnly === undefined ? existing.firstTimeOnly ?? false : input.firstTimeOnly,
        redemptionCount: existing.redemptionCount ?? 0,
    };

    await ref.set(updated, { merge: true });

    const action = nextStatus === "PAUSED"
        ? "PROMO_PAUSE"
        : nextStatus === "DISABLED"
            ? "PROMO_DISABLE"
            : "PROMO_UPDATE";
    await logPromoAdminAction({
        action,
        promoCode: updated.code,
        promoId: id,
        adminUid,
        adminEmail: adminEmail ?? null,
    });
    return updated;
}

export async function deletePromoCode(id: string, adminUid?: string, adminEmail?: string | null): Promise<void> {
    const promoSnap = await adminDb.collection("promo_codes").doc(id).get();
    const promoData = promoSnap.exists ? (promoSnap.data() as PromoCodeDocument) : null;
    const redemptions = await adminDb
        .collection("promo_redemptions")
        .where("promoCodeId", "==", id)
        .get();

    const batch = adminDb.batch();
    redemptions.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(adminDb.collection("promo_codes").doc(id));
    await batch.commit();

    if (promoData && adminUid) {
        await logPromoAdminAction({
            action: "PROMO_DELETE",
            promoCode: promoData.code,
            promoId: id,
            adminUid,
            adminEmail: adminEmail ?? null,
        });
    }
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

type PromoAdminAction = {
    action: "PROMO_CREATE" | "PROMO_UPDATE" | "PROMO_PAUSE" | "PROMO_DISABLE" | "PROMO_DELETE";
    promoId: string;
    promoCode: string;
    adminUid: string;
    adminEmail: string | null;
};

async function logPromoAdminAction(action: PromoAdminAction): Promise<void> {
    const ref = adminDb.collection("promo_activity").doc();
    await ref.set({
        ...action,
        createdAt: Date.now(),
    });
}


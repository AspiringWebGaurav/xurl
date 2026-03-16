import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { resolvePlanType, type PlanType } from "@/lib/plans";
import { applyPlanUpgrade } from "@/services/plan-upgrade";
import { createTransaction } from "@/services/transactions";

export type PendingGrantType = "plan" | "link_gift";

export type PendingGrantDocument = {
    email: string;
    type: PendingGrantType;
    planId?: PlanType;
    quantity?: number;
    expiresAt?: number | null;
    overrideExpiryMs?: number | null;
    reason?: string;
    source: string;
    status: "pending" | "consumed";
    createdAt: number;
    consumedAt?: number;
    userId?: string;
};

export type AppliedGrantSummary = {
    id: string;
    type: PendingGrantType;
    planId?: PlanType;
    quantity?: number;
    expiresAt?: number | null;
    reason?: string;
};

async function applyLinkGift(
    grantId: string,
    userId: string,
    quantity: number,
    expiresAt: number | null,
    reason?: string,
    source: string = "admin_grant",
    transaction?: Transaction,
    metadata?: {
        recipientEmail?: string | null;
        adminEmail?: string | null;
        durationOption?: string;
        customValue?: number;
        customUnit?: string;
    }
) {
    const now = Date.now();
    const userRef = adminDb.collection("users").doc(userId);

    const execute = async (tx: Transaction) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? (userSnap.data() as any) : null;
        const currentPlan = resolvePlanType(userData?.plan || "free");
        const existingGifts: { id: string; amount: number; expiresAt: number | null }[] = Array.isArray(userData?.giftQuotas)
            ? userData.giftQuotas
            : [];

        const filtered = existingGifts.filter((g) => !g.expiresAt || g.expiresAt > now);
        const alreadyApplied = filtered.find((g) => g.id === grantId);
        if (alreadyApplied) {
            return;
        }

        const updatedGifts = [...filtered, { id: grantId, amount: quantity, expiresAt: expiresAt ?? null }];

        tx.set(
            userRef,
            {
                giftQuotas: updatedGifts,
                updatedAt: now,
            },
            { merge: true }
        );

        await createTransaction(
            {
                userId,
                planType: currentPlan,
                action: "admin_grant",
                linksAllocated: quantity,
                source: source as any,
                amount: 0,
                reason,
                recipientEmail: metadata?.recipientEmail ?? null,
                adminEmail: metadata?.adminEmail ?? null,
                grantType: "link_gift",
                durationOption: metadata?.durationOption,
                customValue: metadata?.customValue,
                customUnit: metadata?.customUnit,
                expiresAt,
                previousPlan: currentPlan,
            },
            tx
        );
    };

    if (transaction) {
        await execute(transaction);
    } else {
        await adminDb.runTransaction(async (tx) => execute(tx));
    }
}

export async function applyPendingGrantsForEmail(email: string | null | undefined, userId: string) {
    if (!email) return [] as AppliedGrantSummary[];

    const normalizedEmail = email.toLowerCase();
    const snap = await adminDb
        .collection("pending_grants")
        .where("email", "==", normalizedEmail)
        .where("status", "==", "pending")
        .get();

    if (snap.empty) return [] as AppliedGrantSummary[];

    const applied: AppliedGrantSummary[] = [];

    for (const doc of snap.docs) {
        const grantId = doc.id;
        await adminDb.runTransaction(async (tx) => {
            const fresh = await tx.get(doc.ref);
            if (!fresh.exists) return;
            const data = fresh.data() as PendingGrantDocument;
            if (data.status === "consumed") return;

            const now = Date.now();

            if (data.type === "plan" && data.planId) {
                await applyPlanUpgrade(data.planId, userId, undefined, undefined, tx, {
                    overrideExpiryMs: data.overrideExpiryMs ?? undefined,
                    source: "admin_grant",
                    amountPaise: 0,
                    reason: data.reason || "admin_grant",
                });
                applied.push({
                    id: grantId,
                    type: "plan",
                    planId: data.planId,
                    expiresAt:
                        data.overrideExpiryMs === null
                            ? null
                            : data.overrideExpiryMs
                                ? now + data.overrideExpiryMs
                                : null,
                    reason: data.reason,
                });
            }

            let shouldConsumeWithoutApply = false;
            if (data.type === "link_gift" && data.quantity) {
                if (typeof data.expiresAt === "number" && data.expiresAt <= now) {
                    shouldConsumeWithoutApply = true;
                } else {
                    await applyLinkGift(grantId, userId, data.quantity, data.expiresAt ?? null, data.reason, data.source, tx);
                    applied.push({ id: grantId, type: "link_gift", quantity: data.quantity, expiresAt: data.expiresAt ?? null, reason: data.reason });
                }
            }

            if (shouldConsumeWithoutApply || data.type === "plan" || data.type === "link_gift") {
                tx.update(doc.ref, { status: "consumed", consumedAt: now, userId });
            }
        });
    }

    return applied;
}

export async function createPendingGrant(doc: Omit<PendingGrantDocument, "status" | "createdAt">) {
    const payload: PendingGrantDocument = {
        ...doc,
        status: "pending",
        createdAt: Date.now(),
    };
    const ref = await adminDb.collection("pending_grants").add(payload);
    return ref.id;
}

export async function grantLinkGiftToUserOrPending(options: {
    email: string;
    userId?: string | null;
    quantity: number;
    expiresAt: number | null;
    reason?: string;
    adminEmail?: string | null;
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
}) {
    const { email, userId, quantity, expiresAt, reason, adminEmail, durationOption, customValue, customUnit } = options;
    const normalizedEmail = email.toLowerCase();
    if (userId) {
        await adminDb.runTransaction(async (tx) => {
            await applyLinkGift(`gift_${Date.now()}`, userId, quantity, expiresAt, reason, "admin_grant", tx, {
                recipientEmail: normalizedEmail,
                adminEmail: adminEmail || null,
                durationOption,
                customValue,
                customUnit,
            });
        });
        return { applied: true, pendingId: null };
    }

    const pendingId = await createPendingGrant({
        email: normalizedEmail,
        type: "link_gift",
        quantity,
        expiresAt,
        source: "admin_grant",
        reason: reason || "admin_grant",
    });
    return { applied: false, pendingId };
}

export async function grantPlanToUserOrPending(options: {
    email: string;
    userId?: string | null;
    planId: PlanType;
    overrideExpiryMs: number | null;
    reason?: string;
    adminEmail?: string | null;
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
}) {
    const { email, userId, planId, overrideExpiryMs, reason, adminEmail, durationOption, customValue, customUnit } = options;
    const normalizedEmail = email.toLowerCase();
    if (userId) {
        await applyPlanUpgrade(planId, userId, undefined, undefined, undefined, {
            overrideExpiryMs,
            source: "admin_grant",
            amountPaise: 0,
            reason: reason || "admin_grant",
            recipientEmail: normalizedEmail,
            adminEmail: adminEmail || null,
            grantType: "plan",
            durationOption,
            customValue,
            customUnit,
        });
        return { applied: true, pendingId: null };
    }

    const pendingId = await createPendingGrant({
        email: normalizedEmail,
        type: "plan",
        planId,
        overrideExpiryMs,
        source: "admin_grant",
        reason: reason || "admin_grant",
    });
    return { applied: false, pendingId };
}

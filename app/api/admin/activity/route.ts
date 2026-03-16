import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import type { PlanTransaction, TransactionSource } from "@/services/transactions";
import type { PromoCodeDocument, PromoRedemptionDocument } from "@/types";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ActivityItem = {
    id: string;
    type: "billing" | "grant" | "promo_redemption" | "promo_created";
    message: string;
    timestamp: number;
    details?: Record<string, unknown>;
};

type ActivitySummary = {
    promo: {
        activeCodes: number;
        recentRedemptions: number;
        limitsReached: number;
    };
    grants: {
        recentGrants: number;
        lastGrantAt?: number;
    };
    purchases: {
        recentTransactions: number;
        lastUpgradeAt?: number;
        sourceSummary: Record<TransactionSource, number>;
    };
};

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    try {
        const [txSnap, redemptionSnap, promoSnap] = await Promise.all([
            adminDb.collection("transactions").orderBy("createdAt", "desc").limit(limit).get(),
            adminDb.collection("promo_redemptions").orderBy("redeemedAt", "desc").limit(limit).get(),
            adminDb.collection("promo_codes").orderBy("createdAt", "desc").limit(limit).get(),
        ]);

        const txItems: ActivityItem[] = txSnap.docs.map((doc) => {
            const data = doc.data() as PlanTransaction;
            const isGrant = data.source === "admin_grant" || data.action === "admin_grant" || data.action === "admin_revoke";
            const type: ActivityItem["type"] = isGrant ? "grant" : "billing";
            const actionLabel = data.action ? data.action.replace("_", " ") : "update";
            const planLabel = data.planType ? `${data.planType}` : "plan";
            const recipient = data.recipientEmail || data.userId;
            return {
                id: doc.id,
                type,
                message: `${actionLabel} · ${planLabel} → ${recipient}`,
                timestamp: data.createdAt,
                details: {
                    action: data.action,
                    planType: data.planType,
                    linksAllocated: data.linksAllocated,
                    source: data.source,
                    amount: data.amount ?? 0,
                    recipientEmail: data.recipientEmail ?? null,
                    adminEmail: data.adminEmail ?? null,
                    grantType: data.grantType ?? null,
                    durationOption: data.durationOption ?? null,
                    customValue: data.customValue ?? null,
                    customUnit: data.customUnit ?? null,
                    overrideExpiryMs: data.overrideExpiryMs ?? null,
                    expiresAt: data.expiresAt ?? null,
                    previousPlan: data.previousPlan ?? null,
                    restoredPlan: data.restoredPlan ?? null,
                },
            };
        });

        const redemptionItems: ActivityItem[] = redemptionSnap.docs.map((doc) => {
            const data = doc.data() as PromoRedemptionDocument;
            return {
                id: doc.id,
                type: "promo_redemption",
                message: `Promo ${data.promoCode} redeemed for ${data.planId}`,
                timestamp: data.redeemedAt,
            };
        });

        const promoItems: ActivityItem[] = promoSnap.docs.map((doc) => {
            const data = doc.data() as PromoCodeDocument;
            return {
                id: doc.id,
                type: "promo_created",
                message: `Promo code ${data.code} created`,
                timestamp: data.createdAt,
            };
        });

        const combined = [...txItems, ...redemptionItems, ...promoItems]
            .filter((item) => item.timestamp)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        const now = Date.now();
        const ninetyDaysAgo = now - 1000 * 60 * 60 * 24 * 90;
        const thirtyDaysAgo = now - 1000 * 60 * 60 * 24 * 30;

        const promoSummary = promoSnap.docs.reduce(
            (acc, doc) => {
                const data = doc.data() as PromoCodeDocument;
                if (data.isActive) acc.activeCodes += 1;
                if (data.usageLimit !== null && data.usageLimit !== undefined && data.usageCount >= data.usageLimit) {
                    acc.limitsReached += 1;
                }
                return acc;
            },
            { activeCodes: 0, limitsReached: 0, recentRedemptions: redemptionSnap.size }
        );

        const grantTx = txSnap.docs
            .map((doc) => doc.data() as PlanTransaction)
            .filter((t) => t.source === "admin_grant");

        const lastGrantAt = grantTx.length ? grantTx.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt : undefined;
        const recentGrants = grantTx.filter((t) => t.createdAt >= ninetyDaysAgo).length;

        const purchaseTx = txSnap.docs.map((doc) => doc.data() as PlanTransaction);
        const recentTransactions = purchaseTx.filter((t) => t.createdAt >= thirtyDaysAgo).length;
        const lastUpgradeAt = purchaseTx
            .filter((t) => t.action === "upgrade")
            .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt;
        const sourceSummary = purchaseTx.reduce((acc, t) => {
            if (t.source) {
                acc[t.source] = (acc[t.source] || 0) + 1;
            }
            return acc;
        }, {} as Record<TransactionSource, number>);

        const summary: ActivitySummary = {
            promo: {
                activeCodes: promoSummary.activeCodes,
                recentRedemptions: redemptionSnap.size,
                limitsReached: promoSummary.limitsReached,
            },
            grants: {
                recentGrants,
                lastGrantAt,
            },
            purchases: {
                recentTransactions,
                lastUpgradeAt,
                sourceSummary,
            },
        };

        return NextResponse.json({ items: combined, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load admin activity";
        return NextResponse.json({ message }, { status: 500 });
    }
}

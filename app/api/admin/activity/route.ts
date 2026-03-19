import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import type { PlanTransaction, TransactionSource } from "@/services/transactions";
import type { PromoCodeDocument, PromoRedemptionDocument } from "@/types";
import {
    getActivityTimestampField,
    normalizeActivityEvent,
    type ActivityEvent,
} from "@/lib/admin/activity-events";

const DEFAULT_LIMIT = 25;
const WHOLE_APP_DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;
const WHOLE_APP_COLLECTIONS = [
    "links",
    "transactions",
    "orders",
    "promo_codes",
    "promo_redemptions",
    "promo_activity",
    "dev_flags",
    "api_logs",
    "users",
] as const;

type ActivityItem = {
    id: string;
    type:
        | "billing"
        | "grant"
        | "promo_redemption"
        | "promo_created"
        | "promo_create"
        | "promo_update"
        | "promo_pause"
        | "promo_disable"
        | "promo_delete";
    message: string;
    timestamp: number;
    details?: Record<string, unknown>;
};

type PromoAdminAction = {
    action: "PROMO_CREATE" | "PROMO_UPDATE" | "PROMO_PAUSE" | "PROMO_DISABLE" | "PROMO_DELETE";
    promoId: string;
    promoCode: string;
    adminUid: string;
    adminEmail: string | null;
    createdAt: number;
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
    const mode = request.nextUrl.searchParams.get("mode");
    const includeCount = request.nextUrl.searchParams.get("includeCount") === "true";
    const cursorParam = Number(request.nextUrl.searchParams.get("cursor"));
    const cursor = Number.isFinite(cursorParam) ? cursorParam : null;
    const defaultLimit = mode === "whole" ? WHOLE_APP_DEFAULT_LIMIT : DEFAULT_LIMIT;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : defaultLimit;

    if (mode === "whole") {
        const perCollectionLimit = Math.min(limit, 30);
        try {
            try {
                const timestampField = getActivityTimestampField("activity_events");
                let aggregatedQuery = adminDb
                    .collection("activity_events")
                    .orderBy(timestampField, "desc");
                if (cursor !== null) {
                    aggregatedQuery = aggregatedQuery.startAfter(cursor);
                }
                const aggregatedSnap = await aggregatedQuery
                    .limit(perCollectionLimit)
                    .get();
                if (!aggregatedSnap.empty) {
                    const items = aggregatedSnap.docs
                        .map((doc) => normalizeActivityEvent("activity_events", doc.id, doc.data()))
                        .filter(Boolean) as ActivityEvent[];
                    const combined = items
                        .filter((item) => item.timestamp && (cursor === null || item.timestamp < cursor))
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, limit);
                    if (includeCount) {
                        const totalSnap = await adminDb.collection("activity_events").count().get();
                        return NextResponse.json({ items: combined, totalCount: totalSnap.data().count });
                    }
                    return NextResponse.json({ items: combined });
                }
            } catch (error) {
                console.warn("activity_events aggregation failed", error);
            }

            const snapshots = await Promise.all(
                WHOLE_APP_COLLECTIONS.map((collectionName) =>
                    adminDb
                        .collection(collectionName)
                        .orderBy(getActivityTimestampField(collectionName), "desc")
                        .limit(perCollectionLimit)
                        .get()
                )
            );

            const items = snapshots.flatMap((snap, index) => {
                const collectionName = WHOLE_APP_COLLECTIONS[index];
                return snap.docs
                    .map((doc) => normalizeActivityEvent(collectionName, doc.id, doc.data()))
                    .filter(Boolean) as ActivityEvent[];
            });

            const combined = items
                .filter((item) => item.timestamp && (cursor === null || item.timestamp < cursor))
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);

            if (includeCount) {
                const countSnaps = await Promise.all(
                    WHOLE_APP_COLLECTIONS.map((collectionName) => adminDb.collection(collectionName).count().get())
                );
                const totalCount = countSnaps.reduce((sum, snap) => sum + snap.data().count, 0);
                return NextResponse.json({ items: combined, totalCount });
            }
            return NextResponse.json({ items: combined });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load whole app activity";
            return NextResponse.json({ message }, { status: 500 });
        }
    }

    try {
        const [txSnap, redemptionSnap, promoSnap, promoActionSnap] = await Promise.all([
            adminDb.collection("transactions").orderBy("createdAt", "desc").limit(limit).get(),
            adminDb.collection("promo_redemptions").orderBy("redeemedAt", "desc").limit(limit).get(),
            adminDb.collection("promo_codes").orderBy("createdAt", "desc").limit(limit).get(),
            adminDb.collection("promo_activity").orderBy("createdAt", "desc").limit(limit).get(),
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

        const promoActionItems: ActivityItem[] = promoActionSnap.docs.map((doc) => {
            const data = doc.data() as PromoAdminAction;
            const typeMap: Record<PromoAdminAction["action"], ActivityItem["type"]> = {
                PROMO_CREATE: "promo_create",
                PROMO_UPDATE: "promo_update",
                PROMO_PAUSE: "promo_pause",
                PROMO_DISABLE: "promo_disable",
                PROMO_DELETE: "promo_delete",
            };
            const adminLabel = data.adminEmail ?? data.adminUid;
            const actionLabel = data.action.replace("PROMO_", "").toLowerCase();
            return {
                id: doc.id,
                type: typeMap[data.action],
                message: `Promo ${data.promoCode} ${actionLabel} by ${adminLabel}`,
                timestamp: data.createdAt,
                details: {
                    action: data.action,
                    promoId: data.promoId,
                    promoCode: data.promoCode,
                    adminEmail: data.adminEmail ?? null,
                },
            };
        });

        const combined = [...txItems, ...redemptionItems, ...promoItems, ...promoActionItems]
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

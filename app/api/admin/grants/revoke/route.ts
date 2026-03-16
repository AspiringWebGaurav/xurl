import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { createTransaction } from "@/services/transactions";
import type { PlanType } from "@/lib/plans";
import type { PlanTransaction } from "@/services/transactions";

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const transactionId = String(body.transactionId || "").trim();
        if (!transactionId) {
            return NextResponse.json({ message: "Transaction id is required" }, { status: 400 });
        }

        const txRef = adminDb.collection("transactions").doc(transactionId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) {
            return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
        }

        const txData = txSnap.data() as PlanTransaction;
        if (txData.source !== "admin_grant" || txData.action !== "admin_grant" || txData.grantType !== "plan") {
            return NextResponse.json({ message: "Only admin plan grants can be revoked" }, { status: 400 });
        }

        const userRef = adminDb.collection("users").doc(txData.userId);
        await adminDb.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                throw new Error("User not found");
            }

            const now = Date.now();
            const updates: Record<string, unknown> = {
                plan: (txData.previousPlan as PlanType) || "free",
                planStatus: txData.previousPlanStatus || "active",
                planStart: txData.previousPlanStart || now,
                planExpiry: txData.previousPlanExpiry ?? null,
                planRenewals: txData.previousPlanRenewals || 1,
                planEraStart: txData.previousPlanEraStart || now,
                cumulativeQuota: txData.previousCumulativeQuota ?? 0,
                apiEnabled: txData.previousApiEnabled ?? false,
                apiQuotaTotal: txData.previousApiQuotaTotal ?? null,
                apiRequestsUsed: txData.previousApiRequestsUsed ?? 0,
                apiKeyHash: txData.previousApiKeyHash ?? null,
                apiKeyEncrypted: txData.previousApiKeyEncrypted ?? null,
                apiKeyLastRotatedAt: txData.previousApiKeyLastRotatedAt ?? null,
                updatedAt: now,
            };

            transaction.set(userRef, updates, { merge: true });

            await createTransaction(
                {
                    userId: txData.userId,
                    planType: (txData.previousPlan as PlanType) || "free",
                    action: "admin_revoke",
                    linksAllocated: 0,
                    source: "admin_grant",
                    amount: 0,
                    reason: "admin_revoke",
                    recipientEmail: txData.recipientEmail ?? null,
                    adminEmail: admin.email || null,
                    restoredPlan: txData.previousPlan ?? null,
                    previousPlan: txData.planType ?? null,
                    previousPlanStatus: txData.planType ? "active" : null,
                    previousPlanExpiry: txData.expiresAt ?? null,
                },
                transaction
            );
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to revoke grant";
        return NextResponse.json({ message }, { status: 400 });
    }
}

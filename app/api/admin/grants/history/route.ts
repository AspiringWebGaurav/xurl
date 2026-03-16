import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import type { PlanTransaction } from "@/services/transactions";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const fetchLimit = Math.min(limit * 4, MAX_LIMIT * 2);

    try {
        const snap = await adminDb
            .collection("transactions")
            .orderBy("createdAt", "desc")
            .limit(fetchLimit)
            .get();

        const items = snap.docs
            .map((doc) => ({ id: doc.id, ...(doc.data() as PlanTransaction) }))
            .filter((data) => data.source === "admin_grant" || data.action === "admin_grant")
            .slice(0, limit)
            .map((data) => ({
                id: data.id,
                action: data.action,
                planType: data.planType,
                linksAllocated: data.linksAllocated,
                amount: data.amount ?? 0,
                source: data.source ?? "admin_grant",
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
                createdAt: data.createdAt,
            }));

        return NextResponse.json({ items });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch grant history";
        return NextResponse.json({ message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { PLAN_CONFIGS, resolvePlanType, type PlanType } from "@/lib/plans";
import { adminDb } from "@/lib/firebase/admin";
import { applyPlanUpgrade } from "@/services/plan-upgrade";

function getOverrideMs(durationOption: string, customValue?: number, customUnit?: string): number | null {
    switch (durationOption) {
        case "1d": return 24 * 60 * 60 * 1000;
        case "5d": return 5 * 24 * 60 * 60 * 1000;
        case "10d": return 10 * 24 * 60 * 60 * 1000;
        case "30d": return 30 * 24 * 60 * 60 * 1000;
        case "custom": {
            if (!customValue || customValue <= 0) return 0;
            const v = customValue;
            switch (customUnit) {
                case "minutes": return v * 60 * 1000;
                case "hours": return v * 60 * 60 * 1000;
                case "days": return v * 24 * 60 * 60 * 1000;
                case "months": return v * 30 * 24 * 60 * 60 * 1000;
                default: return 0;
            }
        }
        default:
            return 0;
    }
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const planId = resolvePlanType(body.plan);
        if (!PLAN_CONFIGS[planId]) {
            return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
        }

        const durationOption = body.durationOption || "30d";
        const overrideMs = getOverrideMs(durationOption, Number(body.customValue), body.customUnit);
        if (overrideMs === 0) {
            return NextResponse.json({ message: "Invalid duration" }, { status: 400 });
        }

        // Resolve user by id or email
        let userId: string | null = body.userId || null;
        if (!userId && body.email) {
            const email = String(body.email).toLowerCase();
            const snap = await adminDb
                .collection("users")
                .where("email", "==", email)
                .limit(1)
                .get();
            if (!snap.empty) {
                userId = snap.docs[0].id;
            }
        }

        if (!userId) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        await applyPlanUpgrade(planId, userId, undefined, undefined, undefined, {
            overrideExpiryMs: overrideMs,
            source: "admin_grant",
            amountPaise: 0,
            reason: body.reason || "admin_grant",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to grant plan";
        return NextResponse.json({ message }, { status: 400 });
    }
}

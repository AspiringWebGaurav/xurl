import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { PLAN_CONFIGS, resolvePlanType, type PlanType } from "@/lib/plans";
import { adminDb } from "@/lib/firebase/admin";
import { grantLinkGiftToUserOrPending, grantPlanToUserOrPending } from "@/services/grants";

function getOverrideMs(durationOption: string, customValue?: number, customUnit?: string): number | null {
    switch (durationOption) {
        case "permanent":
            return null;
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

function getGiftExpiry(expiresOption: string, customValue?: number, customUnit?: string): number | null {
    switch (expiresOption) {
        case "no_expiry":
            return null;
        case "1d": return Date.now() + 24 * 60 * 60 * 1000;
        case "5d": return Date.now() + 5 * 24 * 60 * 60 * 1000;
        case "10d": return Date.now() + 10 * 24 * 60 * 60 * 1000;
        case "30d": return Date.now() + 30 * 24 * 60 * 60 * 1000;
        case "custom": {
            if (!customValue || customValue <= 0) return 0;
            const v = customValue;
            switch (customUnit) {
                case "minutes": return Date.now() + v * 60 * 1000;
                case "hours": return Date.now() + v * 60 * 60 * 1000;
                case "days": return Date.now() + v * 24 * 60 * 60 * 1000;
                case "months": return Date.now() + v * 30 * 24 * 60 * 60 * 1000;
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
        const type = body.type === "link_gift" ? "link_gift" : "plan";

        const rawEmail = String(body.email || "").trim().toLowerCase();
        if (!rawEmail) {
            return NextResponse.json({ message: "Email is required" }, { status: 400 });
        }

        // Resolve user by id or email (best-effort)
        let userId: string | null = body.userId || null;
        if (!userId) {
            const snap = await adminDb
                .collection("users")
                .where("email", "==", rawEmail)
                .limit(1)
                .get();
            if (!snap.empty) {
                userId = snap.docs[0].id;
            }
        }

        if (type === "plan") {
            const planId = resolvePlanType(body.plan);
            if (!PLAN_CONFIGS[planId]) {
                return NextResponse.json({ message: "Invalid plan" }, { status: 400 });
            }

            const durationOption = body.durationOption || "30d";
            const overrideMs = getOverrideMs(durationOption, Number(body.customValue), body.customUnit);
            if (overrideMs === 0) {
                return NextResponse.json({ message: "Invalid duration" }, { status: 400 });
            }

            const result = await grantPlanToUserOrPending({
                email: rawEmail,
                userId,
                planId,
                overrideExpiryMs: overrideMs,
                reason: body.reason || "admin_grant",
                adminEmail: admin.email || null,
                durationOption,
                customValue: Number(body.customValue),
                customUnit: body.customUnit,
            });

            return NextResponse.json({ success: true, applied: result.applied, pendingId: result.pendingId });
        }

        // Link gift path
        const quantity = Number(body.quantity || 0);
        if (!quantity || quantity <= 0) {
            return NextResponse.json({ message: "Quantity must be greater than 0" }, { status: 400 });
        }

        const expiresOption = body.expiresOption || "5d";
        const giftExpiry = getGiftExpiry(expiresOption, Number(body.customValue), body.customUnit);
        if (giftExpiry === 0) {
            return NextResponse.json({ message: "Invalid gift expiration" }, { status: 400 });
        }

        const result = await grantLinkGiftToUserOrPending({
            email: rawEmail,
            userId,
            quantity,
            expiresAt: giftExpiry,
            reason: body.reason || "admin_grant",
            adminEmail: admin.email || null,
            durationOption: expiresOption,
            customValue: Number(body.customValue),
            customUnit: body.customUnit,
        });

        return NextResponse.json({ success: true, applied: result.applied, pendingId: result.pendingId });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to grant plan";
        return NextResponse.json({ message }, { status: 400 });
    }
}

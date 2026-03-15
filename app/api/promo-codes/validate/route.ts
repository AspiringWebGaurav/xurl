import { NextRequest, NextResponse } from "next/server";
import { resolvePlanType } from "@/lib/plans";
import { validatePromoCodeForPlan } from "@/services/promo-codes";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const code = typeof body.code === "string" ? body.code : "";
        const planId = resolvePlanType(body.planId);

        const result = await validatePromoCodeForPlan(code, planId);
        if (!result.valid) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to validate promo code.";
        return NextResponse.json({ valid: false, message, reason: "not_found" }, { status: 500 });
    }
}

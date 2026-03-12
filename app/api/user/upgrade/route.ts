import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import { PLAN_CONFIGS, resolvePlanType, isPaidPlan } from "@/lib/plans";
import { applyPlanUpgrade } from "@/services/plan-upgrade";
import type { PlanType } from "@/lib/plans";

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
        }

        const body = await request.json();
        const plan = resolvePlanType(body.plan);
        const orderId = body.orderId;

        if (!PLAN_CONFIGS[plan]) {
            return NextResponse.json({ code: "INVALID_INPUT", message: "Invalid plan specified." }, { status: 400 });
        }

        // Allow downgrade to free without order verification
        if (plan !== "free") {
            // Require a verified paid order for the requested plan
            if (!orderId) {
                return NextResponse.json({ code: "FORBIDDEN", message: "A paid order is required to upgrade." }, { status: 403 });
            }

            const orderSnap = await adminDb.collection("orders").doc(orderId).get();
            if (!orderSnap.exists) {
                return NextResponse.json({ code: "ORDER_NOT_FOUND", message: "Order not found." }, { status: 404 });
            }

            const orderData = orderSnap.data()!;
            if (orderData.userId !== decoded.uid) {
                return NextResponse.json({ code: "FORBIDDEN", message: "Order does not belong to this user." }, { status: 403 });
            }
            if (orderData.status === "consumed") {
                return NextResponse.json({ code: "ORDER_CONSUMED", message: "This order has already been used for an upgrade." }, { status: 409 });
            }
            if (orderData.status !== "paid") {
                return NextResponse.json({ code: "PAYMENT_REQUIRED", message: "Order has not been paid." }, { status: 402 });
            }
            // Resolve legacy plan names in order data too
            if (resolvePlanType(orderData.planId) !== plan) {
                return NextResponse.json({ code: "PLAN_MISMATCH", message: "Order plan does not match requested plan." }, { status: 400 });
            }
        }

        // Atomic read-then-write to prevent race with concurrent webhook/verify
        await applyPlanUpgrade(plan, decoded.uid, orderId);

        logger.info("api_upgrade", `User ${decoded.uid} upgraded to ${plan}`);

        return NextResponse.json({ success: true, plan });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upgrade.";
        logger.error("api_upgrade", message);
        return NextResponse.json({ code: "UPGRADE_FAILED", message }, { status: 500 });
    }
}

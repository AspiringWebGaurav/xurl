import { NextRequest, NextResponse } from "next/server";
import { razorpayService } from "@/services/payments/razorpay";
import { PLAN_CONFIGS, resolvePlanType, getPricePaise } from "@/lib/plans";
import { applyPlanUpgrade } from "@/services/plan-upgrade";
import { logger } from "@/lib/utils/logger";
import type { PlanType } from "@/lib/plans";

export async function POST(request: NextRequest) {
    try {
        const bodyText = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!signature) {
            return NextResponse.json({ error: "Missing signature" }, { status: 400 });
        }

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            logger.error("webhook", "RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting webhook.");
            return NextResponse.json({ error: "Webhook endpoint not configured" }, { status: 503 });
        }

        const isVerified = razorpayService.verifyWebhookSignature(bodyText, signature, secret);

        if (!isVerified) {
            // Strictly enforce signatures
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        const payload = JSON.parse(bodyText);

        // Security: Prevent Replay Attacks (Reject events older than 5 minutes)
        if (payload.created_at) {
            const eventTimestampMs = payload.created_at * 1000;
            if (Date.now() - eventTimestampMs > 5 * 60 * 1000) {
                 logger.warn("webhook_stale", "Received stale webhook, ignoring.");
                 return NextResponse.json({ error: "Stale event" }, { status: 400 });
            }
        }

        if (payload.event === "order.paid" || payload.event === "payment.captured") {
            const paymentEntity = payload.payload.payment.entity;
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;
            const notes = paymentEntity.notes || {};
            const userId = notes.userId;
            const rawPlanId = notes.planId;

            if (!orderId || !userId || !rawPlanId) {
                logger.error("webhook_missing_data", "Missing metadata in webhook");
                return NextResponse.json({ success: true }); // Missing critical info, just 200 to ack
            }

            // Resolve and validate planId against known plans
            const planId = resolvePlanType(rawPlanId);
            if (planId === "free" || !PLAN_CONFIGS[planId]) {
                logger.error("webhook_invalid_plan", `Invalid planId in webhook notes: ${rawPlanId}`);
                return NextResponse.json({ success: true }); // Ack but don't process
            }

            // Security: Validate payment amount matches expected plan price
            if (paymentEntity.amount !== undefined) {
                const expectedAmount = getPricePaise(planId);
                if (Number(paymentEntity.amount) !== expectedAmount) {
                    logger.error("webhook_amount_mismatch", `Amount ${paymentEntity.amount} does not match expected ${expectedAmount} for plan ${planId}`);
                    return NextResponse.json({ success: true }); // Ack but don't process tampered amount
                }
            }

            // Perform idempotent update — mark as "consumed" to prevent double-upgrade
            // via the /user/upgrade endpoint
            // The `applyPlanUpgrade` service handles reading the order to prevent double-upgrade and writes the user update.
            await applyPlanUpgrade(planId, userId, orderId, paymentId);

            logger.info("webhook_processed", `Successfully upgraded user ${userId} to ${planId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("WEBHOOK FATAL:", error);
        logger.error("webhook_error", error instanceof Error ? error.message : "Webhook processing failed");
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

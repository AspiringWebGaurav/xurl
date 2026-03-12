import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { applyPlanUpgrade } from "@/services/plan-upgrade";
import { resolvePlanType } from "@/lib/plans";
import { logger } from "@/lib/utils/logger";
import crypto from "crypto";

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
        const orderId = body.orderId;
        const paymentId = body.paymentId;
        const signature = body.signature;

        if (!orderId) {
            return NextResponse.json({ code: "INVALID_INPUT", message: "Missing orderId" }, { status: 400 });
        }

        const orderSnap = await adminDb.collection("orders").doc(orderId).get();
        if (!orderSnap.exists) {
            return NextResponse.json({ code: "ORDER_NOT_FOUND", message: "Order not found" }, { status: 404 });
        }

        let orderData = orderSnap.data()!;
        if (orderData.userId !== decoded.uid) {
            return NextResponse.json({ code: "FORBIDDEN", message: "Not your order" }, { status: 403 });
        }

        // Synchronous Payment Verification (Fallback/Immediate if webhook hasn't fired)
        if (orderData.status !== "paid" && orderData.status !== "consumed" && paymentId && signature) {
            const secret = process.env.RAZORPAY_KEY_SECRET;
            if (!secret) {
                logger.error("api_payment_verify", "RAZORPAY_KEY_SECRET is not configured.");
                return NextResponse.json({ code: "SERVER_ERROR", message: "Payment verification unavailable." }, { status: 503 });
            }

            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(`${orderId}|${paymentId}`)
                .digest("hex");

            // Timing-safe comparison to prevent timing attacks
            const signaturesMatch = expectedSignature.length === signature.length &&
                crypto.timingSafeEqual(
                    Buffer.from(expectedSignature, "hex"),
                    Buffer.from(signature, "hex")
                );

            if (!signaturesMatch) {
                logger.warn("api_payment_verify", `Invalid signature for order ${orderId} by user ${decoded.uid}`);
                return NextResponse.json({ code: "INVALID_SIGNATURE", message: "Payment signature verification failed." }, { status: 400 });
            }

            // Verified successfully, perform upgrade immediately
            await applyPlanUpgrade(
                resolvePlanType(orderData.planId),
                decoded.uid,
                orderId,
                paymentId
            );
            orderData.status = "consumed"; // reflect update
        }

        return NextResponse.json({ success: true, status: orderData.status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to verify order.";
        logger.error("api_payment_verify", message);
        return NextResponse.json({ code: "VERIFY_FAILED", message }, { status: 500 });
    }
}

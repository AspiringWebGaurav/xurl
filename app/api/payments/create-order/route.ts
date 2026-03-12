import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { razorpayService } from "@/services/payments/razorpay";
import { PLAN_CONFIGS, isPaidPlan, getPricePaise, resolvePlanType } from "@/lib/plans";
import type { PlanType, OrderDocument } from "@/types";
import { logger } from "@/lib/utils/logger";
import { getRedisClient } from "@/lib/redis/client";

// Ensure a user can only create 10 orders per hour
const ORDER_RATE_LIMIT = 10;
const ORDER_RATE_TTL = 3600;

// ─── In-Memory Fallback Rate Limiter (activates when Redis is down) ─────────
const orderFallbackLimiter = new Map<string, { count: number; windowStart: number }>();
const ORDER_FALLBACK_WINDOW_MS = 3600_000; // 1 hour
const ORDER_FALLBACK_MAX_ENTRIES = 5_000;

function isOrderRateLimitedFallback(uid: string): boolean {
    const now = Date.now();
    const entry = orderFallbackLimiter.get(uid);

    if (!entry || now - entry.windowStart >= ORDER_FALLBACK_WINDOW_MS) {
        if (orderFallbackLimiter.size >= ORDER_FALLBACK_MAX_ENTRIES) {
            for (const [key, val] of orderFallbackLimiter) {
                if (now - val.windowStart >= ORDER_FALLBACK_WINDOW_MS) orderFallbackLimiter.delete(key);
                if (orderFallbackLimiter.size < ORDER_FALLBACK_MAX_ENTRIES * 0.8) break;
            }
        }
        orderFallbackLimiter.set(uid, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= ORDER_RATE_LIMIT) return true;
    entry.count++;
    return false;
}

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

        // ----- Security: Rate Limit Order Creation -----
        const redis = await getRedisClient();
        if (redis) {
            const rateKey = `rate_limit:orders:${decoded.uid}`;
            const currentOrdersReq = await redis.incr(rateKey);
            
            if (currentOrdersReq === 1) {
                await redis.expire(rateKey, ORDER_RATE_TTL);
            }
            if (currentOrdersReq > ORDER_RATE_LIMIT) {
                logger.warn("api_payment_create", `User ${decoded.uid} hit order creation rate limit.`);
                return NextResponse.json({ code: "RATE_LIMITED", message: "Too many payment attempts. Please wait an hour." }, { status: 429 });
            }
        } else {
            // Redis is unavailable — use in-memory fallback rate limiter
            if (isOrderRateLimitedFallback(decoded.uid)) {
                logger.warn("api_payment_create", `User ${decoded.uid} hit order creation rate limit (in-memory fallback).`);
                return NextResponse.json({ code: "RATE_LIMITED", message: "Too many payment attempts. Please wait an hour." }, { status: 429 });
            }
        }
        // -----------------------------------------------

        const body = await request.json();
        const planId = resolvePlanType(body.planId);

        if (!isPaidPlan(planId)) {
            return NextResponse.json({ code: "INVALID_PLAN", message: "Invalid plan specified." }, { status: 400 });
        }

        const amountPaise = getPricePaise(planId);

        const order = await razorpayService.createOrder({
            userId: decoded.uid,
            planId,
            amount: amountPaise,
            currency: "INR"
        });

        const orderDoc: OrderDocument = {
            orderId: order.id,
            userId: decoded.uid,
            planId,
            amount: amountPaise,
            currency: "INR",
            status: "created",
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Initialize tracking document
        await adminDb.collection("orders").doc(order.id).set(orderDoc);

        logger.info("payment_order_created", `Order ${order.id} created for user ${decoded.uid} plan ${planId}`);

        return NextResponse.json({ success: true, orderId: order.id, amount: amountPaise, currency: "INR" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create order.";
        logger.error("api_payment_create", message);
        return NextResponse.json({ code: "ORDER_CREATE_FAILED", message }, { status: 500 });
    }
}

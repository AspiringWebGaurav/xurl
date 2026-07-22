import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { razorpayService } from "@/services/payments/razorpay";
import { getPricePaise, isPaidPlan, resolvePlanType } from "@/lib/plans";
import { getComputedPlanConfig, getBestActiveOffer, calculateDiscountedPrice } from "@/lib/services/dynamic-config";
import type { OrderDocument } from "@/types";
import { logger } from "@/lib/utils/logger";
import { getRedisClient } from "@/lib/redis/client";
import { validatePromoCodeForPlan } from "@/services/promo-codes";
import { getDevModeForUser, isDevEnvironment, isDeveloperEmail } from "@/lib/dev-mode";
import { applyPlanUpgrade } from "@/services/plan-upgrade";

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
        const promoCode = typeof body.promoCode === "string" ? body.promoCode : null;

        if (!isPaidPlan(planId)) {
            return NextResponse.json({ code: "INVALID_PLAN", message: "Invalid plan specified." }, { status: 400 });
        }

        const promoValidation = promoCode
            ? await validatePromoCodeForPlan(promoCode, planId, decoded.uid)
            : null;

        if (promoValidation && !promoValidation.valid) {
            return NextResponse.json(
                { code: "INVALID_PROMO", message: promoValidation.message, reason: promoValidation.reason },
                { status: 400 }
            );
        }

        // --- Dynamic Pricing & Best Price Wins Logic ---
        const dynamicPlanConfig = await getComputedPlanConfig(planId);
        const dynamicPriceINR = dynamicPlanConfig.priceINR;
        const baseAmountPaise = Math.round(dynamicPriceINR * 100);

        const globalOffer = await getBestActiveOffer(dynamicPriceINR);

        let finalAmountPaise = baseAmountPaise;
        let globalDiscountPaise = 0;
        
        if (globalOffer) {
            const discountedINR = calculateDiscountedPrice(dynamicPriceINR, globalOffer);
            globalDiscountPaise = baseAmountPaise - Math.round(discountedINR * 100);
            finalAmountPaise -= globalDiscountPaise;
        }

        let promoDiscountPaise = 0;
        if (promoValidation?.valid) {
            if (promoValidation.discountType === "free_plan") {
                promoDiscountPaise = finalAmountPaise;
            } else if (promoValidation.discountType === "percentage") {
                // Multiplicative stacking: apply percentage to the remaining amount
                promoDiscountPaise = Math.round(finalAmountPaise * (promoValidation.discountValue / 100));
            } else if (promoValidation.discountType === "fixed") {
                promoDiscountPaise = Math.round(promoValidation.discountValue * 100);
            }
            // Cap promo discount to the remaining amount
            promoDiscountPaise = Math.min(promoDiscountPaise, finalAmountPaise);
            finalAmountPaise -= promoDiscountPaise;
        }

        const finalDiscountAmount = baseAmountPaise - finalAmountPaise;

        let appliedPromoCode: string | null = null;
        let appliedPromoType: string | null = null;
        let appliedPromoValue: number | null = null;
        let appliedPromoId: string | null = null;

        if (promoValidation?.valid) {
            appliedPromoCode = promoValidation.code;
            appliedPromoType = promoValidation.discountType;
            appliedPromoValue = promoValidation.discountValue;
            appliedPromoId = promoValidation.promoId;
        } else if (globalOffer) {
            appliedPromoCode = `GLOBAL_OFFER_${globalOffer.id}`;
            appliedPromoType = globalOffer.type;
            appliedPromoValue = globalOffer.value;
            appliedPromoId = globalOffer.id || null;
        }

        const now = Date.now();

        // ─── Developer Mode: Simulate successful payment without Razorpay ─────
        const devModeActive =
            isDevEnvironment() &&
            isDeveloperEmail(decoded.email || null) &&
            (await getDevModeForUser(decoded.uid));

        if (devModeActive) {
            const syntheticOrderId = `devmode-${decoded.uid}-${now}`;
            const orderDoc: OrderDocument = {
                orderId: syntheticOrderId,
                userId: decoded.uid,
                planId,
                amount: finalAmountPaise,
                baseAmount: baseAmountPaise,
                discountAmount: finalDiscountAmount,
                promoCodeId: appliedPromoId,
                promoCode: appliedPromoCode,
                promoDiscountType: appliedPromoType as any,
                promoDiscountValue: appliedPromoValue,
                currency: "INR",
                status: "paid",
                source: "developer_mode",
                createdAt: now,
                updatedAt: now,
            };

            await adminDb.collection("orders").doc(syntheticOrderId).set(orderDoc);

            await applyPlanUpgrade(planId, decoded.uid, syntheticOrderId, `devmode-${now}`, undefined, {
                source: "developer_mode",
                amountPaise: 0,
            });

            logger.info(
                "payment_order_dev_mode",
                `Developer mode simulated upgrade for user ${decoded.uid} plan ${planId}`
            );

            return NextResponse.json({
                success: true,
                orderId: syntheticOrderId,
                amount: 0,
                currency: "INR",
                pricing: {
                    originalAmount: orderDoc.baseAmount,
                    discountAmount: orderDoc.discountAmount,
                    finalAmount: 0,
                    promoCode: orderDoc.promoCode,
                },
                developerMode: true,
            });
        }

        // ─── Free Fulfillment (100% Promo Code Bypass) ──────────────────────
        if (finalAmountPaise === 0 && promoValidation?.valid) {
            const syntheticOrderId = `free-${decoded.uid}-${now}`;
            const orderDoc: OrderDocument = {
                orderId: syntheticOrderId,
                userId: decoded.uid,
                planId,
                amount: 0,
                baseAmount: baseAmountPaise,
                discountAmount: finalDiscountAmount,
                promoCodeId: appliedPromoId,
                promoCode: appliedPromoCode,
                promoDiscountType: appliedPromoType as any,
                promoDiscountValue: appliedPromoValue,
                currency: "INR",
                status: "paid",
                source: "promo_free",
                createdAt: now,
                updatedAt: now,
            };

            await adminDb.collection("orders").doc(syntheticOrderId).set(orderDoc);

            await applyPlanUpgrade(planId, decoded.uid, syntheticOrderId, `free-${now}`, undefined, {
                source: "promo_free",
                amountPaise: 0,
            });

            logger.info(
                "payment_order_free_fulfillment",
                `100% Promo Code applied for user ${decoded.uid} plan ${planId}`
            );

            return NextResponse.json({
                success: true,
                orderId: syntheticOrderId,
                amount: 0,
                currency: "INR",
                pricing: {
                    originalAmount: orderDoc.baseAmount,
                    discountAmount: orderDoc.discountAmount,
                    finalAmount: 0,
                    promoCode: orderDoc.promoCode,
                },
                freeFulfillment: true,
                planId: planId
            });
        }

        // ─── Normal Razorpay flow (production + non-dev users) ────────────────
        const order = await razorpayService.createOrder({
            userId: decoded.uid,
            planId,
            amount: finalAmountPaise,
            currency: "INR",
            notes: appliedPromoCode
                ? {
                    promoCode: appliedPromoCode,
                    promoDiscountType: appliedPromoType ?? "",
                    promoDiscountValue: String(appliedPromoValue ?? ""),
                }
                : undefined,
        });

        const orderDoc: OrderDocument = {
            orderId: order.id,
            userId: decoded.uid,
            planId,
            amount: finalAmountPaise,
            baseAmount: baseAmountPaise,
            discountAmount: finalDiscountAmount,
            promoCodeId: appliedPromoId,
            promoCode: appliedPromoCode,
            promoDiscountType: appliedPromoType as any,
            promoDiscountValue: appliedPromoValue,
            currency: "INR",
            status: "created",
            createdAt: now,
            updatedAt: now
        };

        // Initialize tracking document
        await adminDb.collection("orders").doc(order.id).set(orderDoc);

        logger.info("payment_order_created", `Order ${order.id} created for user ${decoded.uid} plan ${planId}`);

        return NextResponse.json({
            success: true,
            orderId: order.id,
            amount: finalAmountPaise,
            currency: "INR",
            pricing: {
                originalAmount: orderDoc.baseAmount,
                discountAmount: orderDoc.discountAmount,
                finalAmount: orderDoc.amount,
                promoCode: orderDoc.promoCode,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create order.";
        logger.error("api_payment_create", message);
        return NextResponse.json({ code: "ORDER_CREATE_FAILED", message }, { status: 500 });
    }
}

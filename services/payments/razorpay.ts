import crypto from "crypto";
import { PaymentService, CreateOrderParams, OrderResponse } from "./types";
import Razorpay from "razorpay";

export class RazorpayService implements PaymentService {
    private client: InstanceType<typeof Razorpay>;

    constructor() {
        const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;

        if (!key_id || !key_secret) {
            if (process.env.NODE_ENV === "production") {
                throw new Error("FATAL: NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in production.");
            }
            console.warn("⚠️ Razorpay credentials not configured. Payment features will be unavailable.");
        }

        this.client = new Razorpay({
            key_id: key_id || "missing_key_id",
            key_secret: key_secret || "missing_key_secret"
        });
    }

    async createOrder(params: CreateOrderParams): Promise<OrderResponse> {
        const options = {
            amount: params.amount, // amount in smallest currency unit (e.g. paise for INR)
            currency: params.currency || "INR",
            receipt: `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            notes: {
                userId: params.userId,
                planId: params.planId,
            }
        };

        // 10s timeout to prevent indefinite hangs from slow Razorpay API
        const order = await Promise.race([
            this.client.orders.create(options),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Razorpay order creation timed out (10s)")), 10_000)
            ),
        ]);

        // Map Razorpay's return type to our internal type
        return {
            id: order.id,
            amount: Number(order.amount),
            currency: order.currency || "INR",
            status: order.status
        };
    }

    verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(body.toString())
            .digest("hex");

        // Timing-safe comparison to prevent timing attacks
        if (expectedSignature.length !== signature.length) return false;
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(signature, "hex")
        );
    }
}

export const razorpayService = new RazorpayService();

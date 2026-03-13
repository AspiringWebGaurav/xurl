import { PlanType } from "@/types";

export interface CreateOrderParams {
    userId: string;
    planId: PlanType;
    amount: number;
    currency?: string;
}

export interface OrderResponse {
    id: string; // The gateway's order ID
    amount: number;
    currency: string;
    status: string;
}

export interface WebhookEvent {
    eventId: string;
    eventBody: Record<string, unknown>;
}

export interface PaymentService {
    createOrder(params: CreateOrderParams): Promise<OrderResponse>;
    verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
}

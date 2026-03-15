import { randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import type { ApiLogDocument } from "@/types";

export interface ApiLogInput {
    requestId?: string;
    userId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    ip: string;
    quotaUsage: number;
    quotaTotal: number;
}

export function createApiRequestId(): string {
    return `req_${randomUUID().replace(/-/g, "")}`;
}

export async function logApiRequest(input: ApiLogInput): Promise<void> {
    const entry: ApiLogDocument = {
        requestId: input.requestId || createApiRequestId(),
        userId: input.userId,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        responseTimeMs: input.responseTimeMs,
        ip: input.ip,
        quotaUsage: input.quotaUsage,
        quotaTotal: input.quotaTotal,
        createdAt: Date.now(),
    };

    try {
        await adminDb.collection("api_logs").doc(entry.requestId).set(entry);
    } catch (error) {
        logger.error("api_log_write", "Failed to persist API log", {
            requestId: entry.requestId,
            userId: entry.userId,
            endpoint: entry.endpoint,
            error: String(error),
        });
    }
}

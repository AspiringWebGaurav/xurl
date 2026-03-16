import { randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
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
        try {
            await writeActivityEvent({
                type: "API_REQUEST",
                actor: entry.userId,
                sourceCollection: "api_logs",
                metadata: {
                    requestId: entry.requestId,
                    endpoint: entry.endpoint,
                    method: entry.method,
                    statusCode: entry.statusCode,
                    responseTimeMs: entry.responseTimeMs,
                    ip: entry.ip,
                    quotaUsage: entry.quotaUsage,
                    quotaTotal: entry.quotaTotal,
                },
                severity: entry.statusCode >= 500 || entry.statusCode === 401 || entry.statusCode === 403 ? "SECURITY" : entry.endpoint.startsWith("/api/admin") || entry.endpoint.startsWith("/api/dev") ? "ADMIN" : entry.endpoint.startsWith("/api/payments") || entry.endpoint.startsWith("/api/user/upgrade") ? "BILLING" : "INFO",
            });
        } catch (error) {
            logger.error("activity_event_write", "Failed to write API_REQUEST event", {
                requestId: entry.requestId,
                userId: entry.userId,
                endpoint: entry.endpoint,
                error: String(error),
            });
        }
    } catch (error) {
        logger.error("api_log_write", "Failed to persist API log", {
            requestId: entry.requestId,
            userId: entry.userId,
            endpoint: entry.endpoint,
            error: String(error),
        });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/logging";
import { deleteLink, getLinkBySlug } from "@/services/links";

function getRequestIp(request: NextRequest): string {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function queueLog(params: {
    requestId: string;
    userId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    startTime: number;
    ip: string;
    quotaUsage: number;
    quotaTotal: number;
}) {
    void logApiRequest({
        requestId: params.requestId,
        userId: params.userId,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        responseTimeMs: Date.now() - params.startTime,
        ip: params.ip,
        quotaUsage: params.quotaUsage,
        quotaTotal: params.quotaTotal,
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const startTime = Date.now();
    const ip = getRequestIp(request);
    const auth = await authenticateApiRequest(request.headers.get("authorization"));

    if (!auth.ok) {
        queueLog({
            requestId: auth.requestId,
            userId: "unknown",
            endpoint: "/api/v1/links/[id]",
            method: "DELETE",
            statusCode: auth.status,
            startTime,
            ip,
            quotaUsage: 0,
            quotaTotal: 0,
        });
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    let statusCode = 200;

    try {
        const link = await getLinkBySlug(id);
        if (!link) {
            statusCode = 404;
            queueLog({
                requestId: auth.requestId,
                userId: auth.userId,
                endpoint: `/api/v1/links/${id}`,
                method: "DELETE",
                statusCode,
                startTime,
                ip,
                quotaUsage: auth.quotaUsage,
                quotaTotal: auth.quotaTotal,
            });
            return NextResponse.json({ error: "Link not found" }, { status: statusCode });
        }

        if (link.userId !== auth.userId) {
            statusCode = 403;
            queueLog({
                requestId: auth.requestId,
                userId: auth.userId,
                endpoint: `/api/v1/links/${id}`,
                method: "DELETE",
                statusCode,
                startTime,
                ip,
                quotaUsage: auth.quotaUsage,
                quotaTotal: auth.quotaTotal,
            });
            return NextResponse.json({ error: "Unauthorized access to this link" }, { status: statusCode });
        }

        await deleteLink(id, auth.userId);

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: `/api/v1/links/${id}`,
            method: "DELETE",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete link";
        if (message.includes("Unauthorized")) {
            statusCode = 403;
        } else if (message.includes("not found")) {
            statusCode = 404;
        } else {
            statusCode = 500;
        }

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: `/api/v1/links/${id}`,
            method: "DELETE",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({ error: message }, { status: statusCode });
    }
}

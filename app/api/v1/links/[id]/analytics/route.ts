import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/logging";
import { getLinkAnalytics } from "@/services/analytics";
import { getLinkBySlug } from "@/services/links";

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

export async function GET(
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
            endpoint: "/api/v1/links/[id]/analytics",
            method: "GET",
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
                endpoint: `/api/v1/links/${id}/analytics`,
                method: "GET",
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
                endpoint: `/api/v1/links/${id}/analytics`,
                method: "GET",
                statusCode,
                startTime,
                ip,
                quotaUsage: auth.quotaUsage,
                quotaTotal: auth.quotaTotal,
            });
            return NextResponse.json({ error: "Unauthorized access to this link" }, { status: statusCode });
        }

        const analytics = await getLinkAnalytics(id, 30);
        const countryTotals = analytics.reduce<Record<string, number>>((acc, day) => {
            Object.entries(day.countries || {}).forEach(([country, count]) => {
                acc[country] = (acc[country] || 0) + count;
            });
            return acc;
        }, {});

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: `/api/v1/links/${id}/analytics`,
            method: "GET",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({
            id,
            clicks: link.totalClicks || 0,
            countries: Object.entries(countryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([country]) => country),
            timeline: analytics.map((day) => ({
                date: day.date,
                clicks: day.clicks,
                uniqueVisitors: day.uniqueVisitors,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch analytics";
        statusCode = statusCode === 200 ? 500 : statusCode;

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: `/api/v1/links/${id}/analytics`,
            method: "GET",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({ error: message }, { status: statusCode });
    }
}

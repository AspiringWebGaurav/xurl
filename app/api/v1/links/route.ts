import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/logging";
import { createLink, getUserLinks } from "@/services/links";
import { buildShortUrl } from "@/lib/utils/url-builder";

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

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const ip = getRequestIp(request);
    const auth = await authenticateApiRequest(request.headers.get("authorization"));

    if (!auth.ok) {
        queueLog({
            requestId: auth.requestId,
            userId: "unknown",
            endpoint: "/api/v1/links",
            method: "POST",
            statusCode: auth.status,
            startTime,
            ip,
            quotaUsage: 0,
            quotaTotal: 0,
        });
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let statusCode = 201;

    try {
        const body = await request.json();
        const url = typeof body.url === "string" ? body.url : "";
        const title = typeof body.title === "string" ? body.title : undefined;
        const customSlug = typeof body.customSlug === "string" ? body.customSlug : undefined;

        if (!url) {
            statusCode = 400;
            queueLog({
                requestId: auth.requestId,
                userId: auth.userId,
                endpoint: "/api/v1/links",
                method: "POST",
                statusCode,
                startTime,
                ip,
                quotaUsage: auth.quotaUsage,
                quotaTotal: auth.quotaTotal,
            });
            return NextResponse.json({ error: "URL is required" }, { status: statusCode });
        }

        const created = await createLink(auth.userId, {
            originalUrl: url,
            title,
            customSlug,
        });

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "POST",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json(
            {
                id: created.slug,
                shortUrl: created.shortUrl,
                url: created.originalUrl,
                createdAt: created.createdAt,
            },
            { status: statusCode }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create link";

        if (message.includes("already taken") || message.includes("already exists")) {
            statusCode = 409;
        } else if (message.includes("Rate limit")) {
            statusCode = 429;
        } else if (message.includes("limit") || message.includes("Upgrade")) {
            statusCode = 403;
        } else {
            statusCode = 400;
        }

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "POST",
            statusCode,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({ error: message }, { status: statusCode });
    }
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const ip = getRequestIp(request);
    const auth = await authenticateApiRequest(request.headers.get("authorization"));

    if (!auth.ok) {
        queueLog({
            requestId: auth.requestId,
            userId: "unknown",
            endpoint: "/api/v1/links",
            method: "GET",
            statusCode: auth.status,
            startTime,
            ip,
            quotaUsage: 0,
            quotaTotal: 0,
        });
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const cursorParam = parseInt(searchParams.get("cursor") || "", 10);
    const limit = Number.isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);
    const cursor = Number.isNaN(cursorParam) ? undefined : cursorParam;

    try {
        const result = await getUserLinks(auth.userId, limit, cursor);
        const now = Date.now();

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "GET",
            statusCode: 200,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({
            data: result.links.map((link) => ({
                id: link.slug,
                shortUrl: buildShortUrl(link.slug),
                url: link.originalUrl,
                title: link.title,
                clicks: link.totalClicks || 0,
                createdAt: link.createdAt,
                expiresAt: link.expiresAt,
                status: !link.isActive ? "deactivated" : link.expiresAt && link.expiresAt <= now ? "expired" : "active",
            })),
            pagination: {
                limit,
                nextCursor: result.lastDoc ? result.lastDoc.get("createdAt") : null,
                hasMore: result.links.length === limit,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch links";

        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "GET",
            statusCode: 500,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

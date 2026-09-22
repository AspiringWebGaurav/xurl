import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/logging";
import { evaluateApiProtection, detectMaliciousPayload, recordApiAbuse } from "@/lib/api/protection";
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

/**
 * Parse developer-friendly expiration inputs from various formats:
 * - `expiresAt`: Unix timestamp (ms or s) or ISO 8601 date string
 * - `expiresIn`: Number of seconds, or duration string (e.g. "60s", "1m", "2m", "1h", "24h", "7d")
 * - `ttlSeconds` / `ttl_seconds`: Number
 * - `ttlMinutes` / `ttl_minutes`: Number
 * - `ttlHours` / `ttl_hours`: Number
 * - `ttlDays` / `ttl_days`: Number
 * - `ttlMs` / `ttl_ms`: Number
 * - `permanent`: Boolean (true = explicit permanent link)
 */
export function parseApiExpiration(body: Record<string, any>): { expiresAt?: number | null; error?: string } {
    const now = Date.now();

    // Explicit permanent request
    if (body.permanent === true || body.expiresAt === null || body.expiresIn === null) {
        return { expiresAt: null };
    }

    // 1. Direct expiresAt
    if (body.expiresAt !== undefined) {
        if (typeof body.expiresAt === "number") {
            let ts = body.expiresAt;
            // Detect Unix timestamp in seconds vs milliseconds
            if (ts < 100_000_000_000) {
                ts = ts * 1000;
            }
            if (ts <= now) {
                return { error: "expiresAt must be a timestamp in the future." };
            }
            return { expiresAt: ts };
        }
        if (typeof body.expiresAt === "string") {
            const parsed = Date.parse(body.expiresAt);
            if (isNaN(parsed)) {
                return { error: "Invalid expiresAt date format. Use ISO 8601 string or Unix timestamp." };
            }
            if (parsed <= now) {
                return { error: "expiresAt date must be in the future." };
            }
            return { expiresAt: parsed };
        }
        return { error: "expiresAt must be a valid number or ISO date string." };
    }

    // 2. Relative ttlMs / ttl_ms
    const ttlMs = body.ttlMs ?? body.ttl_ms;
    if (typeof ttlMs === "number") {
        if (ttlMs <= 0) return { error: "ttlMs must be greater than 0." };
        return { expiresAt: now + ttlMs };
    }

    // 3. Relative ttlSeconds / ttl_seconds
    const ttlSeconds = body.ttlSeconds ?? body.ttl_seconds;
    if (typeof ttlSeconds === "number") {
        if (ttlSeconds <= 0) return { error: "ttlSeconds must be greater than 0." };
        return { expiresAt: now + Math.round(ttlSeconds * 1000) };
    }

    // 4. Relative ttlMinutes / ttl_minutes
    const ttlMinutes = body.ttlMinutes ?? body.ttl_minutes;
    if (typeof ttlMinutes === "number") {
        if (ttlMinutes <= 0) return { error: "ttlMinutes must be greater than 0." };
        return { expiresAt: now + Math.round(ttlMinutes * 60 * 1000) };
    }

    // 5. Relative ttlHours / ttl_hours
    const ttlHours = body.ttlHours ?? body.ttl_hours;
    if (typeof ttlHours === "number") {
        if (ttlHours <= 0) return { error: "ttlHours must be greater than 0." };
        return { expiresAt: now + Math.round(ttlHours * 3600 * 1000) };
    }

    // 6. Relative ttlDays / ttl_days
    const ttlDays = body.ttlDays ?? body.ttl_days;
    if (typeof ttlDays === "number") {
        if (ttlDays <= 0) return { error: "ttlDays must be greater than 0." };
        return { expiresAt: now + Math.round(ttlDays * 86400 * 1000) };
    }

    // 7. expiresIn (number of seconds or duration string like "2m", "1h", "60s")
    if (body.expiresIn !== undefined) {
        if (typeof body.expiresIn === "number") {
            if (body.expiresIn <= 0) return { error: "expiresIn must be greater than 0." };
            return { expiresAt: now + Math.round(body.expiresIn * 1000) };
        }
        if (typeof body.expiresIn === "string") {
            const match = body.expiresIn.trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|d|days?|w|weeks?|mo|months?|y|years?)$/i);
            if (!match) {
                return { error: `Invalid expiresIn format "${body.expiresIn}". Examples: "30s", "2m", "1h", "7d".` };
            }
            const val = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            let mult = 1000;
            if (unit.startsWith("s")) mult = 1000;
            else if (unit.startsWith("m") && !unit.startsWith("mo")) mult = 60 * 1000;
            else if (unit.startsWith("h")) mult = 3600 * 1000;
            else if (unit.startsWith("d")) mult = 86400 * 1000;
            else if (unit.startsWith("w")) mult = 7 * 86400 * 1000;
            else if (unit.startsWith("mo")) mult = 30 * 86400 * 1000;
            else if (unit.startsWith("y")) mult = 365 * 86400 * 1000;

            if (val <= 0) return { error: "expiresIn duration must be greater than 0." };
            return { expiresAt: now + Math.round(val * mult) };
        }
        return { error: "expiresIn must be a number of seconds or duration string (e.g. '2m', '1h')." };
    }

    return {};
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const ip = getRequestIp(request);
    const auth = await authenticateApiRequest(request.headers.get("authorization"));

    if (!auth.ok) {
        void recordApiAbuse(ip, 2);
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

    // Evaluate rate limiting and abuse prevention (burst + minute limits)
    const protection = await evaluateApiProtection({
        ip,
        apiKeyHash: auth.apiKeyHash,
        userId: auth.userId,
        plan: auth.plan,
    });

    if (!protection.allowed) {
        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "POST",
            statusCode: protection.status,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });
        return NextResponse.json({ error: protection.error }, { status: protection.status });
    }

    let statusCode = 201;

    try {
        const body = await request.json().catch(() => ({}));
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

        // Anti-hacking & malicious payload detection (SSRF, dangerous protocols, script injections)
        const payloadCheck = detectMaliciousPayload({ url, customSlug, title });
        if (!payloadCheck.safe) {
            void recordApiAbuse(ip, 5);
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
            return NextResponse.json({ error: payloadCheck.reason || "Malicious payload detected." }, { status: statusCode });
        }

        // Parse custom expiration (supports 1m, 2m, ttlMinutes, expiresAt, etc.)
        const expCheck = parseApiExpiration(body);
        if (expCheck.error) {
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
            return NextResponse.json({ error: expCheck.error }, { status: statusCode });
        }

        const created = await createLink(
            auth.userId,
            {
                originalUrl: url,
                title,
                customSlug,
                expiresAt: expCheck.expiresAt,
                deviceType: "api",
            },
            { isApi: true, plan: auth.plan }
        );

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
                expiresAt: created.expiresAt ?? null,
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
        void recordApiAbuse(ip, 2);
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

    // Evaluate protection on GET requests as well
    const protection = await evaluateApiProtection({
        ip,
        apiKeyHash: auth.apiKeyHash,
        userId: auth.userId,
        plan: auth.plan,
    });

    if (!protection.allowed) {
        queueLog({
            requestId: auth.requestId,
            userId: auth.userId,
            endpoint: "/api/v1/links",
            method: "GET",
            statusCode: protection.status,
            startTime,
            ip,
            quotaUsage: auth.quotaUsage,
            quotaTotal: auth.quotaTotal,
        });
        return NextResponse.json({ error: protection.error }, { status: protection.status });
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

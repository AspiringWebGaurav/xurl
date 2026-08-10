import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { evaluateRequest } from "@/lib/redis/protection";

// Max 1.5 KB payload cap
const MAX_PAYLOAD_BYTES = 1536;

// In-memory sliding window rate limiter fallback: max 5 requests / min / IP
const telemetryRateLimiter = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const MAX_RATE_LIMITER_ENTRIES = 5_000;

function isTelemetryRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = telemetryRateLimiter.get(ip);

    if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
        if (telemetryRateLimiter.size >= MAX_RATE_LIMITER_ENTRIES) {
            for (const [key, val] of telemetryRateLimiter) {
                if (now - val.windowStart >= RATE_LIMIT_WINDOW_MS) telemetryRateLimiter.delete(key);
                if (telemetryRateLimiter.size < MAX_RATE_LIMITER_ENTRIES * 0.8) break;
            }
        }
        telemetryRateLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return true;
    }

    entry.count++;
    return false;
}

function sanitizeString(val: unknown, maxLen: number): string {
    if (typeof val !== "string") return "";
    // Strip absolute Windows/Unix filesystem paths and raw bearer/tokens
    const sanitized = val
        .replace(/(?:[a-zA-Z]:\\|\/)[^\s:]+/g, "[file_path]")
        .replace(/(?:Bearer\s+|token=)[a-zA-Z0-9._-]+/gi, "[token_redacted]");
    return sanitized.trim().slice(0, maxLen);
}

function sanitizeRoute(rawRoute: unknown): string {
    if (typeof rawRoute !== "string") return "/";
    try {
        // Enforce pathname ONLY (strictly strip search query params and hash fragments)
        const parsed = new URL(rawRoute, "https://xurl.internal");
        return parsed.pathname.slice(0, 100);
    } catch {
        const pathOnly = rawRoute.split("?")[0].split("#")[0];
        return (pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`).slice(0, 100);
    }
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        // 1. In-memory Rate Limiting Check (Max 5 req/min/IP)
        if (isTelemetryRateLimited(ip)) {
            return NextResponse.json({ code: "RATE_LIMITED", message: "Too many telemetry reports" }, { status: 429 });
        }

        // 2. Redis Protection Check Fallback
        const gatewayResult = await evaluateRequest(ip, "public_anon", 5);
        if (gatewayResult.state === "BLOCK") {
            return NextResponse.json({ code: "RATE_LIMITED", message: "Too many telemetry reports" }, { status: 429 });
        }

        // 3. Payload Size Check
        const rawText = await request.text();
        if (!rawText || rawText.length > MAX_PAYLOAD_BYTES) {
            return NextResponse.json({ code: "PAYLOAD_TOO_LARGE", message: "Payload size exceeds limit" }, { status: 400 });
        }

        let body: Record<string, unknown>;
        try {
            body = JSON.parse(rawText);
        } catch {
            return NextResponse.json({ code: "INVALID_JSON", message: "Malformed JSON payload" }, { status: 400 });
        }

        // 4. Sanitize Whitelisted Telemetry Fields
        const errorName = sanitizeString(body.errorName, 50) || "Error";
        const rawMessage = sanitizeString(body.message, 150) || "Uncaught client exception";
        const route = sanitizeRoute(body.route);
        const stackSnippet = sanitizeString(body.stackSnippet, 300);
        const browserSummary = sanitizeString(body.browserSummary, 50) || "Unknown Browser";

        // Reject if message looks like expected API / validation error
        if (
            rawMessage.includes("RATE_LIMITED") ||
            rawMessage.includes("GUEST_LIMIT") ||
            rawMessage.includes("UNAUTHORIZED") ||
            rawMessage.includes("FORBIDDEN")
        ) {
            return NextResponse.json({ success: true, ignored: true });
        }

        // 5. Forward to Structured Server Logger (stdout/stderr only - 0 DB writes)
        logger.error("client_uncaught_error", `${errorName}: ${rawMessage}`, {
            errorName,
            route,
            stackSnippet,
            browserSummary,
            ip,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        // Telemetry receiver failures must fail open silently
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}

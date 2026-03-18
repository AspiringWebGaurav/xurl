import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/services/analytics";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

// ─── Rate limiter for click recording (self-cleaning) ──────────────────────────
const clickLimiter = new Map<string, { count: number; windowStart: number }>();
const CLICK_WINDOW_MS = 60_000;
const MAX_CLICKS_PER_MIN = 60; // 60 clicks per minute per IP
const MAX_LIMITER_ENTRIES = 10_000;

function isClickRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = clickLimiter.get(ip);

    if (!entry || now - entry.windowStart >= CLICK_WINDOW_MS) {
        if (clickLimiter.size >= MAX_LIMITER_ENTRIES) {
            for (const [key, val] of clickLimiter) {
                if (now - val.windowStart >= CLICK_WINDOW_MS) clickLimiter.delete(key);
                if (clickLimiter.size < MAX_LIMITER_ENTRIES * 0.8) break;
            }
        }
        clickLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= MAX_CLICKS_PER_MIN) return true;
    entry.count++;
    return false;
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (isClickRateLimited(ip)) {
            return NextResponse.json({ success: true }); // Silently accept but don't record
        }

        const body = await request.json();
        const { slug, referrer, country, userAgent } = body;

        if (!slug || typeof slug !== "string") {
            return new NextResponse("Missing slug", { status: 400 });
        }

        // Validate slug format to prevent injection
        if (!/^[a-zA-Z0-9-]{1,30}$/.test(slug)) {
            return new NextResponse("Invalid slug", { status: 400 });
        }

        // Fire-and-forget analytics
        recordClick(slug, {
            referrer: typeof referrer === "string" ? referrer.slice(0, 500) : undefined,
            country: typeof country === "string" ? country.slice(0, 10) : undefined,
            userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : undefined,
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("analytics_click_error", "Failed to record analytics click", {
            error: error instanceof Error ? error.message : String(error),
        });
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}


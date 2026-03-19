import { NextRequest, NextResponse } from "next/server";
import { checkGuestLimit } from "@/services/guest";

// ─── Rate limiter for guest-status checks (self-cleaning) ────────────────
const guestStatusLimiter = new Map<string, { count: number; windowStart: number }>();
const GS_WINDOW_MS = 60_000;
const GS_MAX_REQUESTS = 30;
const GS_MAX_ENTRIES = 5_000;

function isGuestStatusRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = guestStatusLimiter.get(ip);

    if (!entry || now - entry.windowStart >= GS_WINDOW_MS) {
        if (guestStatusLimiter.size >= GS_MAX_ENTRIES) {
            for (const [key, val] of guestStatusLimiter) {
                if (now - val.windowStart >= GS_WINDOW_MS) guestStatusLimiter.delete(key);
                if (guestStatusLimiter.size < GS_MAX_ENTRIES * 0.8) break;
            }
        }
        guestStatusLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= GS_MAX_REQUESTS) return true;
    entry.count++;
    return false;
}

/**
 * GET /api/guest-status
 *
 * Server-synced guest state check.
 * Returns the guest's active link details if one exists,
 * or { active: false } if the guest is free to create a new link.
 *
 * Uses IP + fingerprint to identify the guest — no localStorage trust.
 */
export async function GET(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    if (isGuestStatusRateLimited(ip)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const fingerprint = request.headers.get("x-device-fingerprint") || undefined;

    const status = await checkGuestLimit(ip, fingerprint);

    if (!status.allowed && status.slug) {
        return NextResponse.json({
            active: true,
            slug: status.slug,
            originalUrl: status.originalUrl,
            createdAt: status.createdAt,
            expiresIn: status.expiresIn,
        });
    }

    return NextResponse.json({ active: false });
}

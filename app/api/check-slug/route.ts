import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// ─── Rate limiter for slug checks (self-cleaning) ──────────────────────────

const slugCheckLimiter = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_CHECKS = 30; // 30 checks per minute per IP
const MAX_ENTRIES = 5_000;

const RESERVED_SLUGS = new Set([
    "api", "login", "expired", "_next", "not-found",
    "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
    "sw.js", "workbox", "vercel", ".well-known",
    "admin", "dashboard", "settings", "preview", "terms",
    "privacy", "acceptable-use", "about", "contact", "help", "support", "docs",
    "profile", "purchase-history", "pricing", "guest-policy", "placeholder", "r"
]);

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = slugCheckLimiter.get(ip);

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
        // Self-clean when at capacity
        if (slugCheckLimiter.size >= MAX_ENTRIES) {
            for (const [key, val] of slugCheckLimiter) {
                if (now - val.windowStart >= WINDOW_MS) slugCheckLimiter.delete(key);
                if (slugCheckLimiter.size < MAX_ENTRIES * 0.8) break;
            }
        }
        slugCheckLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= MAX_CHECKS) return true;
    entry.count++;
    return false;
}

export async function GET(request: NextRequest) {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // Alphanumeric + hyphens validation
    if (!/^[a-zA-Z0-9-]{2,30}$/.test(slug)) {
        return NextResponse.json({ available: false }, { status: 400 });
    }

    if (RESERVED_SLUGS.has(slug.toLowerCase())) {
        return NextResponse.json({ available: false });
    }

    try {
        const snap = await adminDb.collection("links").doc(slug).get();
        return NextResponse.json({ available: !snap.exists });
    } catch (e) {
        console.error("Check slug error:", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

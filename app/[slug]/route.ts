/**
 * Redirect handler — looks up Firestore doc by slug (document ID),
 * checks expiration, and redirects to the original URL.
 * Implements in-memory layer-2 caching to reduce Firestore reads.
 *
 * Security hardening:
 * - Per-IP rate limiting on redirect requests
 * - Negative caching for non-existent slugs (prevents Firestore read amplification)
 * - Only caches active, non-expired links
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { cacheGet, cacheSet } from "@/lib/cache/redirect-cache";
import { isNegCached, setNegCache } from "@/lib/cache/negative-cache";
import { recordClick } from "@/services/analytics";

export const runtime = "nodejs";

// ─── Rate limiter for redirects (per-IP) ────────────────────────────────────

const redirectLimiter = new Map<string, { count: number; windowStart: number }>();
const REDIRECT_WINDOW_MS = 60_000;
const REDIRECT_MAX_PER_IP = 120; // 120 redirects per minute per IP (2/sec)
const MAX_REDIRECT_LIMITER_ENTRIES = 10_000;

function isRedirectRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = redirectLimiter.get(ip);

    if (!entry || now - entry.windowStart >= REDIRECT_WINDOW_MS) {
        if (redirectLimiter.size >= MAX_REDIRECT_LIMITER_ENTRIES) {
            for (const [key, val] of redirectLimiter) {
                if (now - val.windowStart >= REDIRECT_WINDOW_MS) redirectLimiter.delete(key);
                if (redirectLimiter.size < MAX_REDIRECT_LIMITER_ENTRIES * 0.8) break;
            }
        }
        redirectLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= REDIRECT_MAX_PER_IP) return true;
    entry.count++;
    return false;
}

// ─── 404 HTML ───────────────────────────────────────────────────────────────

const ERROR_404_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>404 – Not Found</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;background:#09090b;color:#fafafa}
.c{text-align:center}h1{font-size:1.5rem;font-weight:600;margin-bottom:0.5rem}p{font-size:0.875rem;color:#a1a1aa;margin-bottom:1.5rem}
a{font-size:0.875rem;color:#fafafa;text-decoration:underline;text-underline-offset:4px}</style>
</head>
<body><div class="c"><h1>404</h1><p>This link does not exist.</p><a href="/">Go back</a></div></body>
</html>`;

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    // Per-IP rate limiting on redirect
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRedirectRateLimited(ip)) {
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    try {
        let originalUrl: string;
        let expiresAt: number | null = null;
        let isActive: boolean = true;

        // 1) Negative cache check — blocks Firestore read amplification
        if (isNegCached(slug)) {
            return new NextResponse(ERROR_404_HTML, {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // 2) Verify positive memory cache
        const cached = cacheGet(slug);

        if (cached) {
            originalUrl = cached.originalUrl;
            expiresAt = cached.expiresAt;
            isActive = cached.isActive;
        } else {
            // 3) Cache miss, hit Firestore
            const docSnap = await adminDb.collection("links").doc(slug).get();

            if (!docSnap.exists) {
                // Cache the "not found" result to prevent repeated Firestore reads
                setNegCache(slug);
                return new NextResponse(ERROR_404_HTML, {
                    status: 404,
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                });
            }

            const data = docSnap.data()!;
            originalUrl = data.originalUrl;
            expiresAt = data.expiresAt || null;
            isActive = data.isActive !== false;

            // 4) Only cache links that are active and non-expired
            const isExpired = expiresAt && expiresAt < Date.now();
            if (isActive && !isExpired) {
                cacheSet(slug, originalUrl, isActive, expiresAt);
            }
        }

        // Check expiration
        if (expiresAt && expiresAt < Date.now()) {
            return NextResponse.redirect(new URL("/expired", request.url), 302);
        }

        // Check active flag
        if (!isActive) {
            return new NextResponse(ERROR_404_HTML, {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // Fire-and-forget analytics recording (must not block the redirect)
        recordClick(slug, {
            referrer: request.headers.get("referer") || undefined,
            country: request.headers.get("x-vercel-ip-country") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        }).catch(() => { }); // swallow errors — analytics must never block redirects

        // Redirect to original URL with caching headers for CDN efficiency
        const redirectResponse = NextResponse.redirect(originalUrl, 302);
        redirectResponse.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
        return redirectResponse;
    } catch (error) {
        console.error("Redirect error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

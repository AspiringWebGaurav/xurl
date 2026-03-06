import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { cacheGet, cacheSet } from "@/lib/cache/redirect-cache";
import { isNegCached, setNegCache } from "@/lib/cache/negative-cache";

export const runtime = "nodejs";

const redirectLimiter = new Map<string, { count: number; windowStart: number }>();
const REDIRECT_WINDOW_MS = 60_000;
const REDIRECT_MAX_PER_IP = 120;
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

// Global promise cache to deduplicate simultaneous requests for the same slug
const pendingLookups = new Map<string, Promise<{ originalUrl?: string; isActive?: boolean; expiresAt?: number | null; error?: string }>>();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRedirectRateLimited(ip)) {
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    try {
        if (isNegCached(slug)) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const cached = cacheGet(slug);
        if (cached) {
            return NextResponse.json({
                originalUrl: cached.originalUrl,
                isActive: cached.isActive,
                expiresAt: cached.expiresAt,
            });
        }

        // Deduplicate simultaneous requests
        if (!pendingLookups.has(slug)) {
            const lookupPromise = (async () => {
                const docSnap = await adminDb.collection("links").doc(slug).get();
                if (!docSnap.exists) {
                    setNegCache(slug);
                    return { error: "not_found" };
                }

                const data = docSnap.data()!;
                const originalUrl = data.originalUrl;
                const expiresAt = data.expiresAt || null;
                const isActive = data.isActive !== false;

                const isExpired = expiresAt && expiresAt < Date.now();
                if (isActive && !isExpired) {
                    cacheSet(slug, originalUrl, isActive, expiresAt);
                }

                return { originalUrl, isActive, expiresAt };
            })().finally(() => pendingLookups.delete(slug));

            pendingLookups.set(slug, lookupPromise);
        }

        const result = await pendingLookups.get(slug);

        if (result?.error === "not_found") {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Redirect lookup error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

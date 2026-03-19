import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getRedirectCache, setRedirectCache, setNegCacheRedis } from "@/lib/redis/redirect-cache";
import { evaluateRequest } from "@/lib/redis/protection";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    // Validate slug format before any DB/cache queries
    if (!slug || !/^[a-zA-Z0-9-]{1,30}$/.test(slug)) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const behaviorHash = crypto.createHash("sha256").update(`redirect:${ip}:${userAgent}`).digest("hex");


    // Skip rate-limiting for automated tests in dev mode
    const isTestBypass = process.env.NODE_ENV !== "production" && request.headers.get("x-test-bypass") === "true";
    if (!isTestBypass) {
        // Protect redirect route with evaluateRequest using a laxer profile (-1 daily limit)
        // We rely mostly on IP, burst, and abuse score to protect against slug-scanning botnets.
        const { state } = await evaluateRequest(ip, "redirect_anon", -1, undefined, behaviorHash);

        if (state === "BLOCK") {
            return new NextResponse("Too Many Requests", { status: 429 });
        }

        if (state === "SLOW") {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    try {
        // 1. Atomic Redis Cache Lookup (handles negative AND positive cache + click counters)
        const cacheResult = await getRedirectCache(slug);

        if (cacheResult.status === "NEG") {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        if (cacheResult.status === "FOUND") {
            return NextResponse.json({
                originalUrl: cacheResult.url,
                isActive: true // Assuming active if in cache
            }, {
                headers: {
                    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
                }
            });
        }

        // 2. Cache MISS / Error -> Query Firebase Fallback
        const docSnap = await adminDb.collection("links").doc(slug).get();
        
        if (!docSnap.exists) {
            // Async save to Redis so we don't block response
            setNegCacheRedis(slug, 120).catch(console.error);
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const data = docSnap.data()!;
        const originalUrl = data.originalUrl;
        const expiresAt = data.expiresAt || null;
        const isActive = data.isActive !== false;

        const isExpired = expiresAt && expiresAt < Date.now();
        if (isActive && !isExpired) {
            // Adaptive TTL based roughly on if it's high traffic or not (could be improved, default 60m for now)
            setRedirectCache(slug, originalUrl, 3600).catch(console.error);
        } else {
             // Expired/inactive: cache as negative, do not expose originalUrl
             setNegCacheRedis(slug, 120).catch(console.error);
             return NextResponse.json({ error: "expired", isActive, expiresAt }, { status: 410 });
        }

        return NextResponse.json({ originalUrl, isActive, expiresAt }, {
            headers: {
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
            }
        });
    } catch (error) {
        console.error("Redirect lookup error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getRedirectCache, setRedirectCache, setNegCacheRedis, negCacheInvalidate, cacheInvalidate } from "@/lib/redis/redirect-cache";
import { evaluateRequest } from "@/lib/redis/protection";
import { checkUserBanned } from "@/lib/admin-access";
import { checkGuestBannedByHash } from "@/services/guest";
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
        const cacheControl = request.headers.get("cache-control") || "";
        const noCache = cacheControl.toLowerCase().includes("no-cache");

        // 1. Atomic Redis Cache Lookup (handles negative AND positive cache + click counters)
        const cacheResult = noCache ? { status: "MISS" as const } : await getRedirectCache(slug);

        if (cacheResult.status === "NEG" && !noCache) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        // Always revalidate owner access even on cache hit to avoid stale positives after ban/unban
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
        if (!isActive || isExpired) {
             // Expired/inactive: cache as negative, do not expose originalUrl
             setNegCacheRedis(slug, 120).catch(console.error);
             return NextResponse.json({ error: "expired", isActive, expiresAt }, { status: 410 });
        }

        // Access-state validation: check if the link owner is banned
        const ownerId = data.userId;
        if (!ownerId) {
            setNegCacheRedis(slug, 120).catch(console.error);
            return NextResponse.json({ error: "suspended" }, { status: 403 });
        }

        if (ownerId && ownerId !== "anonymous") {
            const { banned } = await checkUserBanned(ownerId);
            if (banned) {
                setNegCacheRedis(slug, 120).catch(console.error);
                return NextResponse.json({ error: "suspended" }, { status: 403 });
            }
        } else if (ownerId === "anonymous") {
            // Guest link — check guest ban by stored hashes if available
            const linkIpHash = data.ipHash || null;
            const linkFpHash = data.fingerprintHash || null;
            if (linkIpHash || linkFpHash) {
                try {
                    const { banned } = await checkGuestBannedByHash(linkIpHash, linkFpHash);
                    if (banned) {
                        setNegCacheRedis(slug, 120).catch(console.error);
                        return NextResponse.json({ error: "suspended" }, { status: 403 });
                    }
                } catch {
                    // Fail-closed: if we can't verify guest access, suspend
                    setNegCacheRedis(slug, 120).catch(console.error);
                    return NextResponse.json({ error: "suspended" }, { status: 403 });
                }
            } else {
                // No hashes to validate guest identity — fail closed
                setNegCacheRedis(slug, 120).catch(console.error);
                return NextResponse.json({ error: "suspended" }, { status: 403 });
            }
        }

        // Adaptive TTL based roughly on if it's high traffic or not (could be improved, default 60m for now)
        if (!noCache) {
            setRedirectCache(slug, originalUrl, 3600).catch(console.error);
        } else {
            // Ensure any stale negative cache is cleared on a fresh success
            negCacheInvalidate(slug).catch(console.error);
            cacheInvalidate(slug).catch(console.error);
        }

        return NextResponse.redirect(originalUrl, 302);
    } catch (error) {
        console.error("Redirect lookup error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

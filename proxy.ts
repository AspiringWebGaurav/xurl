import { NextRequest, NextResponse, userAgent } from 'next/server';
import type { NextFetchEvent } from 'next/server';

// Edge in-memory cache
const edgeCache = new Map<string, { originalUrl: string; isActive: boolean; expiresAt: number | null; cachedAt: number }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_EDGE_CACHE_SIZE = 5_000;

/** Dispatch analytics click recording in a fire-and-forget fashion. */
function dispatchAnalytics(
    event: NextFetchEvent,
    request: NextRequest,
    slug: string
) {
    const analyticsUrl = new URL('/api/analytics/click', request.url);
    const referrer = request.headers.get("referer") || "";
    const country = request.headers.get("x-vercel-ip-country") || "";
    const agent = request.headers.get("user-agent") || "";

    event.waitUntil(
        fetch(analyticsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, referrer, country, userAgent: agent })
        }).catch(err => console.error("Edge Analytics Dispatch Error", err))
    );
}

/** Build redirect response via the /r interstitial page. */
function buildRedirectResponse(
    request: NextRequest,
    redirectUrl: string,
    cacheStatus: "HIT" | "MISS"
): NextResponse {
    const redirectPageUrl = request.nextUrl.clone();
    redirectPageUrl.pathname = '/r';
    redirectPageUrl.searchParams.set("dest", redirectUrl);

    const response = NextResponse.redirect(redirectPageUrl, 302);
    response.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, must-revalidate");
    response.headers.set("X-Edge-Cache", cacheStatus);
    return response;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
    const { pathname } = request.nextUrl;

    const isApiOrAsset = 
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_redirect-fallback') ||
        pathname === '/favicon.ico' ||
        pathname === '/icon' ||
        pathname === '/apple-icon' ||
        pathname === '/manifest.webmanifest' ||
        pathname === '/manifest.json' ||
        pathname === '/opengraph-image' ||
        pathname === '/twitter-image';

    const isAppPage = 
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/pricing' ||
        pathname === '/expired' ||
        pathname === '/r' ||
        pathname === '/terms' ||
        pathname === '/privacy' ||
        pathname === '/acceptable-use' ||
        pathname === '/profile' ||
        pathname === '/purchase-history' ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname === '/placeholder' ||
        pathname === '/guest-policy' ||
        pathname === '/analytics' ||
        pathname === '/analytics-preview' ||
        pathname === '/features' ||
        pathname === '/about' ||
        pathname === '/blog' ||
        pathname === '/documentation' ||
        pathname === '/api-docs' ||
        pathname === '/refund' ||
        pathname === '/open-source' ||
        request.nextUrl.searchParams.has('dest');

    if (isApiOrAsset) {
        return NextResponse.next();
    }

    if (isAppPage) {
        const { device } = userAgent(request);
        if (device.type === 'mobile' || device.type === 'tablet') {
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-is-mobile-device', 'true');
            
            const hasMobileRoute = pathname === '/' || pathname === '/login' || pathname.startsWith('/dashboard') || pathname === '/pricing' || pathname === '/analytics';
            
            if (hasMobileRoute) {
                let mobilePathname = pathname === '/' ? '' : pathname;
                if (pathname === '/pricing') mobilePathname = '/plan';
                
                return NextResponse.rewrite(new URL(`/mobile${mobilePathname}`, request.url), {
                    request: { headers: requestHeaders }
                });
            } else {
                return NextResponse.next({
                    request: { headers: requestHeaders }
                });
            }
        }
        return NextResponse.next();
    }

    const slug = pathname.substring(1);

    // Validate slug format early to prevent cache pollution
    if (!slug || !/^[a-zA-Z0-9-]{1,30}$/.test(slug)) {
        return NextResponse.next(); // Let Next.js handle 404 natively
    }

    // 1) Edge Cache Hit -> Instant Redirect
    const cached = edgeCache.get(slug);
    if (cached) {
        const isExpired = cached.expiresAt && cached.expiresAt < Date.now();
        const cacheExpired = Date.now() - cached.cachedAt > DEFAULT_TTL_MS;

        if (!isExpired && cached.isActive && !cacheExpired) {
            dispatchAnalytics(event, request, slug);
            return buildRedirectResponse(request, cached.originalUrl, "HIT");
        } else {
            edgeCache.delete(slug);
        }
    }

    // 2) Cache Miss -> Await API fetch to get redirect URL
    const apiUrl = new URL('/api/redirect/' + slug, request.url);
    try {
        const res = await fetch(apiUrl);
        if (res.ok) {
            const data = await res.json();
            if (data && !data.error && data.originalUrl) {
                // Evict oldest entry if at capacity
                if (edgeCache.size >= MAX_EDGE_CACHE_SIZE) {
                    const firstKey = edgeCache.keys().next().value;
                    if (firstKey !== undefined) edgeCache.delete(firstKey);
                }

                // Populate edge cache
                edgeCache.set(slug, {
                    originalUrl: data.originalUrl,
                    isActive: data.isActive,
                    expiresAt: data.expiresAt,
                    cachedAt: Date.now()
                });

                const isExpired = data.expiresAt && data.expiresAt < Date.now();
                if (data.isActive && !isExpired) {
                    dispatchAnalytics(event, request, slug);
                    return buildRedirectResponse(request, data.originalUrl, "MISS");
                } else {
                    return NextResponse.redirect(new URL('/expired', request.url), 302);
                }
            }
        } else {
            // Handle specific status codes
            if (res.status === 410) {
                return NextResponse.redirect(new URL('/expired', request.url), 302);
            }
            if (res.status === 404) {
                return NextResponse.next(); // 404
            }
        }
    } catch (err) {
        console.error("Edge Cache Fetch Error", err);
    }

    // If completely invalid/missing (e.g., 500 error, network failure)
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|images).*)',
    ],
};


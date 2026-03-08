import { NextRequest, NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';

// Edge in-memory cache
const edgeCache = new Map<string, { originalUrl: string; isActive: boolean; expiresAt: number | null; cachedAt: number }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function proxy(request: NextRequest, event: NextFetchEvent) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_redirect-fallback') ||
        pathname === '/favicon.ico' ||
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/pricing' ||
        pathname === '/expired' ||
        pathname === '/r' ||
        request.nextUrl.searchParams.has('dest')
    ) {
        return NextResponse.next();
    }

    const slug = pathname.substring(1);

    // 1) Edge Cache Hit -> Instant Redirect
    const cached = edgeCache.get(slug);
    if (cached) {
        const isExpired = cached.expiresAt && cached.expiresAt < Date.now();
        const cacheExpired = Date.now() - cached.cachedAt > DEFAULT_TTL_MS;

        if (!isExpired && cached.isActive && !cacheExpired) {
            const redirectUrl = cached.originalUrl;

            // Fire-and-forget analytics
            const analyticsUrl = new URL('/api/analytics/click', request.url);
            const referrer = request.headers.get("referer") || "";
            const country = request.headers.get("x-vercel-ip-country") || "";
            const userAgent = request.headers.get("user-agent") || "";

            event.waitUntil(
                fetch(analyticsUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug, referrer, country, userAgent })
                }).catch(err => console.error("Edge Analytics Dispatch Error", err))
            );

            const redirectPageUrl = request.nextUrl.clone();
            redirectPageUrl.pathname = '/r';
            redirectPageUrl.searchParams.set("dest", redirectUrl);

            const response = NextResponse.redirect(redirectPageUrl, 302);
            response.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, must-revalidate");
            response.headers.set("X-Edge-Cache", "HIT");
            return response;
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
                // Populate edge cache
                edgeCache.set(slug, {
                    originalUrl: data.originalUrl,
                    isActive: data.isActive,
                    expiresAt: data.expiresAt,
                    cachedAt: Date.now()
                });

                const isExpired = data.expiresAt && data.expiresAt < Date.now();
                if (data.isActive && !isExpired) {
                    const redirectUrl = data.originalUrl;

                    // Fire-and-forget analytics
                    const analyticsUrl = new URL('/api/analytics/click', request.url);
                    const referrer = request.headers.get("referer") || "";
                    const country = request.headers.get("x-vercel-ip-country") || "";
                    const userAgent = request.headers.get("user-agent") || "";

                    event.waitUntil(
                        fetch(analyticsUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ slug, referrer, country, userAgent })
                        }).catch(err => console.error("Edge Analytics Dispatch Error", err))
                    );

                    const redirectPageUrl = request.nextUrl.clone();
                    redirectPageUrl.pathname = '/r';
                    redirectPageUrl.searchParams.set("dest", redirectUrl);

                    const response = NextResponse.redirect(redirectPageUrl, 302);
                    response.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, must-revalidate");
                    response.headers.set("X-Edge-Cache", "MISS");
                    return response;
                }
            }
        }
    } catch (err) {
        console.error("Edge Cache Fetch Error", err);
    }

    // If not found or expired, redirect to expired page
    return NextResponse.redirect(new URL('/expired', request.url), 302);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api|login|pricing|expired|r).*)',
    ],
};

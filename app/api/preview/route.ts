import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

// ─── SSRF Protection (DNS-resolution based) ─────────────────────────────────

/**
 * Check if an IP address is in a private/reserved range.
 * Catches all encoding tricks (octal, hex, decimal, IPv6-mapped).
 */
function isPrivateIP(ip: string): boolean {
    // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1 → 127.0.0.1)
    const normalized = ip.replace(/^::ffff:/, "");

    if (net.isIPv4(normalized)) {
        const parts = normalized.split(".").map(Number);
        const [a, b] = parts;
        if (a === 10) return true;                          // 10.0.0.0/8
        if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
        if (a === 192 && b === 168) return true;             // 192.168.0.0/16
        if (a === 127) return true;                          // 127.0.0.0/8
        if (a === 169 && b === 254) return true;             // 169.254.0.0/16
        if (a === 0) return true;                            // 0.0.0.0/8
        return false;
    }

    if (net.isIPv6(normalized)) {
        // Block loopback (::1), link-local (fe80::), ULA (fc00::/fd00::)
        if (normalized === "::1" || normalized === "::") return true;
        const lower = normalized.toLowerCase();
        if (lower.startsWith("fe80:")) return true;
        if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
        return false;
    }

    return false;
}

async function isBlockedUrl(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url);

        // Block non-http(s) protocols
        if (!["http:", "https:"].includes(parsed.protocol)) return true;

        // Resolve hostname to actual IP — catches octal, hex, decimal encoding tricks
        const { address } = await dns.lookup(parsed.hostname);
        if (isPrivateIP(address)) return true;

        return false;
    } catch {
        return true; // If we can't resolve the hostname, block it
    }
}

// ─── Rate limiter (simple in-memory per-IP, self-cleaning) ──────────────────

const previewLimiter = new Map<string, { count: number; windowStart: number }>();
const PREVIEW_WINDOW_MS = 60_000;
const PREVIEW_MAX_REQUESTS = 20;
const MAX_LIMITER_ENTRIES = 5_000;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = previewLimiter.get(ip);

    if (!entry || now - entry.windowStart >= PREVIEW_WINDOW_MS) {
        // Evict stale entries if Map is too large
        if (previewLimiter.size >= MAX_LIMITER_ENTRIES) {
            for (const [key, val] of previewLimiter) {
                if (now - val.windowStart >= PREVIEW_WINDOW_MS) previewLimiter.delete(key);
                if (previewLimiter.size < MAX_LIMITER_ENTRIES * 0.8) break;
            }
        }
        previewLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= PREVIEW_MAX_REQUESTS) return true;
    entry.count++;
    return false;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // Rate limit by IP (check before DNS resolution to prevent resource abuse)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // SSRF protection (resolves hostname to IP, catches all encoding tricks)
    if (await isBlockedUrl(url)) {
        return NextResponse.json({ title: null, favicon: null });
    }

    try {
        // Manual redirect following — validate each hop to prevent SSRF via redirect
        let currentUrl = url;
        let res: Response | null = null;
        const MAX_REDIRECTS = 3;

        for (let i = 0; i <= MAX_REDIRECTS; i++) {
            res = await fetch(currentUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; XURLBot/1.0; +http://xurl.eu.cc)",
                    "Accept": "text/html,application/xhtml+xml"
                },
                signal: AbortSignal.timeout(3000),
                redirect: "manual",
            });

            // If redirect, validate the target before following
            if ([301, 302, 303, 307, 308].includes(res.status)) {
                const location = res.headers.get("location");
                if (!location) break;

                // Resolve relative redirects
                const redirectUrl = new URL(location, currentUrl).toString();

                // Validate the redirect target against SSRF
                if (await isBlockedUrl(redirectUrl)) {
                    return NextResponse.json({ title: null, favicon: null });
                }
                currentUrl = redirectUrl;
                continue;
            }
            break;
        }

        if (!res) {
            return NextResponse.json({ title: null, favicon: null });
        }

        if (!res.ok) {
            return NextResponse.json({ title: null, favicon: null });
        }

        // We only need the first few KB for <head> tags
        const reader = res.body?.getReader();
        let htmlChunk = '';
        if (reader) {
            const decoder = new TextDecoder("utf-8");
            let bytesReceived = 0;
            while (bytesReceived < 50000) { // Max 50KB
                const { done, value } = await reader.read();
                if (done) break;
                htmlChunk += decoder.decode(value, { stream: true });
                bytesReceived += value.length;
                if (htmlChunk.includes('</head>')) break;
            }
        } else {
            htmlChunk = await res.text();
            htmlChunk = htmlChunk.substring(0, 50000);
        }

        // Simple regex to find title
        const titleMatch = htmlChunk.match(/<title[^>]*>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : null;
        if (title && title.length > 80) title = title.substring(0, 80) + '...';

        // Regex to find typical favicons
        const iconMatch = htmlChunk.match(/<link[^>]*rel=["']?(?:shortcut )?icon["']?[^>]*href=["']?([^"'>\s]+)["']?[^>]*>/i)
            || htmlChunk.match(/<link[^>]*href=["']?([^"'>\s]+)["']?[^>]*rel=["']?(?:shortcut )?icon["']?[^>]*>/i);

        let favicon = iconMatch ? iconMatch[1] : null;

        const urlObj = new URL(url);

        if (favicon && !favicon.startsWith('http')) {
            if (favicon.startsWith('//')) {
                favicon = `${urlObj.protocol}${favicon}`;
            } else if (favicon.startsWith('/')) {
                favicon = `${urlObj.origin}${favicon}`;
            } else {
                favicon = `${urlObj.origin}/${favicon}`;
            }
        }

        // Default to origin/favicon.ico if none explicitly linked
        if (!favicon) {
            favicon = `${urlObj.origin}/favicon.ico`;
        }

        return NextResponse.json({ title, favicon });
    } catch (e) {
        console.error("Preview api fetch error:", e);
        return NextResponse.json({ title: null, favicon: null });
    }
}

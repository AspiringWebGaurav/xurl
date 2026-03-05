/**
 * Central URL Builder — single source of truth for short link construction.
 *
 * Every part of the codebase (API responses, UI display, QR codes, previews)
 * MUST use this function. Direct string concatenation of domains is forbidden.
 */

import { env } from "@/lib/env";

/**
 * Build a fully-qualified short URL for the given slug.
 *
 * - development → http://localhost:3000/{slug}
 * - production  → https://xurl.eu.cc/{slug}
 */
export function buildShortUrl(slug: string): string {
    let domain = env.NEXT_PUBLIC_SHORT_DOMAIN;

    // Failsafe: if the build statically injected "localhost:3000" but we're in a production environment
    if (domain.includes("localhost")) {
        if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
            // Client-side execution
            domain = window.location.host;
        } else if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
            // Server-side execution in Vercel
            domain = "xurl.eu.cc";
        }
    }

    const isDev = domain.includes("localhost");
    const protocol = isDev ? "http" : "https";
    return `${protocol}://${domain}/${slug}`;
}

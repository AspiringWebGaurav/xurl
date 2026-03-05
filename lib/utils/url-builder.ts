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
    const domain = env.NEXT_PUBLIC_SHORT_DOMAIN;
    const isDev = env.NEXT_PUBLIC_ENVIRONMENT === "development";
    const protocol = isDev ? "http" : "https";
    return `${protocol}://${domain}/${slug}`;
}

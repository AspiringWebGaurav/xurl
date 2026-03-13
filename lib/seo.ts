/**
 * Centralized SEO configuration for XURL.
 *
 * All metadata values, Open Graph defaults, and structured data
 * live here as a single source of truth.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://xurl.eu.cc";

export const seo = {
    siteName: "XURL",
    title: "XURL — Modern URL Shortener with Analytics",
    description:
        "XURL is a powerful URL shortening platform with advanced analytics, fast redirects, and secure link management.",
    keywords: [
        "xurl",
        "url shortener",
        "link shortener",
        "short links",
        "link analytics",
        "link tracking",
        "url shortening service",
        "custom short links",
        "link management",
        "click analytics",
    ] as string[],
    author: "XURL",
    url: SITE_URL,

    /** Placeholder — replace with real assets when the logo ships. */
    logo: `${SITE_URL}/images/logo-placeholder.png`,

    /** Social preview image shown on Twitter / LinkedIn / Discord / WhatsApp. */
    ogImage: `${SITE_URL}/images/seo-preview.png`,

    twitter: {
        card: "summary_large_image" as const,
        title: "XURL — Smart URL Shortener",
        description: "Create short links and track analytics with XURL.",
    },

    openGraph: {
        title: "XURL — Smart URL Shortener",
        description: "Create short links and track analytics with XURL.",
        type: "website" as const,
        siteName: "XURL",
    },
} as const;

export type SeoConfig = typeof seo;

import { Metadata } from "next";

import { GuestPolicyContent } from "@/components/legal/GuestPolicyContent";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Guest Policy",
    description: "XURL policy for guest users creating links without an account. Learn about guest link limits, expiry, and data handling.",
    alternates: { canonical: `${seo.url}/guest-policy` },
    openGraph: {
        title: "Guest Policy — XURL",
        description: "XURL policy for guest users creating links without an account.",
        url: `${seo.url}/guest-policy`,
    },
};

const updatedAt = new Date().toLocaleDateString("en-GB");

const policySections = [
    {
        title: "1. Limited Guest Access",
        paragraphs: [
            "Guest users may create only one temporary shortened link at a time. Guest access is intended solely for lightweight evaluation and short-lived personal use.",
            "Custom aliases, expanded limits, analytics features, and additional link creation require an authenticated account and, where applicable, a paid plan.",
        ],
        keyRules: [
            {
                label: "Guest Limit",
                value: "1 temporary active link",
            },
            {
                label: "Expiry Window",
                value: "Approximately 5 minutes",
            },
        ],
    },
    {
        title: "2. Expiration Rules",
        paragraphs: [
            "Links created under guest access expire automatically after approximately five minutes. Once a guest link is active, additional guest link creation may be restricted until the active guest link expires or is otherwise cleared by our systems.",
            "Guest links are temporary by design and must not be relied upon for persistent, production, commercial, or business-critical use.",
        ],
    },
    {
        title: "3. Abuse Prevention Controls",
        paragraphs: [
            "To enforce guest limits and protect the platform, XURL may use automated fraud and abuse controls including IP-based checks, device or browser fingerprinting, request-pattern analysis, rate limiting, behavior-based scoring, and related integrity signals.",
            "We may also use session-level and client-side state indicators to detect repeated or evasive guest activity.",
        ],
    },
    {
        title: "4. Prohibited Circumvention",
        intro: "You may not attempt to bypass guest restrictions or anti-abuse protections. Prohibited conduct includes, without limitation:",
        list: [
            "Using bots, scripts, headless browsers, or other automation to create guest links.",
            "Rotating IP addresses, proxies, VPN endpoints, or similar network identities to evade limits.",
            "Manipulating browser state, local/session storage, cookies, headers, or client identifiers.",
            "Resetting, spoofing, or interfering with device or browser fingerprints.",
            "Submitting repeated, coordinated, or programmatic requests intended to defeat rate limits.",
        ],
    },
    {
        title: "5. Enforcement",
        paragraphs: [
            "Any attempt to circumvent guest restrictions, abuse the no-login flow, or interfere with our protective controls may result in immediate blocking of requests, invalidation of guest access, disabling of shortened URLs, suspension of related accounts, or permanent bans without prior notice.",
            "We reserve the right to apply these measures automatically where abuse is detected or reasonably suspected.",
        ],
    },
    {
        title: "6. Reservation of Rights",
        paragraphs: [
            "XURL may modify, restrict, suspend, or discontinue guest access at any time in order to protect service reliability, platform security, and other users.",
            "Use of guest access remains subject to our Terms of Service, Privacy Policy, and Acceptable Use Policy.",
        ],
    },
] as const;

export default function GuestPolicyPage() {
    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
            <TopNavbar isCreateDisabled={false} />
            <GuestPolicyContent updatedAt={updatedAt} sections={policySections} />
            <SiteFooter />
        </div>
    );
}

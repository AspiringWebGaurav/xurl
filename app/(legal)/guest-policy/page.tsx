import { Metadata } from "next";

import { GuestPolicyContent } from "@/components/legal/GuestPolicyContent";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Guest Policy",
    description: "XURL policy for guest users creating links without an account. Learn about guest link limits, expiry, and deterministic tracking.",
    alternates: { canonical: `${seo.url}/guest-policy` },
    openGraph: {
        title: "Guest Policy — XURL",
        description: "XURL policy for guest users creating links without an account.",
        url: `${seo.url}/guest-policy`,
    },
};

const updatedAt = "July 17, 2026 (Originally Published: July 16, 2026)";

const policySections = [
    {
        title: "1. Limited Guest Access",
        paragraphs: [
            "Guest users may create only one temporary shortened link at a time. Guest access is intended solely for lightweight evaluation and short-lived personal use.",
            "Custom aliases, expanded limits, analytics features, and permanent link creation require an authenticated account.",
        ],
        keyRules: [
            {
                label: "Guest Limit",
                value: "1 active link maximum",
            },
            {
                label: "Expiry Window",
                value: "Standard configuration",
            },
        ],
    },
    {
        title: "2. Deterministic Device Tracking",
        paragraphs: [
            "To enforce strict guest limits without relying on fragile browser local storage, XURL employs deterministic device fingerprinting. This generates a secure, anonymized SHA-256 session token unique to your hardware and browser environment.",
            "This ensures that clearing your browser cache, using Incognito mode, or deleting local storage will not reset your guest quota or sever your link history.",
        ],
    },
    {
        title: "3. Abuse Prevention & Lockout",
        paragraphs: [
            "Guest sessions are strictly monitored. If suspicious or abusive activity is detected—such as programmatic link creation or malware distribution—the guest session will be permanently locked out.",
            "Locked guests will be completely blocked from creating new links or accessing the service until an admin manually lifts the lock. Lock-lifts are accompanied by live in-app notifications.",
        ],
    },
    {
        title: "4. Prohibited Circumvention",
        intro: "You may not attempt to bypass guest restrictions or anti-abuse protections. Prohibited conduct includes, without limitation:",
        list: [
            "Using bots, scripts, headless browsers, or other automation to create guest links.",
            "Rotating IP addresses, proxies, VPN endpoints, or similar network identities to evade limits.",
            "Manipulating browser state or attempting to spoof device hardware metrics to generate new fingerprints.",
            "Submitting repeated, coordinated, or programmatic requests intended to defeat rate limits.",
        ],
    },
    {
        title: "5. Live Session Syncing",
        paragraphs: [
            "XURL utilizes live real-time sockets to sync your guest history and lock status across all your active tabs. If an admin modifies your status or deletes your link, the changes will reflect live without requiring a page refresh.",
        ],
    },
    {
        title: "6. Reservation of Rights",
        paragraphs: [
            "XURL may modify, restrict, suspend, or discontinue guest access at any time in order to protect service reliability, platform security, and other users.",
            "Use of guest access remains subject to our Terms of Service, Privacy Policy, Code of Conduct, and Acceptable Use Policy.",
        ],
    },
] as const;

export default function GuestPolicyPage() {
    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
            <TopNavbar isCreateDisabled={false} />
            <GuestPolicyContent updatedAt={updatedAt} sections={policySections} />
        </div>
    );
}
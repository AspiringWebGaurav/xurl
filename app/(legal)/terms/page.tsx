import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Terms of Service",
    description:
        "XURL Terms of Service: service description, user responsibilities, prohibited usage, payment terms, account termination, and governing law.",
    alternates: { canonical: `${seo.url}/terms` },
    openGraph: {
        title: "Terms of Service — XURL",
        description: "Read the XURL Terms of Service.",
        url: `${seo.url}/terms`,
    },
};

const sections = [
    {
        title: "Acceptance of Terms",
        content: (
            <p>By accessing and using XURL (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service, along with our Privacy Policy, Code of Conduct, and Acceptable Use Policy. If you do not agree to these terms, please immediately cease using the Service.</p>
        ),
    },
    {
        title: "Description of Service",
        content: (
            <p>XURL provides URL shortening, dynamic link management, QR code generation, and advanced real-time click analytics services seamlessly across both desktop and mobile platforms. The Service supports three distinct access tiers: guest access (no account required, hardware-fingerprint tracked), free accounts (Google OAuth sign-in), and premium paid plans with enhanced features. The Service features cross-platform synchronization, real-time dynamic maintenance overlays, and physical haptic feedback (on mobile devices). The Service is provided strictly &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We reserve the right to modify or entirely discontinue any part of the Service at any time.</p>
        ),
    },
    {
        title: "Link Shortening Features & Limitations",
        id: "link-shortening",
        content: (
            <p>Users may submit long URLs to be condensed into short `xurl.com/xyz` slugs. Guests are heavily rate-limited and bound by strict creation quotas (typically 1 active link). Creating redirects to domains already acting as URL shorteners (creating a "redirect chain") is forbidden. We proactively scan shortened destinations to protect users.</p>
        ),
    },
    {
        title: "Custom Aliases Policy",
        id: "custom-aliases",
        content: (
            <p>Premium and registered users may select custom vanity aliases (e.g., `xurl.com/my-brand`). Custom aliases are issued on a first-come, first-served basis. Any attempt to bypass premium restrictions on custom aliases via the API is a violation of the Terms of Service. We absolutely reserve the right to revoke, reclaim, or reassign custom aliases if they are deemed offensive, impersonate established brands (trademark infringement), or are parked maliciously.</p>
        ),
    },
    {
        title: "API Access Policy",
        id: "api-access",
        content: (
            <p>Premium users are granted programmatic API access to create and manage links at scale. API access must strictly adhere to the rate limits defined in your plan tier. You must not expose your API key publicly. Automated scripts attempting to rapidly generate spam links will trigger instant, irrevocable account termination.</p>
        ),
    },
    {
        title: "QR Codes",
        id: "qr-codes",
        content: (
            <p>XURL automatically provides dynamic QR codes for every shortened link. These QR codes are inextricably tied to their parent shortened URL. If a URL is deleted, expires, or is banned by moderation, the corresponding QR code will immediately cease to function and display an error page instead.</p>
        ),
    },
    {
        title: "User Accounts, Subscriptions, and Premium Plans",
        id: "premium-plans",
        content: (
            <p>When you create an account via Google sign-in, you must provide accurate information. Paid plans are one-time purchases processed securely via Razorpay. Each purchase permanently adds link creation credits to your cumulative quota. Quotas do not expire and are not reset. Purchases are final; refer to our Refund Policy for exceptions.</p>
        ),
    },
    {
        title: "Account Security & Termination",
        content: (
            <p>We maintain absolute ownership and strict authorization over all links. You may not tamper with API requests, reverse engineer the platform, or attempt to modify or delete links that belong to other users. The platform maintains a strict zero-tolerance auto-ban policy for malicious links or any unauthorized resource access (such as IDOR tampering). If the system detects such activity, your account will be instantly and permanently banned without warning, and your active shortened links may be deactivated immediately to protect our users. You have the right to submit an appeal through the suspension interface. Appeals are reviewed manually by our trust and safety team. Submitting an appeal does not guarantee account reinstatement. If reinstated, your account may be placed under strict scrutiny.</p>
        ),
    },
    {
        title: "Liability Limitation",
        content: (
            <p>XURL shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to the loss of data, loss of SEO ranking, or business interruptions. Our total liability shall not exceed the amount paid by you in the twelve months preceding the claim.</p>
        ),
    },
];

export default async function TermsPage() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    return (
        <LegalPageShell isMobileDevice={isMobileDevice} title="Terms of Service"
            lastUpdated="Last Updated: July 18, 2026 (Originally Published: July 16, 2026)"
            sections={sections}
        />
    );
}

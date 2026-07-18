import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "XURL Privacy Policy: data collection practices, cookie usage, analytics, third-party sharing, user rights, and security measures.",
    alternates: { canonical: `${seo.url}/privacy` },
    openGraph: {
        title: "Privacy Policy — XURL",
        description: "Read the XURL Privacy Policy.",
        url: `${seo.url}/privacy`,
    },
};

const sections = [
    {
        title: "Information We Collect",
        content: (
            <p>We collect information you provide directly (such as email addresses via Google Auth) and technical information gathered automatically (such as device fingerprints, IP addresses, and click analytics on shortened URLs). IP addresses and device fingerprints are SHA-256 hashed before storage to anonymize users while preventing abuse.</p>
        ),
    },
    {
        title: "How We Use Information",
        content: (
            <p>We use collected information to provide and improve the Service, enforce rate limits and prevent abuse, process payments via Razorpay, deliver click analytics to link creators, and maintain strict account security protocols across the platform.</p>
        ),
    },
    {
        title: "Cookies and Client-Side Storage",
        content: (
            <p>We use strictly necessary cookies for authentication via Firebase Auth. For guest link history, we no longer store standard historical records in your browser&rsquo;s local storage. Instead, we generate a highly stable, deterministic device fingerprint hash that acts as a secure session token. This allows seamless tracking across browser resets without compromising anonymity. We do not use third-party advertising cookies or tracking pixels.</p>
        ),
    },
    {
        title: "Link Click Analytics Tracking",
        id: "analytics",
        content: (
            <p>When someone clicks a shortened link on XURL, we collect the referrer URL, user agent, approximate geographic location, and timestamp. We never collect Personally Identifiable Information (PII) of the person clicking the link. This data is aggregated into daily geographic and temporal rollups and is made securely available to premium plan users through our real-time analytics dashboard. Raw analytics data is securely retained for 90 days before automatic deletion.</p>
        ),
    },
    {
        title: "Data Sharing",
        content: (
            <p>We absolutely do not sell your personal data. We share only strictly necessary data with trusted third-party service providers: Firebase (Google) for database and authentication, Razorpay for payment processing, and Upstash (Redis) for real-time caching infrastructure. We may disclose information if required by a valid legal subpoena.</p>
        ),
    },
    {
        title: "Data Retention & Account Bans",
        content: (
            <p>We retain your personal data for as long as your account is active. However, if your account is suspended or banned for violating our Terms of Service, we reserve the right to retain minimal identifying information (including hashed email, IP addresses, and device fingerprints) indefinitely. This retention is crucial to enforce our zero-tolerance abuse policies, maintain platform security, and prevent ban evasion.</p>
        ),
    },
    {
        title: "Your Rights",
        content: (
            <p>You have the right to access your personal data through your profile, correct inaccurate information, request full deletion of your account, and export your link data. To exercise these rights, simply email our data protection officer using the contact email in our footer.</p>
        ),
    },
    {
        title: "Data Security",
        content: (
            <p>We implement industry-standard security measures including HTTPS/TLS encryption everywhere, SHA-256 hashing of sensitive identifiers, PCI-DSS compliant payment processing via Razorpay, extremely strict server-side token verification, and multi-layer dynamic rate limiting. However, no method of transmission over the internet is mathematically 100% secure.</p>
        ),
    },
    {
        title: "Changes to This Policy",
        content: (
            <p>We may update this Privacy Policy from time to time to reflect structural or legal changes. Material changes will be communicated through the Service interface. Your continued use constitutes acceptance of the revised policy.</p>
        ),
    },
];

export default async function PrivacyPage() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    return (
        <LegalPageShell isMobileDevice={isMobileDevice} title="Privacy Policy"
            lastUpdated="Last Updated: July 18, 2026 (Originally Published: July 16, 2026)"
            sections={sections}
        />
    );
}

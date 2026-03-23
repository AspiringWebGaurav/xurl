import type { Metadata } from "next";
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
            <p>We collect information you provide directly (such as email addresses via Google Auth) and technical information gathered automatically (such as device fingerprints, IP addresses, and click analytics on shortened URLs). IP addresses and device fingerprints are SHA-256 hashed before storage.</p>
        ),
    },
    {
        title: "How We Use Information",
        content: (
            <p>We use collected information to provide and improve the Service, enforce rate limits and prevent abuse, process payments via Razorpay, deliver click analytics to link creators, and maintain account security.</p>
        ),
    },
    {
        title: "Cookies and Tracking",
        content: (
            <p>We use essential cookies for authentication via Firebase Auth. We store guest link history in your browser&rsquo;s local storage; this data remains on your device. We do not use third-party advertising cookies or tracking pixels.</p>
        ),
    },
    {
        title: "Analytics",
        content: (
            <p>When someone clicks a shortened link, we collect the referrer URL, user agent, approximate geographic location, and timestamp. This data is aggregated into daily rollups and is available to paid plan users through the analytics dashboard. Analytics data is retained for 90 days.</p>
        ),
    },
    {
        title: "Data Sharing",
        content: (
            <p>We do not sell your personal data. We share necessary data with trusted third-party service providers: Firebase (Google) for database and authentication, Razorpay for payment processing, and Upstash for caching infrastructure. We may disclose information if required by law.</p>
        ),
    },
    {
        title: "Your Rights",
        content: (
            <p>You have the right to access your personal data through your profile, correct inaccurate information, request deletion of your account, and export your link data. To exercise these rights, contact us through the information provided on our website.</p>
        ),
    },
    {
        title: "Data Security",
        content: (
            <p>We implement industry-standard security measures including HTTPS/TLS encryption, SHA-256 hashing of sensitive identifiers, PCI-DSS compliant payment processing via Razorpay, server-side token verification, and multi-layer rate limiting. However, no method of transmission over the internet is 100% secure.</p>
        ),
    },
    {
        title: "Children's Privacy",
        content: (
            <p>The Service is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13.</p>
        ),
    },
    {
        title: "Changes to This Policy",
        content: (
            <p>We may update this Privacy Policy from time to time. Material changes will be communicated through the Service. Your continued use constitutes acceptance of the revised policy.</p>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <LegalPageShell
            title="Privacy Policy"
            lastUpdated={new Date().toLocaleDateString()}
            sections={sections}
        />
    );
}

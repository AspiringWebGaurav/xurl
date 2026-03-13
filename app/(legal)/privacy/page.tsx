import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
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

export default function PrivacyPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3>1. Information We Collect</h3>
                    <p>We collect information you provide directly (such as email addresses via Google Auth) and technical information gathered automatically (such as device fingerprints, IP addresses, and click analytics on shortened URLs). IP addresses and device fingerprints are SHA-256 hashed before storage.</p>

                    <h3>2. How We Use Information</h3>
                    <p>We use collected information to provide and improve the Service, enforce rate limits and prevent abuse, process payments via Razorpay, deliver click analytics to link creators, and maintain account security.</p>

                    <h3>3. Cookies and Tracking</h3>
                    <p>We use essential cookies for authentication via Firebase Auth. We store guest link history in your browser&rsquo;s local storage; this data remains on your device. We do not use third-party advertising cookies or tracking pixels.</p>

                    <h3>4. Analytics</h3>
                    <p>When someone clicks a shortened link, we collect the referrer URL, user agent, approximate geographic location, and timestamp. This data is aggregated into daily rollups and is available to paid plan users through the analytics dashboard. Analytics data is retained for 90 days.</p>

                    <h3>5. Data Sharing</h3>
                    <p>We do not sell your personal data. We share necessary data with trusted third-party service providers: Firebase (Google) for database and authentication, Razorpay for payment processing, and Upstash for caching infrastructure. We may disclose information if required by law.</p>

                    <h3>6. Your Rights</h3>
                    <p>You have the right to access your personal data through your profile, correct inaccurate information, request deletion of your account, and export your link data. To exercise these rights, contact us through the information provided on our website.</p>

                    <h3>7. Data Security</h3>
                    <p>We implement industry-standard security measures including HTTPS/TLS encryption, SHA-256 hashing of sensitive identifiers, PCI-DSS compliant payment processing via Razorpay, server-side token verification, and multi-layer rate limiting. However, no method of transmission over the internet is 100% secure.</p>

                    <h3>8. Children&rsquo;s Privacy</h3>
                    <p>The Service is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13.</p>

                    <h3>9. Changes to This Policy</h3>
                    <p>We may update this Privacy Policy from time to time. Material changes will be communicated through the Service. Your continued use constitutes acceptance of the revised policy.</p>
                </div>
            </main>
        </div>
    );
}

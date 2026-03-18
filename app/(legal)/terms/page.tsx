import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
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

export default function TermsPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3>1. Acceptance of Terms</h3>
                    <p>By accessing and using XURL (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>

                    <h3>2. Description of Service</h3>
                    <p>XURL provides URL shortening, link management, and click analytics services. The Service supports three access tiers: guest access (no account required), free accounts (Google sign-in), and paid plans with enhanced features. The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We reserve the right to modify or discontinue any part of the Service at any time.</p>

                    <h3>3. User Responsibilities</h3>
                    <p>You are responsible for maintaining the security of your account. You agree to provide accurate information and to use the Service only for lawful purposes. You must not attempt to circumvent rate limits, abuse protections, or quota enforcement mechanisms.</p>

                    <h3>4. Prohibited Usage</h3>
                    <p>You agree not to use the Service to shorten links to malware, phishing sites, spam, illegal content, or material that promotes violence or discrimination. You must not conduct automated scanning of shortened URLs or use the Service to disguise malicious destinations. See our <a href="/acceptable-use">Acceptable Use Policy</a> for full details.</p>

                    <h3>5. User Accounts &amp; Subscriptions</h3>
                    <p>When you create an account via Google sign-in, you must provide accurate information. Paid plans are one-time purchases processed securely via Razorpay. Each purchase adds link creation credits to your cumulative quota permanently. Quotas do not expire and are not reset.</p>

                    <h3>6. Account Termination</h3>
                    <p>We reserve the right to suspend or terminate your account, without prior notice or refund, if you violate these Terms or engage in abusive behavior. Upon termination, your shortened links may be deactivated and any unused quota will be forfeited. For details on enforcement actions and the appeal process, see our <a href="/ban-policy" target="_blank" rel="noopener noreferrer">Ban Policy</a>.</p>

                    <h3>7. Intellectual Property</h3>
                    <p>The Service, including its design and technology, is owned by XURL. You retain ownership of the URLs you submit. By using the Service, you grant XURL a non-exclusive license to store, process, and redirect through your submitted URLs as necessary to operate the Service.</p>

                    <h3>8. Liability Limitation</h3>
                    <p>XURL shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to the loss of data or business interruptions. Our total liability shall not exceed the amount paid by you in the twelve months preceding the claim.</p>

                    <h3>9. Governing Law</h3>
                    <p>These Terms shall be governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in India.</p>

                    <h3>10. Changes to Terms</h3>
                    <p>We may update these Terms from time to time. Material changes will be communicated through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
                </div>
            </main>
        </div>
    );
}

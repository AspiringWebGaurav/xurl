import type { Metadata } from "next";
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
            <p>By accessing and using XURL (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        ),
    },
    {
        title: "Description of Service",
        content: (
            <p>XURL provides URL shortening, link management, and click analytics services. The Service supports three access tiers: guest access (no account required), free accounts (Google sign-in), and paid plans with enhanced features. The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We reserve the right to modify or discontinue any part of the Service at any time.</p>
        ),
    },
    {
        title: "User Responsibilities",
        content: (
            <p>You are responsible for maintaining the security of your account. You agree to provide accurate information and to use the Service only for lawful purposes. You must not attempt to circumvent rate limits, abuse protections, or quota enforcement mechanisms.</p>
        ),
    },
    {
        title: "Prohibited Usage",
        content: (
            <p>You agree not to use the Service to shorten links to malware, phishing sites, spam, illegal content, or material that promotes violence or discrimination. You must not conduct automated scanning of shortened URLs or use the Service to disguise malicious destinations. See our <a href="/acceptable-use">Acceptable Use Policy</a> for full details.</p>
        ),
    },
    {
        title: "User Accounts & Subscriptions",
        content: (
            <p>When you create an account via Google sign-in, you must provide accurate information. Paid plans are one-time purchases processed securely via Razorpay. Each purchase adds link creation credits to your cumulative quota permanently. Quotas do not expire and are not reset.</p>
        ),
    },
    {
        title: "Account Termination",
        content: (
            <p>We reserve the right to suspend or terminate your account, without prior notice or refund, if you violate these Terms or engage in abusive behavior. Upon termination, your shortened links may be deactivated and any unused quota will be forfeited.</p>
        ),
    },
    {
        title: "Intellectual Property",
        content: (
            <p>The Service, including its design and technology, is owned by XURL. You retain ownership of the URLs you submit. By using the Service, you grant XURL a non-exclusive license to store, process, and redirect through your submitted URLs as necessary to operate the Service.</p>
        ),
    },
    {
        title: "Liability Limitation",
        content: (
            <p>XURL shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to the loss of data or business interruptions. Our total liability shall not exceed the amount paid by you in the twelve months preceding the claim.</p>
        ),
    },
    {
        title: "Governing Law",
        content: (
            <p>These Terms shall be governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in India.</p>
        ),
    },
    {
        title: "Changes to Terms",
        content: (
            <p>We may update these Terms from time to time. Material changes will be communicated through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalPageShell
            title="Terms of Service"
            lastUpdated={new Date().toLocaleDateString()}
            sections={sections}
        />
    );
}

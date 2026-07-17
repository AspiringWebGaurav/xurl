import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Acceptable Use Policy",
    description:
        "XURL Acceptable Use Policy: prohibited content, spam restrictions, abuse enforcement, automated API usage, and reporting guidelines.",
    alternates: { canonical: `${seo.url}/acceptable-use` },
    openGraph: {
        title: "Acceptable Use Policy — XURL",
        description: "Read the XURL Acceptable Use Policy.",
        url: `${seo.url}/acceptable-use`,
    },
};

const sections = [
    {
        title: "Introduction",
        content: (
            <p>This Acceptable Use Policy dictates the boundaries of acceptable usage on the XURL platform. It applies to all users, whether guests, free registered accounts, or premium plan subscribers. By using our services—whether via the web interface or API—you agree to adhere to these rules strictly.</p>
        ),
    },
    {
        title: "Prohibited Content",
        content: (
            <>
                <p>You agree not to use XURL to shorten links that redirect to the following types of content:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2 mb-4">
                    <li><strong>Malware &amp; Phishing:</strong> Sites that distribute viruses, trojans, ransomware, or attempt to steal user credentials or financial information.</li>
                    <li><strong>Spam:</strong> Unsolicited promotional content, misleading redirects, bulk messaging campaigns, or click fraud schemes.</li>
                    <li><strong>Illegal Content:</strong> Any content that violates applicable local, national, or international laws, including material that infringes intellectual property rights.</li>
                    <li><strong>Hate Speech &amp; Harassment:</strong> Content that promotes violence, discrimination, or targets individuals or groups maliciously based on protected characteristics.</li>
                    <li><strong>CSAM:</strong> Child Sexual Abuse Material in any form.</li>
                </ul>
            </>
        ),
    },
    {
        title: "Prohibited Activities & Automated Abuse",
        content: (
            <>
                <p>You must not engage in any of the following activities on our platform:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                    <li>Attempt to bypass rate limits, abuse detection, or quota enforcement mechanisms through proxy networks or VPNs.</li>
                    <li>Conduct automated scanning, brute-forcing, or enumeration of shortened URLs to scrape private user data or analytics.</li>
                    <li>Use multiple identities or clear browser local storage to circumvent guest usage limits.</li>
                    <li>Impersonate XURL, its staff, or other users.</li>
                    <li>Interfere with or disrupt the availability of the Service via Denial of Service (DoS) attacks.</li>
                    <li>Use URL shortening to disguise phishing, malware, or scam destinations behind our trustworthy domain.</li>
                </ul>
            </>
        ),
    },
    {
        title: "API Usage Policy",
        id: "api",
        content: (
            <p>Our API is provided for programmatic access to XURL's shortening and analytics features. You must respect all specified rate limits (currently restricted per plan tier). Do not use the API to generate links for third-party commercial reselling without a specialized enterprise agreement. API keys must remain strictly confidential; you are responsible for any abuse originating from your credentials.</p>
        ),
    },
    {
        title: "Spam Restrictions",
        content: (
            <p>Creating shortened links for bulk unsolicited messaging (SMS spam, email spam, social media botting), inflating engagement metrics, or generating links designed to redirect through multiple URL shorteners (redirect chaining) to obscure the final destination is strictly prohibited.</p>
        ),
    },
    {
        title: "Enforcement and Penalties",
        content: (
            <p>We employ highly advanced automated abuse scoring, dynamic rate limiting, device fingerprinting, and negative caching systems, along with manual reviews, to enforce this policy. Depending on the severity of the violation, we may issue warnings, disable offending URLs, suspend accounts, or permanently terminate accounts without prior notice or refund of any subscription fees. Our security systems automatically report flagrant malicious abuse to relevant network and law enforcement authorities.</p>
        ),
    },
    {
        title: "Reporting Abuse",
        content: (
            <p>If you encounter a shortened link that violates this policy, please report it immediately through our contact channels. Please include the shortened URL and a description of the violation so our Trust &amp; Safety team can investigate.</p>
        ),
    },
];

export default function AcceptableUsePage() {
    return (
        <LegalPageShell
            title="Acceptable Use Policy"
            lastUpdated="Last Updated: July 17, 2026 (Originally Published: July 16, 2026)"
            sections={sections}
        />
    );
}

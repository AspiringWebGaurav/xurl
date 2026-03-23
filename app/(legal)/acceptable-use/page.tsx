import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Acceptable Use Policy",
    description:
        "XURL Acceptable Use Policy: prohibited content, spam restrictions, abuse enforcement, and reporting guidelines.",
    alternates: { canonical: `${seo.url}/acceptable-use` },
    openGraph: {
        title: "Acceptable Use Policy — XURL",
        description: "Read the XURL Acceptable Use Policy.",
        url: `${seo.url}/acceptable-use`,
    },
};

const sections = [
    {
        title: "Prohibited Content",
        content: (
            <>
                <p>You agree not to use XURL to shorten links that redirect to the following types of content:</p>
                <ul>
                    <li><strong>Malware &amp; Phishing:</strong> Sites that distribute viruses, trojans, ransomware, or attempt to steal user credentials or financial information.</li>
                    <li><strong>Spam:</strong> Unsolicited promotional content, misleading redirects, bulk messaging campaigns, or click fraud schemes.</li>
                    <li><strong>Illegal Content:</strong> Any content that violates applicable local, national, or international laws, including material that infringes intellectual property rights.</li>
                    <li><strong>Hate Speech &amp; Harassment:</strong> Content that promotes violence, discrimination, or targets individuals or groups maliciously based on protected characteristics.</li>
                </ul>
            </>
        ),
    },
    {
        title: "Prohibited Activities",
        content: (
            <>
                <p>You must not:</p>
                <ul>
                    <li>Attempt to bypass rate limits, abuse detection, or quota enforcement mechanisms</li>
                    <li>Conduct automated scanning, brute-forcing, or enumeration of shortened URLs</li>
                    <li>Use multiple identities or proxies to circumvent guest usage limits</li>
                    <li>Impersonate XURL, its staff, or other users</li>
                    <li>Interfere with or disrupt the availability of the Service</li>
                    <li>Use URL shortening to disguise phishing, malware, or scam destinations</li>
                </ul>
            </>
        ),
    },
    {
        title: "Spam Restrictions",
        content: (
            <p>Creating shortened links for bulk unsolicited messaging, inflating engagement metrics, or generating links designed to redirect through multiple URL shorteners to obscure the final destination is strictly prohibited.</p>
        ),
    },
    {
        title: "Enforcement",
        content: (
            <p>We employ automated abuse scoring, rate limiting, and negative caching systems, along with manual reviews, to enforce this policy. Depending on the severity of the violation, we may issue warnings, disable offending URLs, suspend accounts, or permanently terminate accounts without prior notice or refund of any subscription fees.</p>
        ),
    },
    {
        title: "Reporting Abuse",
        content: (
            <p>If you encounter a shortened link that violates this policy, please report it through the contact information provided on our website. Include the shortened URL and a description of the violation.</p>
        ),
    },
];

export default function AcceptableUsePage() {
    return (
        <LegalPageShell
            title="Acceptable Use Policy"
            lastUpdated={new Date().toLocaleDateString()}
            sections={sections}
        />
    );
}

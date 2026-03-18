import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
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

export default function AcceptableUsePage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Acceptable Use Policy</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <p>To ensure a safe and reliable environment for all users, you agree not to use XURL to shorten links that redirect to the following types of content:</p>

                    <ul>
                        <li><strong>Malware &amp; Phishing:</strong> Sites that distribute viruses, trojans, ransomware, or attempt to steal user credentials or financial information.</li>
                        <li><strong>Spam:</strong> Unsolicited promotional content, misleading redirects, bulk messaging campaigns, or click fraud schemes.</li>
                        <li><strong>Illegal Content:</strong> Any content that violates applicable local, national, or international laws, including material that infringes intellectual property rights.</li>
                        <li><strong>Hate Speech &amp; Harassment:</strong> Content that promotes violence, discrimination, or targets individuals or groups maliciously based on protected characteristics.</li>
                    </ul>

                    <h3>Prohibited Activities</h3>
                    <p>You must not:</p>
                    <ul>
                        <li>Attempt to bypass rate limits, abuse detection, or quota enforcement mechanisms</li>
                        <li>Conduct automated scanning, brute-forcing, or enumeration of shortened URLs</li>
                        <li>Use multiple identities or proxies to circumvent guest usage limits</li>
                        <li>Impersonate XURL, its staff, or other users</li>
                        <li>Interfere with or disrupt the availability of the Service</li>
                        <li>Use URL shortening to disguise phishing, malware, or scam destinations</li>
                    </ul>

                    <h3>Spam Restrictions</h3>
                    <p>Creating shortened links for bulk unsolicited messaging, inflating engagement metrics, or generating links designed to redirect through multiple URL shorteners to obscure the final destination is strictly prohibited.</p>

                    <h3>Enforcement</h3>
                    <p>We employ automated abuse scoring, rate limiting, and negative caching systems, along with manual reviews, to enforce this policy. Depending on the severity of the violation, we may issue warnings, disable offending URLs, suspend accounts, or permanently terminate accounts without prior notice or refund of any subscription fees. For details on enforcement actions, ban types, and the appeal process, see our <a href="/ban-policy" target="_blank" rel="noopener noreferrer">Ban Policy</a>.</p>

                    <h3>Reporting Abuse</h3>
                    <p>If you encounter a shortened link that violates this policy, please report it through the contact information provided on our website. Include the shortened URL and a description of the violation.</p>
                </div>
            </main>
        </div>
    );
}

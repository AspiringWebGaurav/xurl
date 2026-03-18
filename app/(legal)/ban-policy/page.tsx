import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Ban Policy",
    description:
        "XURL Ban Policy: enforcement actions, ban reasons, temporary vs permanent bans, appeal process, and account restoration guidelines.",
    alternates: { canonical: `${seo.url}/ban-policy` },
    openGraph: {
        title: "Ban Policy — XURL",
        description: "Read the XURL Ban Policy.",
        url: `${seo.url}/ban-policy`,
    },
};

export default function BanPolicyPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Ban Policy</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3>1. Overview</h3>
                    <p>This Ban Policy explains how XURL enforces our <a href="/acceptable-use" target="_blank" rel="noopener noreferrer">Acceptable Use Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>. We are committed to maintaining a safe, secure, and reliable platform for all users. Violations of our policies may result in temporary or permanent suspension of access to the Service.</p>

                    <h3>2. Why Users Get Banned</h3>
                    <p>Access to XURL may be suspended or terminated for the following reasons:</p>
                    <ul>
                        <li><strong>Policy Violations:</strong> Creating shortened links that redirect to malware, phishing sites, spam, illegal content, hate speech, or material that promotes violence or discrimination.</li>
                        <li><strong>Abuse Detection:</strong> Attempting to bypass rate limits, abuse detection systems, or quota enforcement mechanisms through automated tools, multiple identities, or proxy services.</li>
                        <li><strong>Malicious Activity:</strong> Conducting automated scanning or enumeration of shortened URLs, impersonating XURL or other users, or interfering with the availability of the Service.</li>
                        <li><strong>Fraudulent Behavior:</strong> Using the Service to disguise malicious destinations, engaging in click fraud schemes, or creating links designed to deceive users about their true destination.</li>
                        <li><strong>Terms Violations:</strong> Any other violation of our Terms of Service or failure to comply with lawful requests from XURL administrators.</li>
                    </ul>

                    <h3>3. Types of Bans</h3>
                    <p>XURL enforces two types of access suspensions:</p>
                    
                    <h4>Temporary Bans</h4>
                    <p>Temporary bans are time-limited suspensions typically issued for first-time or minor violations. Common durations include:</p>
                    <ul>
                        <li><strong>1 hour:</strong> Minor rate limit violations or suspected automated activity</li>
                        <li><strong>6 hours:</strong> Repeated rate limit violations or suspicious link creation patterns</li>
                        <li><strong>24 hours:</strong> Creating links to low-severity prohibited content</li>
                        <li><strong>7 days:</strong> Multiple policy violations or moderate abuse detection triggers</li>
                        <li><strong>30 days:</strong> Serious policy violations or repeated temporary bans</li>
                    </ul>
                    <p>When a temporary ban expires, access is automatically restored. However, repeated violations may result in longer temporary bans or permanent suspension.</p>

                    <h4>Permanent Bans</h4>
                    <p>Permanent bans are indefinite suspensions issued for severe or repeated violations, including:</p>
                    <ul>
                        <li>Creating links to malware, ransomware, or credential-stealing phishing sites</li>
                        <li>Repeated violations after multiple temporary bans</li>
                        <li>Coordinated abuse campaigns or large-scale spam operations</li>
                        <li>Severe violations of our Acceptable Use Policy that pose immediate harm to users</li>
                        <li>Fraudulent chargebacks or payment disputes after consuming purchased quota</li>
                    </ul>
                    <p>Permanent bans may be appealed through our contact form, but restoration is not guaranteed and is granted only in exceptional circumstances.</p>

                    <h3>4. Enforcement Process</h3>
                    <p>XURL uses a combination of automated systems and manual review to enforce this policy:</p>
                    <ul>
                        <li><strong>Automated Detection:</strong> Our abuse scoring system monitors link creation patterns, rate limit violations, and device fingerprints to detect suspicious activity in real-time.</li>
                        <li><strong>Manual Review:</strong> Reported links and flagged accounts are reviewed by administrators who may issue warnings, temporary bans, or permanent suspensions based on the severity of the violation.</li>
                        <li><strong>Immediate Action:</strong> Links to malware, phishing sites, or other high-severity threats may be disabled immediately without prior warning to protect users.</li>
                    </ul>

                    <h3>5. What Happens When You're Banned</h3>
                    <p>When your account or device is banned:</p>
                    <ul>
                        <li>You will see a ban notification screen explaining the suspension and providing a reason (if available)</li>
                        <li>All active shortened links created by your account may be deactivated</li>
                        <li>You will not be able to create new links or access premium features</li>
                        <li>For temporary bans, the screen will display the remaining time until access is restored</li>
                        <li>Any unused quota from paid plans will be forfeited and is non-refundable per our <a href="/refund" target="_blank" rel="noopener noreferrer">Refund Policy</a></li>
                    </ul>

                    <h3>6. Appeal Process</h3>
                    <p>If you believe your ban was issued in error or wish to appeal a permanent ban, you may contact us through our <a href="/contact?from=ban" target="_blank" rel="noopener noreferrer">contact form</a>. When submitting an appeal:</p>
                    <ul>
                        <li>Provide your registered email address (if applicable)</li>
                        <li>Explain why you believe the ban was issued incorrectly</li>
                        <li>Include any relevant context or evidence supporting your appeal</li>
                        <li>Be respectful and professional in your communication</li>
                    </ul>
                    <p>Appeals are reviewed within 5-7 business days. We will respond via email with our decision. Please note that:</p>
                    <ul>
                        <li>Not all appeals will result in ban removal</li>
                        <li>Repeated appeals for the same ban will not be reviewed</li>
                        <li>Abusive or threatening appeal messages may result in permanent suspension</li>
                        <li>We reserve the right to deny appeals without providing detailed explanations for security reasons</li>
                    </ul>

                    <h3>7. Account Restoration</h3>
                    <p>If your appeal is successful or your temporary ban expires:</p>
                    <ul>
                        <li>Access to the Service will be restored automatically</li>
                        <li>Previously created links may be reactivated (subject to review)</li>
                        <li>Your account will be monitored more closely for future violations</li>
                        <li>Any future violations may result in immediate permanent suspension</li>
                    </ul>
                    <p>Restored accounts are expected to comply fully with our <a href="/acceptable-use" target="_blank" rel="noopener noreferrer">Acceptable Use Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>. We recommend reviewing these policies carefully to avoid future enforcement actions.</p>

                    <h3>8. Prevention</h3>
                    <p>To avoid being banned from XURL:</p>
                    <ul>
                        <li>Only create shortened links to legitimate, safe, and legal destinations</li>
                        <li>Do not attempt to bypass rate limits or abuse detection systems</li>
                        <li>Respect the quota limits associated with your account tier</li>
                        <li>Do not use the Service for spam, phishing, malware distribution, or other malicious purposes</li>
                        <li>Report any suspicious shortened links you encounter to help keep the platform safe</li>
                    </ul>

                    <h3>9. Changes to This Policy</h3>
                    <p>We may update this Ban Policy from time to time to reflect changes in our enforcement practices or legal requirements. Material changes will be communicated through the Service. Your continued use of XURL after changes become effective constitutes acceptance of the revised policy.</p>
                </div>
            </main>
        </div>
    );
}

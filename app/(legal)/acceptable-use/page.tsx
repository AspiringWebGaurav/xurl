import { TopNavbar } from "@/components/layout/TopNavbar";

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
                        <li><strong>Malware & Phishing:</strong> Sites that distribute viruses, trojans, ransomware, or attempt to steal user credentials.</li>
                        <li><strong>Spam:</strong> Unsolicited promotional content, misleading redirects, or bulk email campaigns (unless explicitly solicited).</li>
                        <li><strong>Illegal Content:</strong> Any content that violates international laws or the laws of your jurisdiction.</li>
                        <li><strong>Hate Speech & Harassment:</strong> Content that promotes violence, discrimination, or targets individuals/groups maliciously.</li>
                    </ul>

                    <h3>Enforcement</h3>
                    <p>We employ automated systems and manual reviews to enforce this policy. We reserve the right to instantly disable any shortened URL and permanently ban any user account found violating these terms, without prior notice or refund of any subscription fees.</p>
                </div>
            </main>
        </div>
    );
}

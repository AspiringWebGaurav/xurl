import { TopNavbar } from "@/components/layout/TopNavbar";

export default function TermsPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>
                    
                    <h3>1. Acceptance of Terms</h3>
                    <p>By accessing and using XURL ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>

                    <h3>2. Description of Service</h3>
                    <p>XURL provides URL shortening, link management, and analytics services. The Service is provided "as is" and "as available". We reserve the right to modify or discontinue any part of the Service at any time.</p>

                    <h3>3. User Accounts & Subscriptions</h3>
                    <p>When you create an account, you must provide accurate information. You are responsible for maintaining the security of your account. Paid subscriptions are processed securely via Razorpay. Refunds are handled in accordance with our refund policy and applicable laws.</p>

                    <h3>4. Liability Limitation</h3>
                    <p>XURL shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to the loss of data or business interruptions.</p>
                </div>
            </main>
        </div>
    );
}

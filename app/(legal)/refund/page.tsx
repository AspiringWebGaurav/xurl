import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Refund Policy",
    description:
        "XURL Refund Policy: billing model, refund eligibility, cancellation rules, and chargeback policy for paid URL shortening plans.",
    alternates: { canonical: `${seo.url}/refund` },
    openGraph: {
        title: "Refund Policy — XURL",
        description: "Read the XURL Refund Policy.",
        url: `${seo.url}/refund`,
    },
};

export default function RefundPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col gap-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Refund Policy</h1>
                <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3>1. Billing Model</h3>
                    <p>XURL operates on a one-time purchase model. Paid plans are not subscriptions and do not auto-renew. Each purchase adds a fixed number of link creation credits to your cumulative quota permanently.</p>

                    <h3>2. Refund Eligibility</h3>
                    <p>You may be eligible for a refund in the following cases:</p>
                    <ul>
                        <li><strong>Technical Failure:</strong> Your payment was processed but the quota was not applied due to a system error that cannot be resolved by our support team.</li>
                        <li><strong>Duplicate Charge:</strong> You were charged multiple times for the same transaction unintentionally.</li>
                        <li><strong>Service Unavailability:</strong> The Service was completely unavailable for an extended period immediately following your purchase.</li>
                    </ul>

                    <h3>3. Non-Refundable Cases</h3>
                    <p>Refunds will not be issued for:</p>
                    <ul>
                        <li>Link credits that have already been used</li>
                        <li>Change of mind after purchase</li>
                        <li>Preference for a different plan tier</li>
                        <li>Accounts terminated for policy violations</li>
                        <li>Links that have reached their TTL expiry</li>
                    </ul>

                    <h3>4. Requesting a Refund</h3>
                    <p>To request a refund, contact us within 7 days of your purchase with your registered email address and transaction ID. Refund requests are reviewed within 5 business days. Approved refunds are processed through Razorpay to your original payment method and typically take 5&ndash;10 business days.</p>

                    <h3>5. Cancellation</h3>
                    <p>Since paid plans are one-time purchases, there is no recurring billing to cancel. Your purchased credits remain available until used. If you request account deletion, any unused quota will be forfeited and active links will be deactivated.</p>

                    <h3>6. Chargebacks</h3>
                    <p>If you initiate a chargeback without first contacting us, we reserve the right to immediately suspend your account and forfeit any remaining quota. We encourage you to contact us first to resolve billing disputes.</p>
                </div>
            </main>
        </div>
    );
}

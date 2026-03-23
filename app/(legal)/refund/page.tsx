import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
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

const sections = [
    {
        title: "Billing Model",
        content: (
            <p>XURL operates on a one-time purchase model. Paid plans are not subscriptions and do not auto-renew. Each purchase adds a fixed number of link creation credits to your cumulative quota permanently.</p>
        ),
    },
    {
        title: "Refund Eligibility",
        content: (
            <>
                <p>You may be eligible for a refund in the following cases:</p>
                <ul>
                    <li><strong>Technical Failure:</strong> Your payment was processed but the quota was not applied due to a system error that cannot be resolved by our support team.</li>
                    <li><strong>Duplicate Charge:</strong> You were charged multiple times for the same transaction unintentionally.</li>
                    <li><strong>Service Unavailability:</strong> The Service was completely unavailable for an extended period immediately following your purchase.</li>
                </ul>
            </>
        ),
    },
    {
        title: "Non-Refundable Cases",
        content: (
            <>
                <p>Refunds will not be issued for:</p>
                <ul>
                    <li>Link credits that have already been used</li>
                    <li>Change of mind after purchase</li>
                    <li>Preference for a different plan tier</li>
                    <li>Accounts terminated for policy violations</li>
                    <li>Links that have reached their TTL expiry</li>
                </ul>
            </>
        ),
    },
    {
        title: "Requesting a Refund",
        content: (
            <p>To request a refund, contact us within 7 days of your purchase with your registered email address and transaction ID. Refund requests are reviewed within 5 business days. Approved refunds are processed through Razorpay to your original payment method and typically take 5–10 business days.</p>
        ),
    },
    {
        title: "Cancellation",
        content: (
            <p>Since paid plans are one-time purchases, there is no recurring billing to cancel. Your purchased credits remain available until used. If you request account deletion, any unused quota will be forfeited and active links will be deactivated.</p>
        ),
    },
    {
        title: "Chargebacks",
        content: (
            <p>If you initiate a chargeback without first contacting us, we reserve the right to immediately suspend your account and forfeit any remaining quota. We encourage you to contact us first to resolve billing disputes.</p>
        ),
    },
];

export default function RefundPage() {
    return (
        <LegalPageShell
            title="Refund Policy"
            lastUpdated={new Date().toLocaleDateString()}
            sections={sections}
        />
    );
}

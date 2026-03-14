import type { Metadata } from "next";
import Link from "next/link";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Features — XURL URL Shortener",
    description:
        "Explore XURL features: instant link shortening, custom aliases, click analytics dashboard, QR codes, abuse protection, and fast global redirects.",
    alternates: { canonical: `${seo.url}/features` },
    openGraph: {
        title: "Features — XURL URL Shortener",
        description:
            "Explore XURL features: instant link shortening, custom aliases, click analytics, QR codes, and more.",
        url: `${seo.url}/features`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

const features = [
    {
        title: "Instant Link Shortening",
        description:
            "Create short URLs in one click. No account required for guest access — paste a URL and get a short link instantly with XURL.",
    },
    {
        title: "Custom Aliases",
        description:
            "Choose memorable, branded slugs for your short links. Available on all paid XURL plans for professional link management.",
    },
    {
        title: "Click Analytics Dashboard",
        description:
            "Track every click with XURL analytics. See referrers, devices, browsers, countries, and daily trends in a clean dashboard.",
    },
    {
        title: "Fast Global Redirects",
        description:
            "Three-tier caching — edge, Redis, and Firestore — ensures sub-millisecond redirect latency worldwide on the XURL platform.",
    },
    {
        title: "QR Code Generation",
        description:
            "Every XURL short link comes with an auto-generated QR code, ready to download and share in print or digital media.",
    },
    {
        title: "Abuse Protection",
        description:
            "XURL employs multi-layer defense: burst detection, rate limiting, abuse scoring, SSRF validation, and negative caching to keep links safe.",
    },
    {
        title: "Automatic Link Expiry",
        description:
            "Links expire automatically based on your XURL plan tier. From 5-minute guest links to 24-hour enterprise links — no manual cleanup needed.",
    },
    {
        title: "Secure Payments",
        description:
            "Upgrade your XURL plan securely through Razorpay. One-time purchases with idempotent processing — no recurring charges.",
    },
];

export default function FeaturesPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                        XURL Features
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed">
                        Everything you need for professional URL shortening, link analytics, and secure link management — all in one platform.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
                        >
                            <h2 className="text-lg font-semibold text-foreground mb-2">
                                {feature.title}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-foreground mb-4">
                        Ready to Get Started with XURL?
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        Create your first short link in seconds — no sign-up required.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <Link
                            href="/"
                            className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                        >
                            Create a Short Link
                        </Link>
                        <Link
                            href="/pricing"
                            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            View Pricing
                        </Link>
                    </div>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}

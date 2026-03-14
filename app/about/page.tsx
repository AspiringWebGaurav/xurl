import type { Metadata } from "next";
import Link from "next/link";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "About XURL — Modern URL Shortening Platform",
    description:
        "Learn about XURL, a modern URL shortening platform built for speed, security, and analytics. Our mission is to make link management simple and powerful.",
    alternates: { canonical: `${seo.url}/about` },
    openGraph: {
        title: "About XURL — Modern URL Shortening Platform",
        description:
            "Learn about XURL and our mission to make URL shortening simple, fast, and secure.",
        url: `${seo.url}/about`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

export default function AboutPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-8 sm:text-5xl">
                    About XURL
                </h1>

                <div className="prose prose-sm dark:prose-invert text-muted-foreground max-w-none">
                    <h2>Our Mission</h2>
                    <p>
                        XURL is a modern URL shortening platform built for developers, marketers, and businesses who need
                        fast, reliable, and secure link management. We believe shortened links should be more than just
                        redirect hops — they should provide insights, trust, and control.
                    </p>

                    <h2>What XURL Does</h2>
                    <p>
                        XURL transforms long URLs into clean, shareable short links with built-in click analytics.
                        Whether you need a quick guest link, a branded custom alias, or a full analytics dashboard,
                        XURL scales to fit your needs.
                    </p>

                    <h2>Built for Speed</h2>
                    <p>
                        XURL uses a three-tier caching architecture — edge in-memory, Redis, and Firestore — to deliver
                        sub-millisecond redirect latency. Links resolve at the edge before your browser even
                        finishes the DNS lookup.
                    </p>

                    <h2>Security First</h2>
                    <p>
                        Every URL submitted to XURL passes through SSRF validation, DNS resolution, and private IP
                        blocking. Our Redis-based abuse protection scores every request in real time, combining burst
                        detection, rate limiting, and behavioral analysis to keep the platform safe.
                    </p>

                    <h2>Transparent Pricing</h2>
                    <p>
                        XURL offers a generous free tier and straightforward one-time purchases for paid plans. No
                        subscriptions, no hidden fees, no auto-renewals. Buy credits when you need them, and they
                        never expire.
                    </p>

                    <h2>Technology</h2>
                    <p>
                        XURL is built on a modern serverless stack: Next.js, React, TypeScript, Firebase, Upstash
                        Redis, and Razorpay. The entire platform runs on edge and serverless infrastructure with zero
                        traditional servers to manage.
                    </p>
                </div>

                <div className="mt-12 flex items-center gap-4">
                    <Link
                        href="/"
                        className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                        Try XURL Now
                    </Link>
                    <Link
                        href="/features"
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                        Explore Features
                    </Link>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}

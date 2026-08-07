import type { Metadata } from "next";
import Link from "next/link";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Documentation — XURL",
    description:
        "Browse XURL documentation: architecture guides, API reference, deployment instructions, analytics setup, security practices, and developer guides.",
    alternates: { canonical: `${seo.url}/documentation` },
    openGraph: {
        title: "Documentation — XURL",
        description:
            "Comprehensive documentation for the XURL URL shortening platform.",
        url: `${seo.url}/documentation`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

const docs = [
    {
        title: "Architecture",
        description:
            "System design, three-tier caching, data flows, database schema, and background processing.",
        href: "https://github.com/your-org/xurl/tree/main/Documentation/Architecture.md",
    },
    {
        title: "API Reference",
        description:
            "Complete endpoint documentation with request/response examples, authentication, and rate limits.",
        href: "/documentation/api",
        internal: true,
    },
    {
        title: "Analytics",
        description:
            "Click tracking pipeline, dashboard features, data retention policies, and Redis buffering.",
        href: "https://github.com/your-org/xurl/tree/main/Documentation/Analytics.md",
    },
    {
        title: "Deployment Guide",
        description:
            "Environment variables, production checklist, Firebase setup, and infrastructure notes.",
        href: "https://github.com/your-org/xurl/tree/main/Documentation/Deployment.md",
    },
    {
        title: "Developer Guide",
        description:
            "Local setup, project patterns, available scripts, and contributing guidelines.",
        href: "https://github.com/your-org/xurl/tree/main/Documentation/Developer-Guide.md",
    },
    {
        title: "Security & Emergency Protocols",
        description:
            "Authentication model, abuse protection, rate limiting, Global Emergency Kill Switch, and Direct Appeals.",
        href: "/emergency-policy",
        internal: true,
    },
    {
        title: "Developer Guide",
        description:
            "Local setup, project patterns, available scripts, and contributing guidelines.",
        href: "https://github.com/your-org/xurl/tree/main/Documentation/Developer-Guide.md",
    },
];

export default function DocumentationPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 md:py-20">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4 sm:text-5xl">
                    XURL Documentation
                </h1>
                <p className="text-muted-foreground mb-12 text-base max-w-2xl">
                    Everything you need to understand, deploy, and build with the XURL platform.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {docs.map((doc) => (
                        <Link
                            key={doc.title}
                            href={doc.href}
                            target={doc.internal ? undefined : "_blank"}
                            rel={doc.internal ? undefined : "noopener noreferrer"}
                            className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md hover:border-foreground/20"
                        >
                            <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                                {doc.title}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {doc.description}
                            </p>
                        </Link>
                    ))}
                </div>

                {/* Policy Governance & Proprietary Technology Notice */}
                <div className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 backdrop-blur-xl space-y-4 shadow-sm">
                    <div className="flex items-center gap-3 text-foreground font-bold text-base">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            📜
                        </div>
                        <span>Strict Policy-Driven Architecture & Technology Protection</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        The XURL platform operates <strong>100% on policy-driven governance</strong>. All quota enforcement, rate limits, tier grants, and Emergency Maintenance Holds are strictly executed according to our published legal policies. To maintain platform integrity and security, public documentation defines external interface contracts only. Internal Edge routing mechanisms, anti-abuse scoring heuristics, and proprietary database architectures remain protected under trade secret and intellectual property policies.
                    </p>
                    <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold">
                        <Link href="/terms" className="text-primary hover:underline">
                            Terms of Service →
                        </Link>
                        <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy →
                        </Link>
                        <Link href="/emergency-policy" className="text-primary hover:underline">
                            Emergency Protocol Policy →
                        </Link>
                    </div>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}

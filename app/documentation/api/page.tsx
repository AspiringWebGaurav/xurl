import type { Metadata } from "next";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { ApiDocsClient } from "@/components/documentation/api/ApiDocsClient";
import { seo } from "@/lib/seo";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || seo.url;

export const metadata: Metadata = {
    title: "Developer API — XURL",
    description:
        "Production-ready XURL Developer API documentation with authenticated link creation, listing, analytics, quota guidance, and implementation examples.",
    alternates: { canonical: `${seo.url}/documentation/api` },
    openGraph: {
        title: "Developer API — XURL",
        description: "Developer-first API documentation for the XURL platform.",
        url: `${seo.url}/documentation/api`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

export default function DeveloperApiDocumentationPage() {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

    return (
        <div className="flex min-h-[100dvh] flex-col bg-background">
            <TopNavbar />
            <main className="flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">
                <div className="mx-auto mb-8 max-w-[1400px] rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Developer API
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                        XURL API Documentation
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                        Build against XURL with predictable authentication, clear endpoint contracts, and robust examples for production integrations.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className="rounded-md border border-border bg-muted px-3 py-1 font-mono text-xs text-foreground">
                            Base URL: {normalizedBaseUrl}/api/v1
                        </span>
                        <span className="rounded-md border border-border bg-muted px-3 py-1 font-mono text-xs text-foreground">
                            API Keys: /dashboard/api
                        </span>
                    </div>
                </div>

                <ApiDocsClient />
            </main>
            <HomeFooter />
        </div>
    );
}

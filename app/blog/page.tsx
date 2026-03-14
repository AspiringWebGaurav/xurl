import type { Metadata } from "next";
import Link from "next/link";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Blog — XURL",
    description:
        "Read the latest updates, feature announcements, and guides from the XURL team. Stay informed about URL shortening best practices and platform news.",
    alternates: { canonical: `${seo.url}/blog` },
    openGraph: {
        title: "Blog — XURL",
        description:
            "Updates, feature announcements, and guides from the XURL team.",
        url: `${seo.url}/blog`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

export default function BlogPage() {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 md:py-20">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4 sm:text-5xl">
                    XURL Blog
                </h1>
                <p className="text-muted-foreground mb-12 text-base">
                    Updates, announcements, and guides from the XURL team.
                </p>

                <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                        Coming Soon
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        We are preparing articles about URL shortening best practices, XURL feature deep-dives,
                        and platform updates. Check back soon.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                    >
                        Back to XURL
                    </Link>
                </div>
            </main>
            <HomeFooter />
        </div>
    );
}

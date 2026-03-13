import type { Metadata } from "next";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Analytics Dashboard — XURL",
    description:
        "Track clicks, referrers, devices, browsers, and countries with the XURL analytics dashboard. Visualize link performance with 30-day timelines.",
    alternates: { canonical: `${seo.url}/analytics` },
    openGraph: {
        title: "Analytics Dashboard — XURL",
        description:
            "Track link performance with click analytics, traffic breakdowns, and daily trends.",
        url: `${seo.url}/analytics`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return children;
}

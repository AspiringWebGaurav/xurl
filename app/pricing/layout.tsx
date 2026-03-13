import type { Metadata } from "next";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Pricing — XURL Plans and Pricing",
    description:
        "Compare XURL plans: free guest links, authenticated free tier, and paid plans starting at INR 49. Custom aliases, extended TTLs, and analytics included.",
    alternates: { canonical: `${seo.url}/pricing` },
    openGraph: {
        title: "Pricing — XURL Plans and Pricing",
        description:
            "Compare XURL plans from free to enterprise. One-time purchases, no subscriptions.",
        url: `${seo.url}/pricing`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}

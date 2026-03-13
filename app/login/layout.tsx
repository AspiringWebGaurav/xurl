import type { Metadata } from "next";
import { seo } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Sign In — XURL",
    description:
        "Sign in to XURL with Google to access authenticated features, paid plans, custom aliases, and your link analytics dashboard.",
    alternates: { canonical: `${seo.url}/login` },
    openGraph: {
        title: "Sign In — XURL",
        description:
            "Sign in to your XURL account to manage links and view analytics.",
        url: `${seo.url}/login`,
        images: [{ url: seo.ogImage, width: 1200, height: 630 }],
    },
    robots: {
        index: false,
        follow: true,
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}

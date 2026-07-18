import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BanGuard } from "@/components/layout/BanGuard";
import { Toaster } from "@/components/ui/sonner";
import { seo } from "@/lib/seo";
import { StructuredData } from "@/components/seo/StructuredData";
import { headers } from "next/headers";


const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
    metadataBase: new URL(seo.url),
    title: {
        default: seo.title,
        template: `%s | ${seo.siteName}`,
    },
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: seo.author }],
    creator: seo.author,
    publisher: seo.author,
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    alternates: {
        canonical: seo.url,
    },
    openGraph: {
        title: seo.openGraph.title,
        description: seo.openGraph.description,
        type: seo.openGraph.type,
        url: seo.url,
        siteName: seo.openGraph.siteName,
        images: [
            {
                url: seo.ogImage,
                width: 1200,
                height: 630,
                alt: "XURL — Modern URL Shortener with Analytics",
            },
        ],
        locale: "en_US",
    },
    twitter: {
        card: seo.twitter.card,
        title: seo.twitter.title,
        description: seo.twitter.description,
        images: [seo.ogImage],
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const headersList = await headers();
    const isMobileDevice = headersList.get('x-is-mobile-device') === 'true';

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script src="https://switchyy.eu.cc/switchy.js?key=pk_59ca8c1525d7dfebdaf4d2bc&project=rMvXJgJoFGuCTdxDB8jH" async />
            </head>
            <body className={`${inter.className} bg-background text-foreground`} suppressHydrationWarning>
                <StructuredData />
                <BanGuard isMobileDevice={isMobileDevice}>
                    {children}
                </BanGuard>
                <Toaster />
            </body>
        </html>
    );
}

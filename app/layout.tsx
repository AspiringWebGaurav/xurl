import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BanGuard } from "@/components/layout/BanGuard";
import { KillSwitchGuard } from "@/components/layout/KillSwitchGuard";
import { PartialOfferNotificationBanner } from "@/components/layout/PartialOfferNotificationBanner";
import { Toaster } from "@/components/ui/sonner";
import { seo } from "@/lib/seo";
import { StructuredData } from "@/components/seo/StructuredData";
import { ConfirmLinkProvider } from "@/components/providers/ConfirmLinkProvider";
import { RouteLoaderProvider } from "@/components/providers/RouteLoaderProvider";
import { ClientTelemetryProvider } from "@/components/providers/ClientTelemetryProvider";
import { AuthTransitionProvider } from "@/components/providers/AuthTransitionProvider";


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

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} min-h-dvh flex flex-col bg-background text-foreground`} suppressHydrationWarning>
                <ClientTelemetryProvider>
                    <AuthTransitionProvider>
                        <RouteLoaderProvider />
                        <StructuredData />
                        <KillSwitchGuard>
                            <ConfirmLinkProvider>
                                <BanGuard>
                                    <PartialOfferNotificationBanner />
                                    <div className="flex-1 min-h-0 flex flex-col w-full">
                                        {children}
                                    </div>
                                </BanGuard>
                            </ConfirmLinkProvider>
                        </KillSwitchGuard>
                        <Toaster />
                    </AuthTransitionProvider>
                </ClientTelemetryProvider>
            </body>
        </html>
    );
}

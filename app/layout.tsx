import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DesktopOnlyOverlay } from "@/components/layout/DesktopOnlyOverlay";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "XURL – URL Shortener",
  description: "Shorten your URLs instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        <DesktopOnlyOverlay>
          {children}
        </DesktopOnlyOverlay>
      </body>
    </html>
  );
}

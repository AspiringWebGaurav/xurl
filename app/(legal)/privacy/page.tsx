import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "XURL Privacy Policy: data collection practices, cookie usage, analytics, third-party sharing, user rights, and security measures.",
    alternates: { canonical: `${seo.url}/privacy` },
    openGraph: {
        title: "Privacy Policy — XURL",
        description: "Read the XURL Privacy Policy.",
        url: `${seo.url}/privacy`,
    },
};

export default async function PrivacyPage() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    const policy = await getPolicy("privacy");

    if (!policy) return notFound();

    const sections = policy.sections.map((s) => ({
        title: s.title,
        id: s.id,
        content: <ReactMarkdown>{s.content}</ReactMarkdown>,
    }));

    return (
        <LegalPageShell 
            isMobileDevice={isMobileDevice} 
            title={policy.title}
            lastUpdated={`Last Updated: ${policy.lastUpdated}`}
            sections={sections}
        />
    );
}

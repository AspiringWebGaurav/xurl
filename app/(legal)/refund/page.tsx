import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Refund Policy",
    description: "XURL Refund Policy.",
    alternates: { canonical: `${seo.url}/refund` },
    openGraph: {
        title: "Refund Policy — XURL",
        description: "XURL Refund Policy.",
        url: `${seo.url}/refund`,
    },
};

export default async function Page() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    const policy = await getPolicy("refund");

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

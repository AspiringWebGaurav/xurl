import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Guest Usage Policy",
    description: "XURL Guest Usage Policy.",
    alternates: { canonical: `${seo.url}/guest-policy` },
    openGraph: {
        title: "Guest Usage Policy — XURL",
        description: "XURL Guest Usage Policy.",
        url: `${seo.url}/guest-policy`,
    },
};

export default async function Page() {
    const policy = await getPolicy("guest-policy");

    if (!policy) return notFound();

    const sections = policy.sections.map((s) => ({
        title: s.title,
        id: s.id,
        content: <ReactMarkdown>{s.content}</ReactMarkdown>,
    }));

    return (
        <LegalPageShell 
            title={policy.title}
            lastUpdated={`Last Updated: ${policy.lastUpdated}`}
            sections={sections}
        />
    );
}

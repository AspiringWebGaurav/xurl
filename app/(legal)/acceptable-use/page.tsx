import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Acceptable Use Policy",
    description: "XURL Acceptable Use Policy.",
    alternates: { canonical: `${seo.url}/acceptable-use` },
    openGraph: {
        title: "Acceptable Use Policy — XURL",
        description: "XURL Acceptable Use Policy.",
        url: `${seo.url}/acceptable-use`,
    },
};

export default async function Page() {
    const policy = await getPolicy("acceptable-use");

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

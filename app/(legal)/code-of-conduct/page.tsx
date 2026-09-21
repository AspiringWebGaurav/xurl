import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Code of Conduct",
    description: "XURL Code of Conduct.",
    alternates: { canonical: `${seo.url}/code-of-conduct` },
    openGraph: {
        title: "Code of Conduct — XURL",
        description: "XURL Code of Conduct.",
        url: `${seo.url}/code-of-conduct`,
    },
};

export default async function Page() {
    const policy = await getPolicy("code-of-conduct");

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

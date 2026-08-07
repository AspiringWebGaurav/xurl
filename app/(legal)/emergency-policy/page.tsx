import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getPolicy } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Emergency Protocol & Incident Response Policy — XURL",
    description: "XURL Emergency Protocols: global kill switch mechanisms, edge security holds, API interception rules, and direct user appeal procedures.",
    alternates: { canonical: `${seo.url}/emergency-policy` },
    openGraph: {
        title: "Emergency Protocol Policy — XURL",
        description: "XURL Emergency Protocols: global kill switch mechanisms, edge security holds, and direct user appeal procedures.",
        url: `${seo.url}/emergency-policy`,
    },
};

export default async function Page() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    const policy = await getPolicy("emergency-policy");

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

import type { Metadata } from "next";
import { headers } from "next/headers";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { seo } from "@/lib/seo";
import { getAllPolicies } from "@/services/policies";
import ReactMarkdown from "react-markdown";
import { ConsentModal } from "./ConsentModal";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";

export const metadata: Metadata = {
    title: "Governing Data Policies",
    description: "XURL total governing data policies and legal guidelines.",
    alternates: { canonical: `${seo.url}/policy` },
};

export default async function TotalPolicyPage() {
    const headersList = await headers();
    const isMobileDevice = headersList.get("x-is-mobile-device") === "true";
    const policies = await getAllPolicies();

    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <ConsentModal />
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 lg:px-16 xl:px-28 py-6 md:py-8">
                <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                            XURL Enterprise Policies
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Total policies governing data, privacy, and service usage.
                        </p>
                    </div>
                </div>

                <div className="space-y-12">
                    {policies.map((policy) => (
                        <div key={policy.id} className="scroll-mt-24" id={policy.id}>
                            <div className="mb-4 pb-2 border-b border-border/50">
                                <h2 className="text-xl font-bold text-foreground">{policy.title}</h2>
                                <span className="text-xs text-muted-foreground">Last updated: {policy.lastUpdated}</span>
                            </div>
                            <div className="flex flex-col divide-y divide-border/30">
                                {policy.sections.map((section, i) => (
                                    <div key={i} id={section.id} className="py-4 first:pt-0 last:pb-0">
                                        <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
                                            {i + 1}. {section.title}
                                        </h3>
                                        <div className="text-sm text-muted-foreground leading-relaxed [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-sm [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground/90">
                                            <ReactMarkdown>{section.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
            {isMobileDevice ? <MobileFooter /> : <HomeFooter />}
        </div>
    );
}

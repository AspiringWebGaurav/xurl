"use client";

import { TopNavbar } from "@/components/layout/TopNavbar";

interface LegalSection {
    title: string;
    content: React.ReactNode;
}

interface LegalPageShellProps {
    title: string;
    lastUpdated?: string;
    sections: LegalSection[];
}

export function LegalPageShell({ title, lastUpdated, sections }: LegalPageShellProps) {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background">
            <TopNavbar isCreateDisabled={false} />
            <main className="flex-1 w-full px-4 sm:px-8 lg:px-16 xl:px-28 py-6 md:py-8">
                {/* Header */}
                <div className="mb-5 flex items-baseline justify-between border-b border-border pb-4">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">
                        {title}
                    </h1>
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground/60">
                            Last updated: {lastUpdated}
                        </span>
                    )}
                </div>

                {/* Sections */}
                <div className="flex flex-col gap-0 divide-y divide-border/50">
                    {sections.map((section, i) => (
                        <div key={i} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                            {/* Section number */}
                            <div className="flex-none">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                                    {i + 1}
                                </span>
                            </div>
                            {/* Section content */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-semibold text-foreground mb-1.5">
                                    {section.title}
                                </h2>
                                <div className="text-sm text-muted-foreground leading-relaxed [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-sm [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground/90">
                                    {section.content}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

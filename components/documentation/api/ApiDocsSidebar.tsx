"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ApiDocSection } from "./types";

interface ApiDocsSidebarProps {
    sections: Pick<ApiDocSection, "id" | "title">[];
    activeSectionId: string | null;
    onNavigate: (headingId: string) => void;
}

export function ApiDocsSidebar({ sections, activeSectionId, onNavigate }: ApiDocsSidebarProps) {
    const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    useEffect(() => {
        if (!activeSectionId) return;
        itemRefs.current[activeSectionId]?.scrollIntoView({ block: "nearest" });
    }, [activeSectionId]);

    return (
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Developer API
                    </p>
                    <h1 className="mt-1 text-lg font-semibold text-foreground">XURL API</h1>
                </div>

                <div className="px-2 py-3">
                    <nav className="space-y-1" aria-label="API documentation sections">
                        {sections.map((section) => {
                            const isActive = section.id === activeSectionId;

                            return (
                                <button
                                    key={section.id}
                                    ref={(element) => {
                                        itemRefs.current[section.id] = element;
                                    }}
                                    type="button"
                                    onClick={() => onNavigate(section.id)}
                                    className={cn(
                                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                        isActive
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                    aria-current={isActive ? "true" : undefined}
                                >
                                    {section.title}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </aside>
    );
}

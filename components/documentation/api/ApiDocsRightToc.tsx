"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ApiDocHeadingItem } from "./types";

interface ApiDocsRightTocProps {
    sectionTitle: string;
    headings: ApiDocHeadingItem[];
    activeHeadingId: string | null;
    onNavigate: (headingId: string) => void;
}

export function ApiDocsRightToc({
    sectionTitle,
    headings,
    activeHeadingId,
    onNavigate,
}: ApiDocsRightTocProps) {
    const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    useEffect(() => {
        if (!activeHeadingId) return;
        itemRefs.current[activeHeadingId]?.scrollIntoView({ block: "nearest" });
    }, [activeHeadingId]);

    if (headings.length === 0) return null;

    return (
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        On This Page
                    </p>
                    <p className="mt-1 text-sm text-foreground">{sectionTitle}</p>
                </div>

                <div className="px-2 py-3">
                    <nav className="space-y-1" aria-label="Current section headings">
                        {headings.map((heading) => {
                            const isActive = heading.id === activeHeadingId;

                            return (
                                <button
                                    key={heading.id}
                                    ref={(element) => {
                                        itemRefs.current[heading.id] = element;
                                    }}
                                    type="button"
                                    onClick={() => onNavigate(heading.id)}
                                    className={cn(
                                        "w-full rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
                                        heading.level === 3 ? "pl-5" : "pl-2",
                                        isActive
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                    aria-current={isActive ? "true" : undefined}
                                >
                                    {heading.title}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </aside>
    );
}

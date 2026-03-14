"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HomeFooter } from "@/components/layout/HomeFooter";

type PolicySection = {
    title: string;
    paragraphs?: readonly string[];
    intro?: string;
    list?: readonly string[];
    keyRules?: readonly {
        label: string;
        value: string;
    }[];
};

interface GuestPolicyContentProps {
    updatedAt: string;
    sections: readonly PolicySection[];
}

export function GuestPolicyContent({ updatedAt, sections }: GuestPolicyContentProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [showScrollHint, setShowScrollHint] = useState(false);

    const hintVisible = useMemo(() => showScrollHint, [showScrollHint]);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) {
            return;
        }

        const syncHintVisibility = () => {
            const hasOverflow = node.scrollHeight - node.clientHeight > 12;
            const hasScrolled = node.scrollTop > 16;
            setShowScrollHint(hasOverflow && !hasScrolled);
        };

        syncHintVisibility();

        node.addEventListener("scroll", syncHintVisibility, { passive: true });
        window.addEventListener("resize", syncHintVisibility);

        const resizeObserver = new ResizeObserver(syncHintVisibility);
        resizeObserver.observe(node);

        const contentNode = node.firstElementChild;
        if (contentNode instanceof HTMLElement) {
            resizeObserver.observe(contentNode);
        }

        return () => {
            node.removeEventListener("scroll", syncHintVisibility);
            window.removeEventListener("resize", syncHintVisibility);
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <>
            <main className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
                <div className="mx-auto h-full w-full max-w-[1500px]">
                    <article className="grid h-full min-h-0 w-full gap-4 overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur-sm sm:p-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-5">
                        <header className="flex min-h-0 flex-col rounded-[26px] border border-slate-200/70 bg-background/80 p-6 xl:p-7">
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                        Guest Access Rules
                                    </p>
                                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
                                        Guest / No-Login Policy
                                    </h1>
                                </div>

                                <div className="space-y-3 text-[15px] leading-7 text-muted-foreground">
                                    <p className="font-medium text-slate-500">Last updated: {updatedAt}</p>
                                    <p>
                                        This Guest / No-Login Policy governs access to XURL by users who create shortened
                                        links without signing in to an account. Guest access is offered as a limited
                                        convenience feature, not as an unrestricted or anonymous tier of service.
                                    </p>
                                </div>
                            </div>
                        </header>

                        <div className="relative min-h-0 min-w-0 overflow-hidden rounded-[26px] border border-slate-200/70 bg-background/60">
                            <div
                                ref={scrollRef}
                                className="h-full min-h-0 overflow-y-auto px-1 py-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                            >
                                <div className="grid min-w-0 gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3 auto-rows-fr">
                                    {sections.map((section) => (
                                        <section
                                            key={section.title}
                                            className="flex h-full min-h-[220px] min-w-0 flex-col rounded-[24px] border border-slate-200/70 bg-background/90 p-5 sm:p-6"
                                        >
                                            <div className="space-y-3 text-sm leading-7 text-muted-foreground">
                                                <h2 className="text-base font-semibold tracking-tight text-foreground">
                                                    {section.title}
                                                </h2>

                                                {section.paragraphs?.map((paragraph) => (
                                                    <p key={paragraph}>{paragraph}</p>
                                                ))}

                                                {section.intro && <p>{section.intro}</p>}

                                                {section.list && (
                                                    <ul className="space-y-2.5 pl-5">
                                                        {section.list.map((item) => (
                                                            <li key={item} className="list-disc marker:text-slate-400">
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}

                                                {section.keyRules && (
                                                    <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/95 p-4">
                                                        <div className="mb-3 flex items-center justify-between gap-3">
                                                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                                Key Rules
                                                            </p>
                                                            <div className="h-px flex-1 bg-slate-200/80" />
                                                        </div>

                                                        <div className="flex flex-col gap-3">
                                                            {section.keyRules.map((rule) => (
                                                                <div
                                                                    key={rule.label}
                                                                    className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3"
                                                                >
                                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                                        {rule.label}
                                                                    </p>
                                                                    <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-900">
                                                                        {rule.value}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </div>

                            <AnimatePresence>
                                {hintVisible && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
                                    >
                                        <div className="flex w-full items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent px-6 pb-4 pt-14">
                                            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur-sm">
                                                <span>Scroll</span>
                                                <ChevronDown className="h-3.5 w-3.5 animate-bounce text-slate-400" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </article>
                </div>
            </main>

            <HomeFooter />
        </>
    );
}
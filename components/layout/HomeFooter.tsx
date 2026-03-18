"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Link data                                                           */
/* ------------------------------------------------------------------ */

const footerColumns = [
    {
        label: "Product",
        links: [
            { href: "/pricing", label: "Pricing" },
            { href: "/analytics", label: "Analytics" },
        ],
    },
    {
        label: "Resources",
        links: [
            { href: "/documentation/api", label: "API" },
            { href: "/documentation", label: "Documentation" },
        ],
    },
    {
        label: "Legal",
        links: [
            { href: "/terms", label: "Terms of Service" },
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/acceptable-use", label: "Acceptable Use" },
            { href: "/refund", label: "Refund Policy" },
            { href: "/ban-policy", label: "Ban Policy" },
        ],
    },
    {
        label: "Support",
        links: [],
        comingSoon: ["Coming Soon"],
    },
];

const minimalLegalLinks = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/acceptable-use", label: "Acceptable Use" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function HomeFooter() {
    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState(0);

    useEffect(() => {
        const el = expandedRef.current;
        if (!el) return;
        const measure = () => setContentHeight(el.scrollHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const root =
            document.getElementById("home-root") ||
            document.getElementById("pricing-root") ||
            document.getElementById("login-root");
        if (!root) return;

        if (expanded) {
            root.style.overflow = "auto";
            requestAnimationFrame(() => {
                root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
            });
        } else {
            root.style.overflow = "hidden";
            root.scrollTo({ top: 0, behavior: "smooth" });
        }

        return () => {
            root.style.overflow = "";
        };
    }, [expanded]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (
                expanded &&
                footerRef.current &&
                !footerRef.current.contains(e.target as Node)
            ) {
                setExpanded(false);
            }
        };
        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [expanded]);

    return (
        <>
            {/* Keyframe injection */}
            <style>{`
                @keyframes footer-nudge {
                    0%, 100% { transform: translateY(0); }
                    40%       { transform: translateY(-3px); }
                    70%       { transform: translateY(1px); }
                }
                .footer-chevron-idle {
                    animation: footer-nudge 2.4s ease-in-out infinite;
                }
                .footer-chevron-idle:hover {
                    animation: none;
                }
                @keyframes footer-fadein {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .footer-col {
                    animation: footer-fadein 0.35s ease both;
                }
                .footer-col:nth-child(1) { animation-delay: 0.04s; }
                .footer-col:nth-child(2) { animation-delay: 0.10s; }
                .footer-col:nth-child(3) { animation-delay: 0.16s; }
                .footer-col:nth-child(4) { animation-delay: 0.22s; }
            `}</style>

            <footer ref={footerRef} className="shrink-0 border-t border-border bg-background">
                {/* ── Minimal row (always visible) ── */}
                <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-5 text-xs text-muted-foreground">
                    {/* Left — tagline */}
                    <p className="opacity-70 whitespace-nowrap">Minimal URL Shortener</p>

                    {/* Center — logo */}
                    <div className="justify-self-center opacity-80 transition-opacity hover:opacity-100">
                        <Logo size="sm" className="shrink-0" />
                    </div>

                    {/* Right — links + expand button */}
                    <nav
                        aria-label="Footer navigation"
                        className="flex items-center justify-end gap-1 flex-wrap"
                    >
                        {minimalLegalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="rounded-md px-2 py-1 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Divider */}
                        <span className="mx-1 h-3 w-px bg-border" aria-hidden="true" />

                        {/* Expand / Collapse button */}
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="group ml-0.5 flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse footer" : "Expand footer"}
                        >
                            <span
                                className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-300",
                                    !expanded && "footer-chevron-idle",
                                    expanded && "rotate-180"
                                )}
                            >
                                <ChevronUp className="h-full w-full" />
                            </span>
                            <span className="text-[11px] font-medium leading-none">
                                {expanded ? "Less" : "More"}
                            </span>
                        </button>
                    </nav>
                </div>

                {/* ── Expandable section ── */}
                <div
                    style={{
                        maxHeight: expanded ? contentHeight : 0,
                        opacity: expanded ? 1 : 0,
                    }}
                    className="overflow-hidden transition-all duration-300 ease-out"
                    aria-hidden={!expanded}
                >
                    <div ref={expandedRef} className="border-t border-border">
                        <div className="w-full px-10 xl:px-20 pt-10 pb-8">
                            {/* Link columns — 4-equal grid on desktop */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
                                {footerColumns.map((col) => (
                                    <div
                                        key={col.label}
                                        className={cn(
                                            "footer-col flex flex-col gap-3 text-xs",
                                            !expanded && "animation-none"
                                        )}
                                    >
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                                            {col.label}
                                        </span>
                                        <span className="w-6 h-px bg-foreground/20 -mt-1 mb-0.5" aria-hidden="true" />
                                        <div className="flex flex-col gap-2">
                                            {col.links.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    className="w-fit text-muted-foreground/80 transition-colors duration-150 hover:text-foreground font-medium"
                                                >
                                                    {link.label}
                                                </Link>
                                            ))}
                                            {col.comingSoon?.map((item) => (
                                                <span
                                                    key={item}
                                                    className="flex items-center gap-1.5 text-muted-foreground/50 cursor-default"
                                                >
                                                    {item}
                                                    <span className="rounded-sm border border-border bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                                                        Paid · Soon
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Copyright row */}
                            <div className="mt-10 flex items-center justify-between border-t border-border pt-5 text-[11px] text-muted-foreground/50">
                                <span>
                                    &copy; {new Date().getFullYear()} XURL. All rights reserved.
                                </span>
                                <span className="hidden sm:block opacity-60 tracking-wide">
                                    Built for speed.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}

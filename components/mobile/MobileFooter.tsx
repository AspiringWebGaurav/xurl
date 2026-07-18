"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

const footerColumns = [
    {
        label: "Product",
        links: [
            { href: "/mobile/plan", label: "Pricing" },
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
            { href: "/code-of-conduct", label: "Code of Conduct" },
            { href: "/guest-policy", label: "Guest Policy" },
            { href: "/refund", label: "Refund Policy" },
            { href: "/open-source", label: "Open Source" },
        ],
    },
];

const minimalLegalLinks = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
];

export function MobileFooter() {
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
            document.getElementById("login-root") ||
            document.documentElement;
            
        if (!root) return;

        if (expanded) {
            root.style.overflow = "auto";
            requestAnimationFrame(() => {
                root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
            });
        } else {
            root.style.overflow = "";
        }

        return () => {
            root.style.overflow = "";
        };
    }, [expanded]);

    useEffect(() => {
        const handleMouseDown = (e: TouchEvent | MouseEvent) => {
            if (
                expanded &&
                footerRef.current &&
                !footerRef.current.contains(e.target as Node)
            ) {
                setExpanded(false);
            }
        };
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("touchstart", handleMouseDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("touchstart", handleMouseDown);
        };
    }, [expanded]);

    return (
        <>
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
            `}</style>

            <footer ref={footerRef} className="shrink-0 border-t border-border bg-background mt-auto pb-[env(safe-area-inset-bottom)]">
                {/* ── Minimal row (always visible) ── */}
                <div className="flex w-full items-center justify-between gap-2 px-4 py-4 text-[11px] text-muted-foreground">
                    
                    {/* Left — logo */}
                    <div className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
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
                                className="rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
                            >
                                {link.label}
                            </Link>
                        ))}

                        <span className="mx-1 h-3 w-px bg-border" aria-hidden="true" />

                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="group ml-0.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse footer" : "Expand footer"}
                        >
                            <span className="text-[11px] font-medium leading-none">
                                {expanded ? "Less" : "More"}
                            </span>
                            <span
                                className={cn(
                                    "h-3 w-3 transition-transform duration-300",
                                    !expanded && "footer-chevron-idle",
                                    expanded && "rotate-180"
                                )}
                            >
                                <ChevronUp className="h-full w-full" />
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
                        <div className="w-full px-5 py-8">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
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
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 flex flex-col items-center border-t border-border pt-5 text-[10px] text-muted-foreground/50">
                                <span>&copy; {new Date().getFullYear()} XURL. All rights reserved.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}

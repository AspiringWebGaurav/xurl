"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConfirmLink } from "@/components/providers/ConfirmLinkProvider";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Link data                                                           */
/* ------------------------------------------------------------------ */

const footerColumns = [
    {
        label: "Product",
        links: [
            { href: "/pricing", label: "Pricing" },
            { href: "/analytics", label: "Analytics" },
            { href: "/features", label: "Features" },
            { href: "/integrations", label: "Integrations" },
        ],
    },
    {
        label: "Resources",
        links: [
            { href: "/documentation/api", label: "API" },
            { href: "/documentation", label: "Documentation" },
            { href: "/help-center", label: "Help Center" },
            { href: "/community", label: "Community" },
        ],
    },
    {
        label: "Company",
        links: [
            { href: "/about", label: "About Us" },
            { href: "/contact", label: "Contact" },
            { href: "/blog", label: "Blog" },
            { href: "/careers", label: "Careers" },
        ],
    },
    {
        label: "Legal",
        links: [
            { href: "/data-export", label: "Download My Data" },
            { href: "/policy", label: "All Policies" },
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
    { href: "/policy", label: "Policies" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function HomeFooter({ className }: { className?: string } = {}) {
    const pathname = usePathname();
    const isLandingPage = pathname === "/";

    const [expanded, setExpanded] = useState(false);
    const { handleLinkClick } = useConfirmLink();
    const footerRef = useRef<HTMLDivElement>(null);

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
            `}</style>

            <footer 
                ref={footerRef} 
                className={cn(
                    "relative shrink-0 transition-all duration-300",
                    isLandingPage 
                        ? "border-t-0 bg-transparent" 
                        : "border-t border-border/40 bg-background/30 backdrop-blur-xl dark:bg-slate-950/30 dark:border-white/10",
                    className
                )}
            >
                {/* ── Minimal row (always visible) ── */}
                <div className="w-full px-3.5 py-3 sm:px-6 sm:py-4 text-xs text-muted-foreground relative z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {/* Desktop layout (sm and up) */}
                    <div className="hidden sm:grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
                        {/* Left — tagline */}
                        <p className={cn("whitespace-nowrap transition-opacity", isLandingPage ? "text-slate-600/70 font-medium" : "opacity-70")}>
                            Minimal URL Shortener
                        </p>

                        {/* Center — logo */}
                        <div className="justify-self-center opacity-80 transition-opacity hover:opacity-100">
                            <Logo size="sm" className="shrink-0" />
                        </div>

                        {/* Right — links + expand button */}
                        <nav
                            aria-label="Footer navigation"
                            className="flex items-center justify-end gap-1 flex-wrap"
                        >
                            {minimalLegalLinks.map((link) => {
                                const isLegal = link.href === "/terms" || link.href === "/privacy";
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        target={isLegal ? "_blank" : undefined}
                                        onClick={(e) => {
                                            if (!isLegal) {
                                                handleLinkClick(e, link.href);
                                            }
                                        }}
                                        className={cn(
                                            "rounded-md px-2 py-1 transition-colors duration-150 no-underline",
                                            isLandingPage 
                                                ? "text-slate-600/80 hover:bg-slate-200/50 hover:text-slate-900 font-medium" 
                                                : "hover:bg-muted/70 hover:text-foreground"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}

                            {/* Divider */}
                            <span className={cn("mx-1 h-3 w-px", isLandingPage ? "bg-slate-300/60" : "bg-border")} aria-hidden="true" />

                            {/* Expand / Collapse button */}
                            <button
                                type="button"
                                onClick={() => setExpanded((prev) => !prev)}
                                className={cn(
                                    "group ml-0.5 flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-150 cursor-pointer",
                                    isLandingPage 
                                        ? "text-slate-600/80 hover:bg-slate-200/50 hover:text-slate-900 font-medium" 
                                        : "text-muted-foreground/70 hover:bg-muted/70 hover:text-foreground"
                                )}
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

                    {/* Mobile layout (sm:hidden — Separate clickable Terms & Privacy links) */}
                    <div className="flex sm:hidden items-center justify-between gap-3 w-full px-1">
                        {/* Mobile Left: Logo & optional tagline */}
                        <div className="flex items-center gap-2 shrink-0 opacity-90 transition-opacity hover:opacity-100">
                            <Logo size="sm" className="shrink-0" />
                            <span className={cn("text-[11px] font-semibold tracking-tight hidden min-[390px]:inline-block", isLandingPage ? "text-slate-600/90" : "text-muted-foreground/80")}>
                                Minimal URL Shortener
                            </span>
                        </div>

                        {/* Mobile Right: Separate clickable Terms & Privacy links + More button */}
                        <nav
                            aria-label="Mobile footer navigation"
                            className="flex items-center gap-1 shrink-0 justify-end"
                        >
                            <Link
                                href="/terms"
                                target="_blank"
                                className={cn(
                                    "rounded-md px-1.5 py-1 text-xs transition-colors duration-150 no-underline whitespace-nowrap font-medium",
                                    isLandingPage 
                                        ? "text-slate-700/80 hover:bg-slate-200/60 hover:text-slate-900" 
                                        : "text-muted-foreground/90 hover:bg-muted/70 hover:text-foreground"
                                )}
                            >
                                Terms
                            </Link>

                            <Link
                                href="/privacy"
                                target="_blank"
                                className={cn(
                                    "rounded-md px-1.5 py-1 text-xs transition-colors duration-150 no-underline whitespace-nowrap font-medium",
                                    isLandingPage 
                                        ? "text-slate-700/80 hover:bg-slate-200/60 hover:text-slate-900" 
                                        : "text-muted-foreground/90 hover:bg-muted/70 hover:text-foreground"
                                )}
                            >
                                Privacy
                            </Link>

                            <span className={cn("mx-1 h-3.5 w-px shrink-0 opacity-60", isLandingPage ? "bg-slate-300" : "bg-border")} aria-hidden="true" />

                            <button
                                type="button"
                                onClick={() => setExpanded((prev) => !prev)}
                                className={cn(
                                    "group flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors duration-150 cursor-pointer shrink-0 whitespace-nowrap",
                                    isLandingPage 
                                        ? "text-slate-700/80 hover:bg-slate-200/60 hover:text-slate-900" 
                                        : "text-muted-foreground/80 hover:bg-muted/70 hover:text-foreground"
                                )}
                                aria-expanded={expanded}
                                aria-label={expanded ? "Collapse footer" : "Expand footer"}
                            >
                                <span className="leading-none">
                                    {expanded ? "Less" : "More"}
                                </span>
                                <span
                                    className={cn(
                                        "h-3.5 w-3.5 transition-transform duration-300",
                                        !expanded && "footer-chevron-idle",
                                        expanded && "rotate-180"
                                    )}
                                >
                                    <ChevronUp className="h-full w-full" />
                                </span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* ── Slide-Up Overlay Drawer (Does NOT push middle UI) ── */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                                "absolute bottom-full left-0 right-0 z-50 rounded-t-3xl overflow-hidden shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.2)]",
                                isLandingPage
                                    ? "bg-white/95 text-slate-900 border-t border-x border-slate-200/80 backdrop-blur-xl"
                                    : "bg-card dark:bg-slate-900 border-t border-x border-border/80 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.35)]"
                            )}
                        >
                            <div className="w-full px-10 xl:px-20 pt-8 pb-6">
                                {/* Link columns — 4-equal grid on desktop */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
                                    {footerColumns.map((col) => (
                                        <div
                                            key={col.label}
                                            className="flex flex-col gap-3 text-xs"
                                        >
                                            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                                                {col.label}
                                            </span>
                                            <span className="w-6 h-px bg-foreground/20 -mt-1 mb-0.5" aria-hidden="true" />
                                            <div className="flex flex-col gap-2">
                                                {col.links.map((link) => {
                                                    const isLegal = link.href === "/terms" || link.href === "/privacy";
                                                    return (
                                                        <Link
                                                            key={link.href}
                                                            href={link.href}
                                                            target={isLegal ? "_blank" : undefined}
                                                            onClick={(e) => {
                                                                if (!isLegal) {
                                                                    handleLinkClick(e, link.href);
                                                                }
                                                            }}
                                                            className="w-fit text-muted-foreground/80 transition-colors duration-150 hover:text-foreground font-medium no-underline"
                                                        >
                                                            {link.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Copyright row */}
                                <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-4 text-[11px] text-muted-foreground/60">
                                    <span>
                                        &copy; {new Date().getFullYear()} XURL. All rights reserved.
                                    </span>
                                    <span className="hidden sm:block opacity-70 tracking-wide">
                                        Built for speed.
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </footer>
        </>
    );
}

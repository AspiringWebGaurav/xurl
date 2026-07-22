"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { useConfirmLink } from "@/components/providers/ConfirmLinkProvider";
import { cn } from "@/lib/utils";
import { ChevronUp, ExternalLink } from "lucide-react";

const footerColumns = [
    {
        label: "Product",
        links: [
            { href: "/mobile/plan", label: "Pricing" },
            { href: "/mobile/analytics", label: "Analytics" },
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

export function MobileFooter() {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const { handleLinkClick } = useConfirmLink();
    const footerRef = useRef<HTMLDivElement>(null);

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

            <footer ref={footerRef} className="shrink-0 border-t border-border bg-background mt-auto pb-[env(safe-area-inset-bottom)] relative z-50">
                {/* ── Expandable section (Bottom Drawer) ── */}
                <div
                    className={cn(
                        "absolute bottom-full left-0 w-full bg-background transition-all duration-300 ease-out overflow-y-auto rounded-t-3xl shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.2)]",
                        expanded ? "max-h-[75vh] opacity-100 border-t border-x border-border" : "max-h-0 opacity-0 border-transparent"
                    )}
                    aria-hidden={!expanded}
                >
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
                                                onClick={(e) => handleLinkClick(e, link.href)}
                                                className="w-fit text-muted-foreground/80 transition-colors duration-150 hover:text-foreground font-medium no-underline"
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

                {/* ── Minimal row (always visible at absolute bottom) ── */}
                <div className="relative flex w-full items-center justify-center px-4 py-4 min-h-[56px] text-[11px] text-muted-foreground bg-background">
                    
                    {/* Left — logo */}
                    <div className="absolute left-2 flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
                        <Logo size="sm" className="shrink-0" />
                    </div>

                    {/* Center — links */}
                    <nav
                        aria-label="Footer navigation"
                        className="flex items-center justify-center gap-1 flex-wrap z-10"
                    >
                        {minimalLegalLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={(e) => handleLinkClick(e, link.href)}
                                className="rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground no-underline"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right — expand button */}
                    <div className="absolute right-2 flex items-center">
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/70 hover:text-foreground"
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
                    </div>
                </div>
            </footer>
        </>
    );
}

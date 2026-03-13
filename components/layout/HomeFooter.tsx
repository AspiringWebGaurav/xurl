"use client";

import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Link data                                                         */
/* ------------------------------------------------------------------ */

const productLinks = [
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/analytics", label: "Analytics" },
    { href: "/api-docs", label: "API" },
    { href: "/documentation", label: "Documentation" },
];

const companyLinks = [
    { href: "/about", label: "About" },
    { href: "/blog", label: "Blog" },
];

const legalLinks = [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/acceptable-use", label: "Acceptable Use" },
    { href: "/refund", label: "Refund Policy" },
];

/* ------------------------------------------------------------------ */
/*  Minimal footer row (always visible)                               */
/* ------------------------------------------------------------------ */

const minimalLegalLinks = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/acceptable-use", label: "Acceptable Use" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function HomeFooter() {
    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState(0);

    /* Measure expanded content height on mount & resize */
    useEffect(() => {
        const el = expandedRef.current;
        if (!el) return;

        const measure = () => setContentHeight(el.scrollHeight);
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    /* Toggle body overflow so the page becomes scrollable when expanded */
    useEffect(() => {
        const root = document.getElementById("home-root") || document.getElementById("pricing-root") || document.getElementById("login-root");
        if (!root) return;

        if (expanded) {
            root.style.overflow = "auto";
            // Scroll to bottom so expanded content is visible
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

    const linkClass =
        "text-muted-foreground transition-colors duration-200 hover:text-foreground";

    return (
        <footer className="shrink-0 border-t border-border bg-background">
            {/* ── Minimal row (always shown) ──────────────────────── */}
            <div className="flex w-full flex-col gap-3 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center px-4 py-6">
                {/* Left — tagline */}
                <div className="flex w-full items-center justify-start">
                    <p className="text-xs text-muted-foreground opacity-80">
                        Minimal URL Shortener
                    </p>
                </div>

                {/* Center — logo */}
                <div className="opacity-80 transition-opacity hover:opacity-100 sm:justify-self-center">
                    <Logo size="sm" className="shrink-0" />
                </div>

                {/* Right — legal links + expand trigger */}
                <nav
                    aria-label="Footer"
                    className="flex w-full flex-wrap items-center gap-4 justify-end"
                >
                    {minimalLegalLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md px-2 py-1 transition-colors duration-200 hover:bg-muted/70 hover:text-foreground"
                        >
                            {link.label}
                        </a>
                    ))}

                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground/70 transition-colors duration-200 hover:bg-muted/70 hover:text-foreground"
                        aria-expanded={expanded}
                        aria-label={expanded ? "Collapse footer" : "Expand footer"}
                    >
                        <ChevronUp
                            className={cn(
                                "h-3.5 w-3.5 transition-transform duration-300",
                                expanded && "rotate-180"
                            )}
                        />
                        <span className="text-[11px] font-medium">
                            {expanded ? "Less" : "More"}
                        </span>
                    </button>
                </nav>
            </div>

            {/* ── Expandable section ─────────────────────────────── */}
            <div
                style={{
                    maxHeight: expanded ? contentHeight : 0,
                    opacity: expanded ? 1 : 0,
                }}
                className="overflow-hidden transition-all duration-300 ease-out"
            >
                <div ref={expandedRef} className="border-t border-border px-4 pt-8 pb-6">
                    <div className="mx-auto w-full max-w-[1120px] flex flex-col gap-8">
                        {/* Link columns */}
                        <div className="flex w-full flex-wrap gap-10 text-xs">
                            {/* Product */}
                            <div className="flex flex-col gap-2">
                                <span className="font-medium text-foreground">
                                    Product
                                </span>
                                {productLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={linkClass}
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>

                            {/* Resources */}
                            <div className="flex flex-col gap-2">
                                <span className="font-medium text-foreground">
                                    Resources
                                </span>
                                <a
                                    href="/api-docs"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={linkClass}
                                >
                                    API
                                </a>
                                <a
                                    href="/documentation"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={linkClass}
                                >
                                    Documentation
                                </a>
                            </div>

                            {/* Legal */}
                            <div className="flex flex-col gap-2">
                                <span className="font-medium text-foreground">
                                    Legal
                                </span>
                                {legalLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={linkClass}
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>

                            {/* Company */}
                            <div className="flex flex-col gap-2">
                                <span className="font-medium text-foreground">
                                    Company
                                </span>
                                {companyLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={linkClass}
                                    >
                                        {link.label}
                                    </a>
                                ))}
                                <span className="text-muted-foreground/60">
                                    Support — Coming Soon
                                </span>
                            </div>
                        </div>

                        {/* Copyright */}
                        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                            &copy; {new Date().getFullYear()} XURL. All rights
                            reserved.
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

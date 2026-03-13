import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

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

interface SiteFooterProps {
    className?: string;
    panelClassName?: string;
    linkClassName?: string;
    taglineClassName?: string;
    logoClassName?: string;
    layout?: "center" | "split";
    brandHref?: string;
    brandLabel?: string;
}

export function SiteFooter({
    className,
    panelClassName,
    linkClassName,
    taglineClassName,
    logoClassName,
    layout = "center",
    brandHref = "/",
    brandLabel = "Modern URL Shortener",
}: SiteFooterProps) {
    const isSplitLayout = layout === "split";

    const linkClass = cn(
        "text-muted-foreground transition-colors duration-200 hover:text-foreground",
        linkClassName
    );

    return (
        <footer
            className={cn(
                "shrink-0 border-t border-border bg-background px-4 py-8",
                className
            )}
        >
            <div
                className={cn(
                    "mx-auto w-full max-w-[1120px] flex flex-col gap-8",
                    panelClassName
                )}
            >
                <div
                    className={cn(
                        isSplitLayout
                            ? "flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"
                            : "flex flex-col gap-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-start"
                    )}
                >
                    {isSplitLayout ? (
                        <Link
                            href={brandHref}
                            className="flex items-center gap-3 opacity-80 transition-opacity hover:opacity-100"
                        >
                            <Logo size="sm" href={null} className={cn("shrink-0", logoClassName)} />
                            <p
                                className={cn(
                                    "text-xs opacity-80",
                                    taglineClassName
                                )}
                            >
                                {brandLabel}
                            </p>
                        </Link>
                    ) : (
                        <>
                            <div className="flex w-full items-start justify-start">
                                <p
                                    className={cn(
                                        "text-xs text-muted-foreground opacity-80",
                                        taglineClassName
                                    )}
                                >
                                    {brandLabel}
                                </p>
                            </div>

                            <div className="opacity-80 transition-opacity hover:opacity-100 sm:justify-self-center">
                                <Logo size="sm" className={cn("shrink-0", logoClassName)} />
                            </div>
                        </>
                    )}

                    <div className="flex w-full flex-wrap gap-8 text-xs sm:justify-end">
                        <div className="flex flex-col gap-2">
                            <span className="font-medium text-foreground">Product</span>
                            {productLinks.map((link) => (
                                <Link key={link.href} href={link.href} className={linkClass}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="font-medium text-foreground">Company</span>
                            {companyLinks.map((link) => (
                                <Link key={link.href} href={link.href} className={linkClass}>
                                    {link.label}
                                </Link>
                            ))}
                            <span className="text-muted-foreground/60">Support — Coming Soon</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="font-medium text-foreground">Legal</span>
                            {legalLinks.map((link) => (
                                <Link key={link.href} href={link.href} className={linkClass}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} XURL. All rights reserved.
                </div>
            </div>
        </footer>
    );
}

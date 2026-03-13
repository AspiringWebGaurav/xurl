import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const legalLinks = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/acceptable-use", label: "Acceptable Use" },
];

type SiteFooterLink = {
    href: string;
    label: string;
    target?: string;
    rel?: string;
};

interface SiteFooterProps {
    className?: string;
    panelClassName?: string;
    linkClassName?: string;
    taglineClassName?: string;
    logoClassName?: string;
    links?: SiteFooterLink[];
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
    links = legalLinks,
    layout = "center",
    brandHref = "/",
    brandLabel = "Minimal URL Shortener",
}: SiteFooterProps) {
    const isSplitLayout = layout === "split";

    return (
        <footer
            className={cn(
                "shrink-0 border-t border-border bg-background px-4 py-6",
                className
            )}
        >
            <div
                className={cn(
                    isSplitLayout
                        ? "mx-auto flex w-full max-w-[1120px] flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
                        : "flex w-full flex-col gap-3 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center",
                    panelClassName
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
                        <div className="flex w-full items-center justify-start">
                            <p
                                className={cn(
                                    "text-xs opacity-80",
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

                <nav
                    aria-label="Legal"
                    className={cn(
                        "flex w-full flex-wrap items-center gap-4",
                        isSplitLayout ? "justify-start sm:ml-auto sm:w-auto sm:justify-end" : "justify-end"
                    )}
                >
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            target={link.target ?? "_blank"}
                            rel={link.rel ?? "noopener noreferrer"}
                            className={cn(
                                "rounded-md px-2 py-1 transition-colors duration-200 hover:bg-muted/70 hover:text-foreground",
                                linkClassName
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    );
}

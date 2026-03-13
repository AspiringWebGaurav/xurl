"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface UpgradeNavbarProps {
    backLabel?: string;
    backHref?: string;
    logoHref?: string;
    homeHref?: string;
    homeLabel?: string;
    showHomeLink?: boolean;
    onBack?: () => void;
    className?: string;
    contentClassName?: string;
}

const actionBase =
    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]";

export function UpgradeNavbar({
    backLabel = "Back",
    backHref,
    logoHref = "/",
    homeHref,
    homeLabel = "Home",
    showHomeLink = true,
    onBack,
    className,
    contentClassName,
}: UpgradeNavbarProps) {
    return (
        <header className={cn("relative z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-sm", className)}>
            <div className={cn("mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6 lg:px-10", contentClassName)}>
                <Logo size="md" href={logoHref} />

                <nav className="flex items-center gap-2">
                    {backHref ? (
                        <Link
                            href={backHref}
                            className={cn(
                                actionBase,
                                "gap-2 border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {backLabel}
                        </Link>
                    ) : onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className={cn(
                                actionBase,
                                "gap-2 border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {backLabel}
                        </button>
                    ) : null}

                    {showHomeLink && homeHref ? (
                        <Link
                            href={homeHref}
                            className={cn(
                                actionBase,
                                "gap-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            )}
                        >
                            <Home className="h-4 w-4" />
                            <span className="hidden sm:inline">{homeLabel}</span>
                        </Link>
                    ) : null}
                </nav>
            </div>
        </header>
    );
}

"use client";

import { useState, type MouseEvent } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiHeadingAnchorProps {
    id: string;
    title: string;
    level: 2 | 3;
    className?: string;
}

export function ApiHeadingAnchor({ id, title, level, className }: ApiHeadingAnchorProps) {
    const [copied, setCopied] = useState(false);

    const copyHeadingUrl = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (typeof window === "undefined") return;

        const headingUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(headingUrl);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = headingUrl;
                textarea.setAttribute("readonly", "true");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            window.history.replaceState(
                null,
                "",
                `${window.location.pathname}${window.location.search}#${id}`
            );
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    const HeadingTag = level === 2 ? "h2" : "h3";

    return (
        <HeadingTag
            id={id}
            className={cn(
                "group/heading flex scroll-mt-28 items-center gap-2 tracking-tight text-foreground",
                level === 2 ? "text-2xl font-semibold sm:text-3xl" : "text-xl font-semibold",
                className
            )}
        >
            <a href={`#${id}`} className="inline-flex items-center gap-2 hover:underline underline-offset-4">
                {title}
            </a>
            <button
                type="button"
                onClick={copyHeadingUrl}
                className="inline-flex items-center rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 group-hover/heading:opacity-100"
                aria-label={`Copy direct link to ${title}`}
                title={copied ? "Copied" : "Copy link"}
            >
                {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            </button>
        </HeadingTag>
    );
}

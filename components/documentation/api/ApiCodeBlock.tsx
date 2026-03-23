"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiCodeSnippet } from "./types";

interface ApiCodeBlockProps {
    snippet: ApiCodeSnippet;
}

export function ApiCodeBlock({ snippet }: ApiCodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(snippet.code);
            } else if (typeof document !== "undefined") {
                const textarea = document.createElement("textarea");
                textarea.value = snippet.code;
                textarea.setAttribute("readonly", "true");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {snippet.label} · {snippet.language}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Copy ${snippet.label} code`}
                >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                </Button>
            </div>
            <pre className="overflow-x-auto bg-muted/20 p-4 text-sm leading-6 text-foreground">
                <code>{snippet.code}</code>
            </pre>
        </div>
    );
}

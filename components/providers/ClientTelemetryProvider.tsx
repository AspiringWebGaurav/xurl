"use client";

import React, { useEffect, Component, ReactNode } from "react";

interface TelemetryPayload {
    errorName: string;
    message: string;
    route: string;
    stackSnippet?: string;
    browserSummary?: string;
}

// In-memory deduplication cache: errorSignature -> lastSentTimestamp
const clientDedupeMap = new Map<string, number>();
const DEDUPE_TTL_MS = 10_000; // 10 seconds

function getBrowserSummary(): string {
    if (typeof window === "undefined" || !navigator.userAgent) return "Unknown";
    const ua = navigator.userAgent;
    let browser = "Browser";
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Safari/")) browser = "Safari";
    else if (ua.includes("Edge/")) browser = "Edge";

    let os = "OS";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser} (${os})`;
}

function sendTelemetry(payload: TelemetryPayload) {
    if (typeof window === "undefined") return;

    try {
        const routePath = window.location.pathname; // Strictly pathname ONLY
        const signature = `${payload.errorName}:${payload.message}:${routePath}`;
        const now = Date.now();
        const lastSent = clientDedupeMap.get(signature) || 0;

        if (now - lastSent < DEDUPE_TTL_MS) {
            return; // Deduplicated locally
        }
        clientDedupeMap.set(signature, now);

        // Filter browser extension errors
        const stack = payload.stackSnippet || "";
        if (
            stack.includes("chrome-extension://") ||
            stack.includes("moz-extension://") ||
            stack.includes("safari-extension://")
        ) {
            return;
        }

        // Filter expected network / validation noise
        const msg = payload.message || "";
        if (
            msg.includes("RATE_LIMITED") ||
            msg.includes("GUEST_LIMIT") ||
            msg.includes("UNAUTHORIZED") ||
            msg.includes("FORBIDDEN") ||
            msg.includes("Failed to fetch") ||
            msg.includes("Load failed")
        ) {
            return;
        }

        const sanitizedPayload = JSON.stringify({
            errorName: (payload.errorName || "Error").slice(0, 50),
            message: msg.slice(0, 150),
            route: routePath.slice(0, 100),
            stackSnippet: stack.slice(0, 300),
            browserSummary: getBrowserSummary(),
        });

        // Non-blocking dispatch via sendBeacon or keepalive fetch inside setTimeout(..., 0)
        setTimeout(() => {
            try {
                if (navigator.sendBeacon) {
                    const blob = new Blob([sanitizedPayload], { type: "application/json" });
                    navigator.sendBeacon("/api/public/log-client-error", blob);
                } else {
                    void fetch("/api/public/log-client-error", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: sanitizedPayload,
                        keepalive: true,
                    }).catch(() => {
                        // Silent fail open
                    });
                }
            } catch {
                // Silent fail open - NEVER throw or trigger secondary console.error
            }
        }, 0);
    } catch {
        // Silent fail open
    }
}

// ─── React Error Boundary ───
interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ReactErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        sendTelemetry({
            errorName: error.name || "ReactRenderError",
            message: error.message || "React component crash",
            route: typeof window !== "undefined" ? window.location.pathname : "/",
            stackSnippet: errorInfo.componentStack || error.stack || "",
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white text-center">
                    <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900/80 p-8 backdrop-blur-xl space-y-4">
                        <h2 className="text-xl font-bold">Something went wrong</h2>
                        <p className="text-sm text-slate-400">An unexpected error occurred in this view.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─── Main Client Provider ───
export function ClientTelemetryProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            sendTelemetry({
                errorName: event.error?.name || "UncaughtError",
                message: event.message || event.error?.message || "Uncaught window exception",
                route: typeof window !== "undefined" ? window.location.pathname : "/",
                stackSnippet: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
            });
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const msg = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled rejection";
            const name = reason instanceof Error ? reason.name : "UnhandledPromiseRejection";
            const stack = reason instanceof Error ? reason.stack || "" : "";

            sendTelemetry({
                errorName: name,
                message: msg,
                route: typeof window !== "undefined" ? window.location.pathname : "/",
                stackSnippet: stack,
            });
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleRejection);
        };
    }, []);

    return <ReactErrorBoundary>{children}</ReactErrorBoundary>;
}

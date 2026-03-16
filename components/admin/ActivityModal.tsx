"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { X } from "lucide-react";
import type { ActivityEvent } from "@/lib/admin/activity-events";

const severityStyles: Record<string, string> = {
    INFO: "border-slate-200 bg-slate-50 text-slate-600",
    ADMIN: "border-indigo-200 bg-indigo-50 text-indigo-700",
    BILLING: "border-emerald-200 bg-emerald-50 text-emerald-700",
    SECURITY: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatMetadataValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((item) => formatMetadataValue(item)).join(", ");
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

type ActivityModalProps = {
    open: boolean;
    title: string;
    subtitle?: string;
    items: ActivityEvent[];
    loading?: boolean;
    loadingMore?: boolean;
    live?: boolean;
    newActivity?: boolean;
    highlightedIds?: string[];
    onClose: () => void;
    onJumpToLatest?: () => void;
    scrollRef?: RefObject<HTMLDivElement | null>;
    onScroll?: () => void;
};

export function ActivityModal({
    open,
    title,
    subtitle,
    items,
    loading = false,
    loadingMore = false,
    live = false,
    newActivity = false,
    highlightedIds,
    onClose,
    onJumpToLatest,
    scrollRef,
    onScroll,
}: ActivityModalProps) {
    const highlightSet = useMemo(() => new Set(highlightedIds ?? []), [highlightedIds]);

    useEffect(() => {
        if (!open) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]"
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                style={{ animation: "fadeUp 0.2s ease" }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        {subtitle && <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{subtitle}</p>}
                        <p className="mt-1 text-lg font-semibold text-slate-900">{title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                    {live ? (
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                            <span className="text-emerald-500">●</span>
                            Live
                        </div>
                    ) : (
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent activity</div>
                    )}
                    {newActivity && onJumpToLatest && (
                        <button
                            type="button"
                            onClick={onJumpToLatest}
                            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                        >
                            New activity available · Jump to latest
                        </button>
                    )}
                </div>
                <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1"
                >
                    {loading ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading activity…</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No activity found.</div>
                    ) : (
                        items.map((item) => {
                            const metadata = item.metadata || {};
                            const message = typeof metadata.message === "string" ? metadata.message : null;
                            const entries = Object.entries(metadata).filter(([key, value]) => key !== "message" && value !== undefined && value !== null);
                            const preview = entries.slice(0, 4);
                            const severity = item.severity || "INFO";
                            const highlightKey = `${item.id}:${item.timestamp}`;
                            const highlight = highlightSet.has(highlightKey);

                            return (
                                <div
                                    key={highlightKey}
                                    className={`rounded-xl border px-4 py-3 transition ${highlight ? "border-emerald-200 bg-emerald-50/70" : "border-slate-100 bg-slate-50/80"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                                    {item.type.replace(/_/g, " ")}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                                        severityStyles[severity] || severityStyles.INFO
                                                    }`}
                                                >
                                                    {severity}
                                                </span>
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                    {item.sourceCollection}
                                                </span>
                                            </div>
                                            {message && <p className="text-sm font-semibold leading-6 text-slate-900">{message}</p>}
                                            {item.actor && <p className="text-xs font-medium text-slate-600">Actor: {item.actor}</p>}
                                            {preview.length > 0 && (
                                                <div className="grid gap-1 text-xs text-slate-500">
                                                    {preview.map(([key, value]) => (
                                                        <div key={key} className="flex flex-wrap items-start gap-1">
                                                            <span className="font-semibold uppercase tracking-[0.16em] text-[10px] text-slate-400">{key}</span>
                                                            <span className="max-w-[360px] break-all text-xs text-slate-600">
                                                                {formatMetadataValue(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-right text-xs text-slate-500">
                                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                            <span className="text-[11px]">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {loadingMore && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Loading more activity…
                        </div>
                    )}
                </div>
                <style jsx>{`
                    @keyframes fadeUp {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </div>
    );
}

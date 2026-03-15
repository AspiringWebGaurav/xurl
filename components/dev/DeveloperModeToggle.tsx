"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/config";

interface DeveloperModeToggleProps {
    visible: boolean;
}

export function DeveloperModeToggle({ visible }: DeveloperModeToggleProps) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;

        let cancelled = false;
        const load = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;
                const token = await user.getIdToken();
                const res = await fetch("/api/dev/developer-mode", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && typeof data.developerModeEnabled === "boolean") {
                    setEnabled(data.developerModeEnabled);
                }
            } catch {
                // Silent fail in dev-only tool
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [visible]);

    const toggle = async () => {
        if (!visible || loading) return;
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;
            const token = await user.getIdToken();
            const res = await fetch("/api/dev/developer-mode", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ enabled: !enabled }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data.developerModeEnabled === "boolean") {
                setEnabled(data.developerModeEnabled);
            }
        } catch {
            // Silent fail in dev-only tool
        } finally {
            setLoading(false);
        }
    };

    if (!visible || process.env.NODE_ENV !== "development") {
        return null;
    }

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={loading}
            className={`group relative inline-flex items-center gap-3 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-emerald-300/70 focus:ring-offset-1 active:scale-[0.98]
                ${enabled
                    ? "border-emerald-400 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 text-emerald-800 shadow-[0_10px_32px_-16px_rgba(16,185,129,0.55)]"
                    : "border-slate-300 bg-gradient-to-r from-slate-50 via-white to-slate-50 text-slate-700 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.35)]"
                }
                ${loading ? "opacity-80 cursor-wait" : "hover:-translate-y-0.5"}`}
        >
            <span
                aria-hidden="true"
                className={`relative flex h-5 w-9 items-center rounded-full border transition-all duration-300 ease-out
                    ${enabled ? "border-emerald-400 bg-emerald-100/70" : "border-slate-300 bg-white"}
                    ${loading ? "grayscale" : "group-hover:shadow-[0_6px_18px_-10px_rgba(16,185,129,0.65)]"}`}
            >
                <span className={`absolute left-1 flex h-3.5 w-3.5 items-center justify-center transition-all duration-300 ease-out
                    ${enabled ? "translate-x-3" : "translate-x-0"}`}>
                    <span className={`absolute inline-flex h-full w-full rounded-full ${enabled ? "bg-emerald-400/70 animate-ping" : "bg-slate-300/30"}`} />
                    <span className={`relative inline-flex h-3.5 w-3.5 rounded-full bg-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.45)] ring-1 ${enabled ? "ring-emerald-300" : "ring-slate-200"}`} />
                </span>
            </span>
            <span className="flex items-center gap-2">
                <span className={`text-[11px] uppercase tracking-[0.14em] font-bold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>
                    Developer Mode
                </span>
                <span className={`text-[11px] font-black tracking-tight ${enabled ? "text-emerald-600" : "text-slate-500"}`}>
                    {enabled ? "ON" : "OFF"}
                </span>
            </span>
        </button>
    );
}


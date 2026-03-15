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
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold
                ${enabled
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
        >
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Developer Mode: {enabled ? "ON" : "OFF"}</span>
        </button>
    );
}


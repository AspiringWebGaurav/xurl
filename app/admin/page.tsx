"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowUpRight, Sparkles, Percent, Gift, ClipboardList, Activity, Wand2, KeyRound, History } from "lucide-react";
import { ActivityModal } from "@/components/admin/ActivityModal";
import { auth } from "@/lib/firebase/config";
import type { ActivityEvent } from "@/lib/admin/activity-events";

const cardMotion = "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-48px_rgba(15,23,42,0.22)]";

type ActivityItem = {
    id: string;
    type: "billing" | "grant" | "promo_redemption" | "promo_created";
    message: string;
    timestamp: number;
};

const mapActivitySeverity = (type: ActivityItem["type"]): ActivityEvent["severity"] => {
    if (type === "billing") return "BILLING";
    if (type === "grant") return "ADMIN";
    return "INFO";
};

type ActivitySummary = {
    promo: {
        activeCodes: number;
        recentRedemptions: number;
        limitsReached: number;
    };
    grants: {
        recentGrants: number;
        lastGrantAt?: number;
    };
    purchases: {
        recentTransactions: number;
        lastUpgradeAt?: number;
        sourceSummary: Record<string, number>;
    };
};

export default function AdminDashboardPage() {
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityModalOpen, setActivityModalOpen] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setActivity([]);
                setSummary(null);
                setActivityLoading(false);
                return;
            }

            try {
                setActivityLoading(true);
                const token = await user.getIdToken();
                const res = await fetch("/api/admin/activity?limit=50", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.items)) {
                    setActivity(data.items as ActivityItem[]);
                    setSummary(data.summary || null);
                } else {
                    setActivity([]);
                    setSummary(null);
                }
            } catch (error) {
                console.error("Failed to load activity", error);
                setActivity([]);
                setSummary(null);
            } finally {
                setActivityLoading(false);
            }
        });

        return () => unsub();
    }, []);

    const promoStats = useMemo(() => {
        if (!summary) return null;
        return [
            { label: "Active codes", value: summary.promo.activeCodes },
            { label: "Recent redemptions", value: summary.promo.recentRedemptions },
            { label: "Limits reached", value: summary.promo.limitsReached },
        ];
    }, [summary]);

    const modalEvents = useMemo<ActivityEvent[]>(() => {
        return activity.map((item) => ({
            id: `admin_activity:${item.id}`,
            type: item.type.toUpperCase(),
            actor: null,
            timestamp: item.timestamp,
            sourceCollection: "admin_activity",
            metadata: { message: item.message },
            severity: mapActivitySeverity(item.type),
        }));
    }, [activity]);

    const grantStats = useMemo(() => {
        if (!summary) return null;
        return [
            { label: "Grants (90d)", value: summary.grants.recentGrants },
            {
                label: "Last granted",
                value: summary.grants.lastGrantAt ? new Date(summary.grants.lastGrantAt).toLocaleDateString() : "-",
            },
        ];
    }, [summary]);

    const purchaseStats = useMemo(() => {
        if (!summary) return null;
        const sources = summary.purchases.sourceSummary || {};
        const sourceEntries = Object.keys(sources).length
            ? Object.entries(sources)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([source, count]) => `${source}: ${count}`)
            : ["No source data"];
        return [
            { label: "Transactions (30d)", value: summary.purchases.recentTransactions },
            {
                label: "Last upgrade",
                value: summary.purchases.lastUpgradeAt ? new Date(summary.purchases.lastUpgradeAt).toLocaleDateString() : "-",
            },
            { label: "Sources", value: sourceEntries.join(" · ") },
        ];
    }, [summary]);

    const quickActions = [
        { href: "/admin/promo-codes", label: "Create Promo Code", icon: Percent },
        { href: "/admin/grant-plan", label: "Grant Plan Access", icon: KeyRound },
        { href: "/admin/purchase-history", label: "View Purchase History", icon: History },
        { href: "/admin/logs", label: "Open Admin Logs", icon: Activity },
    ];

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-12 gap-6">
                <div
                    className="col-span-12 rounded-[24px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.06),_transparent_32%),linear-gradient(135deg,#f8fafc,#f3f6fb)] p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.25)] lg:col-span-8 lg:p-7"
                    style={{ animation: "fadeUp 0.4s ease forwards", opacity: 0, transform: "translateY(10px)" }}
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                            <Sparkles className="h-4 w-4 text-indigo-400" />
                            <span>Admin Console</span>
                        </div>
                        <h1 className="text-[30px] font-semibold leading-tight text-slate-900 lg:text-[32px]">Operate and monitor XURL</h1>
                        <p className="max-w-3xl text-[15px] leading-6 text-slate-600">
                            Access promo tools, plan grants, billing signals, and unified logs from a calm, consistent workspace. Navigation stays fixed while content remains scrollable.
                        </p>
                    </div>
                </div>

                <div
                    className="col-span-12 rounded-[22px] border border-slate-200/80 bg-white px-6 py-6 shadow-sm lg:col-span-4"
                    style={{ animation: "fadeUp 0.45s ease forwards", opacity: 0, transform: "translateY(10px)" }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">System activity</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">Recent events</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActivityModalOpen(true)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            View all
                            <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {activityLoading ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading activity…</div>
                        ) : activity.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No recent admin activity found.</div>
                        ) : (
                            activity.slice(0, 2).map((item) => (
                                <div key={item.id} className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                                    <div>
                                        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.type.replace("_", " ")}</p>
                                        <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{item.message}</p>
                                    </div>
                                    <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <ActivityModal
                open={activityModalOpen}
                title="Recent events"
                subtitle="System activity"
                items={modalEvents}
                loading={activityLoading}
                onClose={() => setActivityModalOpen(false)}
            />

            <section
                className="col-span-12 rounded-[18px] border border-slate-200 bg-white/80 px-5 py-4 shadow-sm"
                style={{ animation: "fadeUp 0.48s ease forwards", opacity: 0, transform: "translateY(10px)" }}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quick actions</p>
                        <p className="text-sm text-slate-600">Jump to common admin tasks</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white ${cardMotion}`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {action.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-12 gap-6">
                <Link
                    href="/admin/promo-codes"
                    className={`group col-span-12 rounded-[22px] border border-slate-200/80 bg-white px-6 py-6 text-slate-900 shadow-sm md:col-span-6 lg:col-span-4 ${cardMotion}`}
                    style={{ animation: "fadeUp 0.52s ease forwards", opacity: 0, transform: "translateY(10px)" }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <Percent className="h-5 w-5" />
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-slate-600" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold leading-tight text-slate-900">Promo Codes</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Create discounts, toggle availability, review redemptions.</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        {(promoStats || [
                            { label: "Active codes", value: "—" },
                            { label: "Recent redemptions", value: "—" },
                            { label: "Limits reached", value: "—" },
                        ]).map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                                <span className="text-[13px] font-medium text-slate-600">{stat.label}</span>
                                <span className="font-semibold text-slate-900">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </Link>

                <Link
                    href="/admin/grant-plan"
                    className={`group col-span-12 rounded-[22px] border border-slate-200/80 bg-white px-6 py-6 text-slate-900 shadow-sm md:col-span-6 lg:col-span-4 ${cardMotion}`}
                    style={{ animation: "fadeUp 0.56s ease forwards", opacity: 0, transform: "translateY(10px)" }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <Gift className="h-5 w-5" />
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-slate-600" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold leading-tight text-slate-900">Grant Plan</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Search users, pick durations, issue zero-cost grants.</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        {(grantStats || [
                            { label: "Grants (90d)", value: "—" },
                            { label: "Last granted", value: "—" },
                        ]).map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                                <span className="text-[13px] font-medium text-slate-600">{stat.label}</span>
                                <span className="font-semibold text-slate-900">{stat.value}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[13px] text-slate-600">
                            <Wand2 className="h-4 w-4 text-violet-500" />
                            Admin grants are logged with source <span className="font-semibold text-slate-800">admin_grant</span>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/purchase-history"
                    className={`group col-span-12 rounded-[22px] border border-slate-200/80 bg-white px-6 py-6 text-slate-900 shadow-sm md:col-span-6 lg:col-span-4 ${cardMotion}`}
                    style={{ animation: "fadeUp 0.6s ease forwards", opacity: 0, transform: "translateY(10px)" }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-slate-600" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold leading-tight text-slate-900">Purchase History</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Inspect transactions, sources, and plan allocations.</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        {(purchaseStats || [
                            { label: "Transactions (30d)", value: "—" },
                            { label: "Last upgrade", value: "—" },
                            { label: "Sources", value: "—" },
                        ]).map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                                <span className="text-[13px] font-medium text-slate-600">{stat.label}</span>
                                <span className="font-semibold text-slate-900">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </Link>
            </section>

            <style jsx>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

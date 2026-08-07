"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowUpRight, Sparkles, Percent, Gift, ClipboardList, Activity, Wand2, KeyRound, History } from "lucide-react";
import { ActivityModal } from "@/components/admin/ActivityModal";
import { auth } from "@/lib/firebase/config";
import type { ActivityEvent } from "@/lib/admin/activity-events";

import { motion } from "framer-motion";

const cardMotion = "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_25px_60px_-25px_rgba(99,102,241,0.22)] hover:border-indigo-400/50 group/card";

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
        <div className="space-y-8 relative overflow-hidden">
            {/* Drifting Background Lighting Orbs */}
            <motion.div
                animate={{
                    x: [0, 35, -25, 0],
                    y: [0, -30, 30, 0],
                    scale: [1, 1.1, 0.95, 1],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 20,
                    ease: "easeInOut",
                }}
                className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-emerald-500/10 rounded-full blur-[100px] pointer-events-none z-0"
            />

            <section className="grid grid-cols-12 gap-6 relative z-10">
                <motion.div
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="col-span-12 rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl p-6 lg:p-8 shadow-[0_20px_50px_-25px_rgba(99,102,241,0.15)] lg:col-span-8 group transition-all duration-300 hover:border-indigo-300"
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-fit border border-indigo-100">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                            <span>Admin Console</span>
                        </div>
                        <h1 className="text-[30px] font-black leading-tight text-slate-900 lg:text-[34px] tracking-tight">Operate and monitor XURL</h1>
                        <p className="max-w-3xl text-[15px] leading-relaxed text-slate-600 font-medium">
                            Access promo tools, plan grants, billing signals, and unified logs from a calm, consistent workspace. Navigation stays fixed while content remains scrollable.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    whileHover={{ scale: 1.008 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="col-span-12 rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-6 shadow-sm lg:col-span-4 transition-all duration-300 hover:border-indigo-300 hover:shadow-md"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">System activity</p>
                            </div>
                            <p className="mt-1 text-lg font-bold text-slate-900">Recent events</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActivityModalOpen(true)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all hover:scale-105 active:scale-95"
                        >
                            View all
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {activityLoading ? (
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500 font-medium">Loading activity…</div>
                        ) : activity.length === 0 ? (
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500 font-medium">No recent admin activity found.</div>
                        ) : (
                            activity.slice(0, 2).map((item) => (
                                <div key={item.id} className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 hover:bg-white hover:border-slate-200 transition-all">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">{item.type.replace("_", " ")}</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-900">{item.message}</p>
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </section>

            <ActivityModal
                open={activityModalOpen}
                title="Recent events"
                subtitle="System activity"
                items={modalEvents}
                loading={activityLoading}
                onClose={() => setActivityModalOpen(false)}
            />

            <section className="col-span-12 rounded-[24px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-5 shadow-sm relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Quick actions</p>
                        <p className="text-sm font-medium text-slate-600">Jump to common admin tasks</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2 text-xs font-bold text-slate-800 transition-all duration-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md active:scale-95 group"
                                >
                                    <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                                    {action.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-12 gap-6 relative z-10">
                <motion.div
                    whileHover={{ y: -5, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="col-span-12 md:col-span-6 lg:col-span-4"
                >
                    <Link
                        href="/admin/promo-codes"
                        className="group flex flex-col h-full rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-6 text-slate-900 shadow-sm transition-all duration-300 hover:border-emerald-400 hover:shadow-[0_20px_50px_rgba(16,185,129,0.15)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                                <Percent className="h-5 w-5" />
                            </div>
                            <ArrowUpRight className="h-5 w-5 text-slate-300 transition-transform duration-200 group-hover:text-emerald-600 group-hover:translate-x-1 group-hover:-translate-y-1" />
                        </div>
                        <h2 className="mt-5 text-xl font-bold leading-tight text-slate-900">Promo Codes</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600 font-medium">Create discounts, toggle availability, review redemptions.</p>
                        <div className="mt-4 grid gap-2 text-sm text-slate-700 flex-1 justify-end">
                            {(promoStats || [
                                { label: "Active codes", value: "—" },
                                { label: "Recent redemptions", value: "—" },
                                { label: "Limits reached", value: "—" },
                            ]).map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2 group-hover:bg-emerald-50/50 transition-colors">
                                    <span className="text-xs font-semibold text-slate-600">{stat.label}</span>
                                    <span className="font-bold text-slate-900">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </Link>
                </motion.div>

                <motion.div
                    whileHover={{ y: -5, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="col-span-12 md:col-span-6 lg:col-span-4"
                >
                    <Link
                        href="/admin/grant-plan"
                        className="group flex flex-col h-full rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-6 text-slate-900 shadow-sm transition-all duration-300 hover:border-violet-400 hover:shadow-[0_20px_50px_rgba(139,92,246,0.15)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 group-hover:scale-110 transition-transform">
                                <Gift className="h-5 w-5" />
                            </div>
                            <ArrowUpRight className="h-5 w-5 text-slate-300 transition-transform duration-200 group-hover:text-violet-600 group-hover:translate-x-1 group-hover:-translate-y-1" />
                        </div>
                        <h2 className="mt-5 text-xl font-bold leading-tight text-slate-900">Grant Plan</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600 font-medium">Search users, pick durations, issue zero-cost grants.</p>
                        <div className="mt-4 grid gap-2 text-sm text-slate-700 flex-1 justify-end">
                            {(grantStats || [
                                { label: "Grants (90d)", value: "—" },
                                { label: "Last granted", value: "—" },
                            ]).map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2 group-hover:bg-violet-50/50 transition-colors">
                                    <span className="text-xs font-semibold text-slate-600">{stat.label}</span>
                                    <span className="font-bold text-slate-900">{stat.value}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 font-medium">
                                <Wand2 className="h-3.5 w-3.5 text-violet-500" />
                                Admin grants logged as <span className="font-bold text-slate-800">admin_grant</span>
                            </div>
                        </div>
                    </Link>
                </motion.div>

                <motion.div
                    whileHover={{ y: -5, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="col-span-12 md:col-span-6 lg:col-span-4"
                >
                    <Link
                        href="/admin/purchase-history"
                        className="group flex flex-col h-full rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-6 text-slate-900 shadow-sm transition-all duration-300 hover:border-amber-400 hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 group-hover:scale-110 transition-transform">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <ArrowUpRight className="h-5 w-5 text-slate-300 transition-transform duration-200 group-hover:text-amber-600 group-hover:translate-x-1 group-hover:-translate-y-1" />
                        </div>
                        <h2 className="mt-5 text-xl font-bold leading-tight text-slate-900">Purchase History</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600 font-medium">Inspect transactions, sources, and plan allocations.</p>
                        <div className="mt-4 grid gap-2 text-sm text-slate-700 flex-1 justify-end">
                            {(purchaseStats || [
                                { label: "Transactions (30d)", value: "—" },
                                { label: "Last upgrade", value: "—" },
                                { label: "Sources", value: "—" },
                            ]).map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2 group-hover:bg-amber-50/50 transition-colors">
                                    <span className="text-xs font-semibold text-slate-600">{stat.label}</span>
                                    <span className="font-bold text-slate-900">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </Link>
                </motion.div>
            </section>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Loader2,
    BarChart3,
    Link2,
    Trophy,
    Lock,
    Monitor,
    Globe,
    MousePointerClick,
    Download,
    ShieldCheck,
    Bot,
    QrCode,
    Target,
    Sparkles,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildShortUrl } from "@/lib/utils/url-builder";
import Link from "next/link";
import { isPaidPlan, PLAN_CONFIGS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { DesktopGuestLocked } from "@/components/layout/DesktopGuestLocked";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardData {
    plan: PlanType;
    summary: {
        totalClicks: number;
        activeLinks: number;
        topLinks: Array<{ slug: string; title: string; clicks: number }>;
    };
    timeline: Array<{ date: string; clicks: number; uniqueVisitors: number }>;
    referrers: Record<string, number>;
    countries: Record<string, number>;
    devices: Record<string, number>;
    browsers: Record<string, number>;
    os: Record<string, number>;
    bots?: number;
    humans?: number;
    sources?: Record<string, number>;
    utms?: {
        sources?: Record<string, number>;
        campaigns?: Record<string, number>;
    };
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.42, ease: "easeOut" },
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

// ─── Inline Sub-Components ──────────────────────────────────────────────────

function BreakdownBars({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const max = entries[0]?.[1] || 1;
    const total = entries.reduce((acc, curr) => acc + curr[1], 0);

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-7 text-center space-y-2.5 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200/90 transition-all hover:border-slate-300">
                <div className="h-9 w-9 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400 shadow-inner">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-700">No Click Traffic Recorded</p>
                <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">Data will aggregate in real time when visitors open your short URLs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3.5">
            {entries.map(([label, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                    <div key={label} className="group/bar transition-all duration-200 hover:translate-x-1">
                        <div className="flex justify-between text-xs mb-1.5 font-bold">
                            <span className="text-slate-700 capitalize flex items-center gap-1.5 group-hover/bar:text-emerald-600 transition-colors">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block opacity-80" />
                                {label}
                            </span>
                            <div className="flex items-center gap-2 tabular-nums">
                                <span className="text-slate-900 font-extrabold">{count.toLocaleString()}</span>
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded-md">{pct}%</span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100/90 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full transition-all duration-500 group-hover/bar:brightness-110 group-hover/bar:shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                style={{ width: `${(count / max) * 100}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function BreakdownList({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const total = entries.reduce((acc, curr) => acc + curr[1], 0);

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-7 text-center space-y-2.5 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200/90 transition-all hover:border-slate-300">
                <div className="h-9 w-9 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400 shadow-inner">
                    <Globe className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-700">No Referrers Captured</p>
                <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">Top referring domains & platforms will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {entries.map(([label, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                    <div
                        key={label}
                        className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 hover:border-emerald-500/40 hover:bg-emerald-50/30 hover:scale-[1.01] transition-all duration-200 group/row shadow-2xs"
                    >
                        <span className="text-slate-800 font-bold truncate mr-4 group-hover/row:text-emerald-700 transition-colors">
                            {label.replace(/_/g, ".")}
                        </span>
                        <div className="flex items-center gap-2 tabular-nums shrink-0">
                            <span className="text-slate-900 font-black">{count.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/50">{pct}%</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OverviewSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                    >
                        <Skeleton className="h-4 w-24 mb-4" />
                        <Skeleton className="h-12 w-32" />
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                <Skeleton className="h-5 w-32 mb-6" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    );
}
function AnimatedDummyNumber({ target, format = true }: { target: number, format?: boolean }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const duration = 2500;
        const frames = 60;
        const increment = target / (duration / (1000 / frames));
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 1000 / frames);
        return () => clearInterval(timer);
    }, [target]);
    return <span>{format ? count.toLocaleString() : count}</span>;
}

// ─── Removed LockedPreview ─────────────────────────────────────────────────────────

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState("");
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);
    const [exportingCsv, setExportingCsv] = useState(false);

    const handleExportCsv = async () => {
        if (!user) return;
        setExportingCsv(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/analytics/export", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const errData = await res.json();
                alert(errData.message || "Failed to export CSV");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `xurl_analytics_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Failed to download CSV export.");
        } finally {
            setExportingCsv(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await ensureUserDocument(u);
                setDataLoading(true);
                try {
                    const token = await u.getIdToken();
                    const res = await fetch("/api/analytics/dashboard", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error("Failed to fetch analytics");
                    const json = await res.json();
                    setData(json);
                } catch {
                    setError("Failed to load analytics data.");
                } finally {
                    setDataLoading(false);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ── Loading ──
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    // ── Not authenticated ──
    if (!user) {
        return (
            <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
                <TopNavbar />
                <main className="flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden">
                    <div className="w-full px-6 lg:px-12 py-12">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight">
                                    Analytics
                                </h1>
                                <p className="text-slate-500 mt-2">
                                    Track your link performance over the last 30 days.
                                </p>
                            </div>
                        </div>
                        <DesktopGuestLocked 
                            title="Sign in Required"
                            message="Sign in to track your links and see real-time performance."
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 px-4 mt-8">
                                {[
                                    { label: "Total Clicks", value: "1,284" },
                                    { label: "Active Links", value: "12" },
                                    { label: "Top Performer", value: "my-link" },
                                ].map((item) => (
                                    <div key={item.label} className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                                            {item.label}
                                        </span>
                                        <p className="text-4xl md:text-[48px] font-extrabold text-slate-900 mt-1 leading-none tracking-tight">
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </DesktopGuestLocked>
                    </div>
                </main>
            </div>
        );
    }

    const isPaid = data ? isPaidPlan(data.plan as PlanType) : false;

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
            <TopNavbar />
            <main className="flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden">
                <div className="w-full px-6 lg:px-12 py-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                Analytics
                            </h1>
                            {data && (
                                <span className="uppercase text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full bg-slate-900 text-white shadow-sm border border-slate-700">
                                    {PLAN_CONFIGS[data.plan || "free"].label} Tier ({PLAN_CONFIGS[data.plan || "free"].analyticsRetentionDays || 30} Days)
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 mt-1">
                            Track real-time link performance and visitor demographics.
                        </p>
                    </div>

                    {data && PLAN_CONFIGS[data.plan || "free"].hasCsvExport && (
                        <Button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={exportingCsv}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                            <Download className="h-4 w-4" />
                            {exportingCsv ? "Exporting..." : "Export CSV Report"}
                        </Button>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                {dataLoading && <OverviewSkeleton />}

                {!dataLoading && data && !isPaid && <FreemiumDashboard data={data} />}

                {!dataLoading && data && isPaid && (
                    <FullDashboard
                        data={data}
                        hoveredBar={hoveredBar}
                        onHoverBar={setHoveredBar}
                    />
                )}
                </div>
            </main>
        </div>
    );
}

// ─── Freemium Dashboard ───────────────────────────────────────────────────────

function FreemiumDashboard({ data }: { data: DashboardData }) {
    const topLink = data.summary.topLinks[0];

    return (
        <>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-slate-500">
                            Total Clicks
                        </span>
                        <MousePointerClick className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-[42px] font-extrabold text-slate-900 tracking-tight leading-none">
                        {data.summary.totalClicks.toLocaleString()}
                    </p>
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-slate-500">
                            Active Links
                        </span>
                        <Link2 className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-[42px] font-extrabold text-slate-900 tracking-tight leading-none">
                        {data.summary.activeLinks}
                    </p>
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-slate-500">
                            Top Performer
                        </span>
                        <Trophy className="h-5 w-5 text-amber-400" />
                    </div>
                    {topLink ? (
                        <>
                            <p className="text-lg font-bold text-slate-900 truncate">
                                {topLink.title || topLink.slug}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                                {topLink.clicks.toLocaleString()} clicks
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">No links yet</p>
                    )}
                </motion.div>
            </motion.div>

            <div className="relative mt-4 max-h-[calc(100vh-280px)] overflow-hidden">
                <div className="pointer-events-none select-none blur-[6px] opacity-50">
                    <div className="mb-10 px-4">
                        <div className="h-32 flex items-end gap-1">
                            {Array.from({ length: 30 }, (_, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-slate-200 rounded-t-sm"
                                    style={{
                                        height: `${20 + Math.sin(i * 0.5) * 30 + ((i * 7 + 13) % 41)}%`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
                        {["Devices", "Browsers", "OS"].map((label) => (
                            <div key={label} className="h-32 flex flex-col">
                                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">{label}</span>
                                <div className="flex-1 bg-slate-200/50 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center bg-slate-50/40 backdrop-blur-md z-10">
                    <div className="max-w-lg w-full mx-4 text-center flex flex-col items-center">
                        <div className="mb-6">
                            <Lock className="h-10 w-10 text-slate-700/80 drop-shadow-sm" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight drop-shadow-sm">
                            Unlock Deep Analytics
                        </h2>
                        <p className="text-slate-600 mb-8 text-base leading-relaxed max-w-sm mx-auto font-medium">
                            Upgrade to any paid plan to access full click timelines, device breakdowns, OS tracking, and more. Stop guessing, start knowing.
                        </p>
                        <Link href="/pricing">
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 text-base font-semibold rounded-full shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]">
                                View Plans & Upgrade
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Full Dashboard (Paid Users) ────────────────────────────────────────────

function FullDashboard({
    data,
    hoveredBar,
    onHoverBar,
}: {
    data: DashboardData;
    hoveredBar: number | null;
    onHoverBar: (i: number | null) => void;
}) {
    const maxClicks = Math.max(...data.timeline.map((d) => d.clicks), 1);
    const topLink = data.summary.topLinks[0];

    return (
        <>
            {/* ── Overview Cards ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
                {/* Card 1: Total Clicks */}
                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/60 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.18)] hover:border-blue-500/40 hover:-translate-y-1.5 transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            Total Clicks
                        </span>
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-600/10 text-blue-600 border border-blue-500/20 flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                            <MousePointerClick className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-4xl lg:text-[46px] font-black text-slate-900 tracking-tight leading-none">
                        <AnimatedDummyNumber target={data.summary.totalClicks} />
                    </p>
                </motion.div>

                {/* Card 2: Active Links */}
                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/60 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.18)] hover:border-emerald-500/40 hover:-translate-y-1.5 transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            Active Links
                        </span>
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-600/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                            <Link2 className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-4xl lg:text-[46px] font-black text-slate-900 tracking-tight leading-none">
                        <AnimatedDummyNumber target={data.summary.activeLinks} format={false} />
                    </p>
                </motion.div>

                {/* Card 3: Top Performer */}
                <motion.div
                    variants={cardVariants}
                    className="relative group rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white/90 via-white/80 to-slate-50/60 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.18)] hover:border-amber-500/40 hover:-translate-y-1.5 transition-all duration-300 p-6 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            Top Performer
                        </span>
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/15 to-amber-600/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                            <Trophy className="h-5 w-5" />
                        </div>
                    </div>
                    {topLink ? (
                        <>
                            <p className="text-lg font-black text-slate-900 truncate tracking-tight">
                                {topLink.title || topLink.slug}
                            </p>
                            <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                {topLink.clicks.toLocaleString()} clicks recorded
                            </p>
                        </>
                    ) : (
                        <p className="text-xs font-semibold text-slate-400">No active links created yet</p>
                    )}
                </motion.div>
            </motion.div>

            {/* ── Click Timeline ── */}
            <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="relative rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] transition-all duration-300 p-7 lg:p-8 mb-8 overflow-hidden group"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                Click Velocity Timeline
                            </h2>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[10px] font-bold">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Live Monitoring Active
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Daily click volume distribution across your retention window.
                        </p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-500">
                        <BarChart3 className="h-4 w-4" />
                    </div>
                </div>

                {data.timeline.every((d) => d.clicks === 0) ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl bg-gradient-to-b from-slate-50/70 to-slate-100/40 border border-dashed border-slate-200 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
                            <Sparkles className="h-6 w-6 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                            Ready to Record Your First Click
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-4">
                            No click activity recorded in this period yet. Share your shortened URLs across social media, emails, or QR codes to watch your live analytics update in real time.
                        </p>
                        <Link href="/app">
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-2 text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all">
                                Create Short Link →
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-[3px] h-48">
                            {data.timeline.map((day, i) => {
                                const heightPercent = (day.clicks / maxClicks) * 100;
                                return (
                                    <div
                                        key={day.date}
                                        className="relative flex-1 group/bar cursor-pointer"
                                        onMouseEnter={() => onHoverBar(i)}
                                        onMouseLeave={() => onHoverBar(null)}
                                    >
                                        {hoveredBar === i && (
                                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2 whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none">
                                                <p className="font-extrabold text-emerald-400">
                                                    {day.clicks.toLocaleString()} clicks
                                                </p>
                                                <p className="text-slate-300 text-[10px]">
                                                    {formatDate(day.date)}
                                                </p>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "w-full rounded-t-md transition-all duration-300 ease-out",
                                                hoveredBar === i
                                                    ? "bg-gradient-to-t from-emerald-600 via-teal-500 to-cyan-400 shadow-[0_0_20px_rgba(16,185,129,0.7)] scale-x-110"
                                                    : "bg-gradient-to-t from-slate-700 via-slate-800 to-slate-900 hover:from-emerald-600 hover:to-teal-500"
                                            )}
                                            style={{
                                                height: `${Math.max(heightPercent, day.clicks > 0 ? 6 : 2)}%`,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-3 text-xs font-semibold text-slate-400">
                            <span>
                                {data.timeline[0] ? formatDate(data.timeline[0].date) : ""}
                            </span>
                            <span>
                                {data.timeline[data.timeline.length - 1]
                                    ? formatDate(data.timeline[data.timeline.length - 1].date)
                                    : ""}
                            </span>
                        </div>
                    </>
                )}
            </motion.div>

            {/* ── Top Performing Links Table ── */}
            <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden mb-8"
            >
                <div className="px-7 py-5 border-b border-slate-100/80 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">
                            Top Performing Links
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Highest engagement links ranked by total click volume.
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100/80 px-3 py-1 rounded-full border border-slate-200/60">
                        Top {data.summary.topLinks.length} Active
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/70 border-b border-slate-200/60 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap w-16">
                                    Rank
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Short URL
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Title / Alias
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">
                                    Total Clicks
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-slate-700 font-medium">
                            {data.summary.topLinks.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-10 text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                <Trophy className="h-5 w-5" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-700">No Link Data Available</p>
                                            <p className="text-[11px] text-slate-400 max-w-sm">Create and distribute your short links to start tracking live performance metrics.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.summary.topLinks.map((link, i) => (
                                    <tr
                                        key={link.slug}
                                        className="hover:bg-slate-50/80 transition-all duration-200 group/row"
                                    >
                                        <td className="px-6 py-4 font-black text-xs">
                                            {i === 0 ? (
                                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 text-xs shadow-2xs">🥇</span>
                                            ) : i === 1 ? (
                                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-700 text-xs shadow-2xs">🥈</span>
                                            ) : i === 2 ? (
                                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-800 text-xs shadow-2xs">🥉</span>
                                            ) : (
                                                <span className="text-slate-400 font-bold ml-1.5">#{i + 1}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <a
                                                href={buildShortUrl(link.slug)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-slate-900 font-mono text-xs font-bold bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/70 hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                                            >
                                                <span>{buildShortUrl(link.slug).replace(/^https?:\/\//, "")}</span>
                                                <Link2 className="h-3 w-3 text-slate-400 group-hover/row:text-emerald-600" />
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-semibold truncate max-w-[220px]">
                                            {link.title || link.slug}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-900 tabular-nums">
                                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/50 text-xs">
                                                {link.clicks.toLocaleString()} clicks
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* ── Traffic Insights ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
                <motion.div
                    variants={cardVariants}
                    className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 p-7 group"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Monitor className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                Devices
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Hardware</span>
                    </div>
                    <BreakdownBars data={data.devices} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 p-7 group"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Globe className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                Browsers
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Clients</span>
                    </div>
                    <BreakdownBars data={data.browsers} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 p-7 group"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Monitor className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                Operating Systems
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Platform</span>
                    </div>
                    <BreakdownBars data={data.os} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 p-7 group"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Link2 className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                Top Referrers
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Traffic Origin</span>
                    </div>
                    <BreakdownList data={data.referrers} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_-15px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 p-7 group"
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                                <Globe className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                Top Countries
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Geography</span>
                    </div>
                    <BreakdownList data={data.countries} />
                </motion.div>

                {/* ── Premium Feature: Bot vs Human Traffic Authenticity ── */}
                {PLAN_CONFIGS[data.plan]?.hasBotDetection && (
                    <motion.div
                        variants={cardVariants}
                        className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-sm p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                    Traffic Authenticity
                                </h3>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                Business Tier
                            </span>
                        </div>

                        {(() => {
                            const humans = data.humans || 0;
                            const bots = data.bots || 0;
                            const total = humans + bots;
                            const humanPct = total > 0 ? Math.round((humans / total) * 100) : 100;
                            return (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-black text-slate-900">{humanPct}%</span>
                                            <span className="text-xs font-semibold text-slate-500">Real Human Visitors</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-bold">
                                            <span className="text-emerald-700 flex items-center gap-1">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {humans.toLocaleString()} Humans
                                            </span>
                                            <span className="text-amber-700 flex items-center gap-1">
                                                <Bot className="h-3.5 w-3.5" /> {bots.toLocaleString()} Bots
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-amber-100 h-3 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${humanPct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}

                {/* ── Premium Feature: UTM Campaign Intelligence ── */}
                {PLAN_CONFIGS[data.plan]?.hasUtmAnalytics && (
                    <motion.div
                        variants={cardVariants}
                        className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-white shadow-sm p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                    UTM Campaigns
                                </h3>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                Business Tier
                            </span>
                        </div>
                        <BreakdownBars data={data.utms?.campaigns || {}} />
                    </motion.div>
                )}
            </motion.div>

            {/* ── Upgrade Teaser for Lower Tiers ── */}
            {!PLAN_CONFIGS[data.plan]?.hasUtmAnalytics && (
                <div className="mt-8 rounded-3xl border border-indigo-200/70 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                            <h3 className="text-base font-extrabold tracking-tight text-white">
                                Want UTM Campaign Tracking & Bot Filtering?
                            </h3>
                        </div>
                        <p className="text-xs text-slate-300 max-w-xl">
                            Upgrade to <strong className="text-amber-300">Business</strong> or <strong className="text-amber-300">Enterprise</strong> to unlock 90-day history, UTM source attribution, automated bot detection, and direct CSV exports.
                        </p>
                    </div>
                    <Link href="/pricing" className="shrink-0">
                        <Button className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black rounded-full px-6 py-2.5 text-xs shadow-lg active:scale-95 transition-all">
                            Upgrade to Business
                        </Button>
                    </Link>
                </div>
            )}

            {/* Legal Notice */}
            <div className="mt-8 text-center">
                <p className="text-[11px] text-slate-500">
                    Analytics data is collected in accordance with our <a href="/privacy#analytics" className="hover:text-emerald-500 hover:underline underline-offset-2 transition-colors">Privacy Policy</a>.
                </p>
            </div>
        </>
    );
}

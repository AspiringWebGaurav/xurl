"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import {
    Loader2,
    BarChart3,
    Link2,
    Trophy,
    Monitor,
    Globe,
    MousePointerClick,
    Lock,
} from "lucide-react";
import Link from "next/link";
import { isPaidPlan } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardData {
    plan: string;
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

    if (entries.length === 0) {
        return <p className="text-sm text-slate-400">No data yet.</p>;
    }

    return (
        <div className="space-y-3">
            {entries.map(([label, count]) => (
                <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium capitalize">
                            {label}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                            {count.toLocaleString()}
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-slate-900 rounded-full transition-all duration-500"
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
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

// ─── Mobile Locked Preview ─────────────────────────────────────────────────────────

function MobileLockedPreview() {
    return (
        <div className="relative mt-2 flex-1 overflow-hidden pb-12">
            <div className="pointer-events-none select-none blur-[5px] opacity-40">
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 mb-8 px-2">
                    {[
                        { label: "Total Clicks", value: <AnimatedDummyNumber target={1284} /> },
                        { label: "Active Links", value: <AnimatedDummyNumber target={12} /> },
                        { label: "Top Performer", value: "my-link", className: "col-span-2" },
                    ].map((item, i) => (
                        <div key={item.label} className={cn("flex flex-col", item.className)}>
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                {item.label}
                            </span>
                            <p className="text-4xl font-extrabold text-slate-900 mt-1 tracking-tight">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mb-8 px-2">
                    <div className="h-20 flex items-end gap-[2px]">
                        {Array.from({ length: 30 }, (_, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-slate-300 rounded-t-sm"
                                style={{
                                    height: `${20 + Math.sin(i * 0.5) * 30 + ((i * 7 + 13) % 41)}%`,
                                }}
                            />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 px-2">
                    {["Devices", "Browsers"].map((label) => (
                        <div key={label} className="h-24 flex flex-col">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</span>
                            <div className="flex-1 bg-slate-300/50 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/50 backdrop-blur-md z-10">
                <div className="w-full max-w-sm text-center flex flex-col items-center">
                    <div className="mb-6">
                        <Lock className="h-10 w-10 text-primary drop-shadow-sm" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight drop-shadow-sm">
                        Unlock Deep Analytics
                    </h2>
                    <p className="text-muted-foreground mb-8 text-[15px] leading-relaxed font-medium">
                        Upgrade to any paid plan to access full click timelines, device breakdowns, OS tracking, and more.
                    </p>
                    <Link href="/pricing" className="w-full">
                        <div className="w-full py-4 bg-primary text-primary-foreground text-sm font-bold rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                            View Plans & Upgrade
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function MobileAnalyticsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState("");
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);

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
            <div className="flex flex-col flex-1 w-full items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    // ── Not authenticated ──
    if (!user) {
        return (
            <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
                <TopNavbar />
                <main className="flex-1 flex flex-col overflow-hidden px-4 pt-4 relative">
                    <div className="mb-4">
                        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Analytics</h1>
                        <p className="text-sm text-muted-foreground mt-1">Unlock premium insights.</p>
                    </div>
                    <MobileLockedPreview />
                </main>
                
                <MobileBottomNav hidePlus={true} />
            </div>
        );
    }

    const isPaid = data ? isPaidPlan(data.plan as PlanType) : false;

    return (
        <div className="flex flex-col flex-1 w-full bg-background">
            <header className="px-6 py-6 border-b border-border flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
                    <span className="text-sm font-semibold text-foreground">ME</span>
                </div>
            </header>
            <main className={cn("flex-1 px-6 flex flex-col", (!dataLoading && data && !isPaid) ? "overflow-hidden pt-4 relative" : "overflow-y-auto py-6 pb-32")}>
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                {dataLoading && (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                )}

                {!dataLoading && data && !isPaid && <MobileLockedPreview />}

                {!dataLoading && data && isPaid && (
                    <MobileDashboard
                        data={data}
                        hoveredBar={hoveredBar}
                        onHoverBar={setHoveredBar}
                    />
                )}
            </main>
            
            <MobileBottomNav hidePlus={!!(!dataLoading && data && !isPaid)} />
        </div>
    );
}

// ─── Mobile Dashboard ────────────────────────────────────────────

function MobileDashboard({
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
                className="flex flex-col gap-4 mb-8"
            >
                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-primary/10 shadow-sm p-6 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                            Total Clicks
                        </span>
                        <MousePointerClick className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                        {data.summary.totalClicks.toLocaleString()}
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 gap-4">
                    <motion.div
                        variants={cardVariants}
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Links
                            </span>
                            <Link2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                            {data.summary.activeLinks}
                        </p>
                    </motion.div>

                    <motion.div
                        variants={cardVariants}
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Top
                            </span>
                            <Trophy className="h-4 w-4 text-amber-400" />
                        </div>
                        {topLink ? (
                            <>
                                <p className="text-base font-bold text-slate-900 truncate">
                                    {topLink.title || topLink.slug}
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-slate-400">No links</p>
                        )}
                    </motion.div>
                </div>
            </motion.div>

            {/* ── Click Timeline ── */}
            <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 mb-8"
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-900">
                        Click Timeline
                    </h2>
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                </div>

                {data.timeline.every((d) => d.clicks === 0) ? (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                        No click data
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-[2px] h-32">
                            {data.timeline.map((day, i) => {
                                const heightPercent = (day.clicks / maxClicks) * 100;
                                return (
                                    <div
                                        key={day.date}
                                        className="relative flex-1 group"
                                        onTouchStart={() => onHoverBar(i)}
                                        onTouchEnd={() => onHoverBar(null)}
                                    >
                                        {hoveredBar === i && (
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-md pointer-events-none">
                                                <span className="font-bold">{day.clicks}</span>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "w-full rounded-t-sm transition-all duration-200",
                                                hoveredBar === i
                                                    ? "bg-slate-700"
                                                    : "bg-slate-900"
                                            )}
                                            style={{
                                                height: `${Math.max(heightPercent, day.clicks > 0 ? 4 : 1)}%`,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </motion.div>

            {/* ── Traffic Insights ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-6"
            >
                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Operating Systems
                        </h3>
                    </div>
                    <BreakdownBars data={data.os} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Browsers
                        </h3>
                    </div>
                    <BreakdownBars data={data.browsers} />
                </motion.div>
                
                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Devices
                        </h3>
                    </div>
                    <BreakdownBars data={data.devices} />
                </motion.div>
            </motion.div>
        </>
    );
}

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
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildShortUrl } from "@/lib/utils/url-builder";
import Link from "next/link";
import { isPaidPlan } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";

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

function BreakdownList({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (entries.length === 0) {
        return <p className="text-sm text-slate-400">No data yet.</p>;
    }

    return (
        <div className="space-y-2.5">
            {entries.map(([label, count]) => (
                <div
                    key={label}
                    className="flex items-center justify-between text-sm"
                >
                    <span className="text-slate-700 font-medium truncate mr-4">
                        {label.replace(/_/g, ".")}
                    </span>
                    <span className="text-slate-500 tabular-nums shrink-0">
                        {count.toLocaleString()}
                    </span>
                </div>
            ))}
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

// ─── Locked Preview ─────────────────────────────────────────────────────────

function LockedPreview() {
    return (
        <div className="relative mt-4 max-h-[calc(100vh-280px)] overflow-hidden">
            <div className="pointer-events-none select-none blur-[6px] opacity-50">
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                        { label: "Total Clicks", value: "1,284" },
                        { label: "Active Links", value: "12" },
                        { label: "Top Performer", value: "my-link" },
                    ].map((card) => (
                        <div
                            key={card.label}
                            className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                        >
                            <span className="text-sm text-slate-500">
                                {card.label}
                            </span>
                            <p className="text-[42px] font-extrabold text-slate-900 mt-2">
                                {card.value}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
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
                <div className="grid grid-cols-2 gap-4">
                    {["Devices", "Browsers"].map((label) => (
                        <div
                            key={label}
                            className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 h-32"
                        />
                    ))}
                </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-md text-center">
                    <Lock className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        Analytics is a Premium Feature
                    </h2>
                    <p className="text-slate-500 mb-6">
                        Upgrade to any paid plan to unlock detailed analytics,
                        click tracking, device breakdowns, and more.
                    </p>
                    <Link href="/pricing">
                        <Button className="bg-slate-900 text-white hover:bg-slate-800 px-6 h-11 text-[15px] font-semibold rounded-xl shadow-sm">
                            View Plans & Upgrade
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AnalyticsPage() {
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    // ── Not authenticated ──
    if (!user) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <TopNavbar />
                <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full px-6 py-12">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        Sign in Required
                    </h1>
                    <p className="text-slate-500">
                        Please sign in to view analytics.
                    </p>
                </main>
            </div>
        );
    }

    const isPaid = data ? isPaidPlan(data.plan as PlanType) : false;

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
            <TopNavbar />
            <main className="flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden">
                <div className="w-full max-w-7xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Analytics
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Track your link performance over the last 30 days.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                {dataLoading && <OverviewSkeleton />}

                {!dataLoading && data && !isPaid && <LockedPreview />}

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
                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center justify-between mb-4">
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
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center justify-between mb-4">
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
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center justify-between mb-4">
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

            {/* ── Click Timeline ── */}
            <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mb-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Click Timeline
                    </h2>
                    <BarChart3 className="h-5 w-5 text-slate-400" />
                </div>

                {data.timeline.every((d) => d.clicks === 0) ? (
                    <div className="flex items-center justify-center h-48 text-sm text-slate-400">
                        No click data in the last 30 days.
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-[3px] h-48">
                            {data.timeline.map((day, i) => {
                                const heightPercent =
                                    (day.clicks / maxClicks) * 100;
                                return (
                                    <div
                                        key={day.date}
                                        className="relative flex-1 group cursor-pointer"
                                        onMouseEnter={() => onHoverBar(i)}
                                        onMouseLeave={() => onHoverBar(null)}
                                    >
                                        {hoveredBar === i && (
                                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg pointer-events-none">
                                                <p className="font-semibold">
                                                    {day.clicks} clicks
                                                </p>
                                                <p className="text-slate-300 text-[11px]">
                                                    {formatDate(day.date)}
                                                </p>
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
                        <div className="flex justify-between mt-3 text-xs text-slate-400">
                            <span>
                                {data.timeline[0]
                                    ? formatDate(data.timeline[0].date)
                                    : ""}
                            </span>
                            <span>
                                {data.timeline[data.timeline.length - 1]
                                    ? formatDate(
                                          data.timeline[
                                              data.timeline.length - 1
                                          ].date
                                      )
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
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8"
            >
                <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Top Performing Links
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap w-12">
                                    #
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Short URL
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Title
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">
                                    Clicks
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {data.summary.topLinks.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-8 text-center text-slate-500"
                                    >
                                        No link data yet. Create and share some
                                        links to see analytics.
                                    </td>
                                </tr>
                            ) : (
                                data.summary.topLinks.map((link, i) => (
                                    <tr
                                        key={link.slug}
                                        className="hover:bg-slate-50/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-400">
                                            {i + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <a
                                                href={buildShortUrl(link.slug)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-slate-900 font-medium font-mono text-xs hover:text-blue-600 transition-colors"
                                            >
                                                {buildShortUrl(link.slug).replace(/^https?:\/\//, "")}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 truncate max-w-[200px]">
                                            {link.title || link.slug}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-slate-900 tabular-nums">
                                            {link.clicks.toLocaleString()}
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
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Devices
                        </h3>
                    </div>
                    <BreakdownBars data={data.devices} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
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
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Link2 className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Top Referrers
                        </h3>
                    </div>
                    <BreakdownList data={data.referrers} />
                </motion.div>

                <motion.div
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                            Top Countries
                        </h3>
                    </div>
                    <BreakdownList data={data.countries} />
                </motion.div>
            </motion.div>
        </>
    );
}

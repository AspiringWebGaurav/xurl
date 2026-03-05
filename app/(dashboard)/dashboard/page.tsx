"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, MousePointerClick, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardOverviewPage() {
    return (
        <div className="flex-1 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                    <p className="text-sm text-zinc-500">
                        Analytics and performance for your links.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Clicks"
                    value="12,345"
                    trend="+12%"
                    icon={<MousePointerClick className="h-4 w-4 text-zinc-500" />}
                    delay={0}
                />
                <StatsCard
                    title="Active Links"
                    value="48"
                    trend="+3"
                    icon={<LinkIcon className="h-4 w-4 text-zinc-500" />}
                    delay={0.1}
                />
                <StatsCard
                    title="Avg. CTR"
                    value="24.8%"
                    trend="+2.1%"
                    icon={<TrendingUp className="h-4 w-4 text-zinc-500" />}
                    delay={0.2}
                />
                <StatsCard
                    title="Unique Visitors"
                    value="8,234"
                    trend="+8%"
                    icon={<BarChart3 className="h-4 w-4 text-zinc-500" />}
                    delay={0.3}
                />
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Click Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center text-zinc-500 text-sm border-t border-dashed rounded-b-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 m-6 mt-0">
                        [Chart Skeleton]
                    </CardContent>
                </Card>

                <Card className="col-span-3 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Top Locations</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {/* Simple Skeleton layout for now to simulate Perceived Performance */}
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded bg-zinc-100 dark:bg-zinc-800" />
                                    <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
                                </div>
                                <div className="h-4 w-12 rounded bg-zinc-100 dark:bg-zinc-800" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatsCard({ title, value, trend, icon, delay }: { title: string, value: string, trend: string, icon: React.ReactNode, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3, ease: "easeOut" }}
        >
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
                    {icon}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tracking-tight">{value}</div>
                    <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1 font-medium">
                        {trend} <span className="text-zinc-500 font-normal">from last month</span>
                    </p>
                </CardContent>
            </Card>
        </motion.div>
    );
}

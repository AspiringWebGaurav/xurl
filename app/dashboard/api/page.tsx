"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, KeyRound, Loader2, RefreshCw, Sparkles, TerminalSquare, ArrowLeft, ShieldCheck, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type ApiRequestLog = {
    requestId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    createdAt: number;
    quotaUsage: number;
};

type ApiDashboardData = {
    plan: string;
    apiEligible: boolean;
    apiEnabled: boolean;
    apiKey: string | null;
    apiRequestsUsed: number;
    apiQuotaTotal: number;
    remainingRequests: number;
    apiKeyLastRotatedAt: number | null;
    recentRequests: ApiRequestLog[];
    nextCursor?: number | null;
};

function LoadingView() {
    return (
        <div className="space-y-4 w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
                        <Skeleton className="mb-2 h-3.5 w-24" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm">
                <Skeleton className="mb-4 h-5 w-40" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}

export default function ApiDashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [data, setData] = useState<ApiDashboardData | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [prevCursors, setPrevCursors] = useState<number[]>([]);

    const perPage = 6;

    const canPrev = useMemo(() => prevCursors.length > 0, [prevCursors]);
    const canNext = useMemo(() => Boolean(nextCursor), [nextCursor]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setLoading(false);

            if (!nextUser) {
                setData(null);
                return;
            }

            await ensureUserDocument(nextUser);
            await loadDashboard(nextUser);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleProfileUpdated = () => {
            if (user) {
                void loadDashboard(user);
            }
        };

        window.addEventListener("userProfileUpdated", handleProfileUpdated);
        return () => {
            window.removeEventListener("userProfileUpdated", handleProfileUpdated);
        };
    }, [user]);

    async function loadDashboard(currentUser: User, cursor?: number, isNext = false) {
        if (!cursor) {
            setDataLoading(true);
        } else {
            setLogsLoading(true);
        }

        try {
            const token = await currentUser.getIdToken();
            const url = new URL("/api/user/api-access", window.location.origin);
            url.searchParams.set("limit", String(perPage));
            if (cursor) {
                url.searchParams.set("cursor", String(cursor));
            }

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.message || "Failed to load API dashboard.");
            }

            setData(json);
            setNextCursor(json.nextCursor ?? null);

            if (isNext && cursor) {
                setPrevCursors((prev) => [...prev, cursor]);
            } else if (!cursor) {
                setPrevCursors([]);
            }
        } catch (fetchError) {
            toast.error(fetchError instanceof Error ? fetchError.message : "Failed to load API dashboard.");
        } finally {
            setDataLoading(false);
            setLogsLoading(false);
        }
    }

    async function handleCopy() {
        if (!data?.apiKey) return;

        await navigator.clipboard.writeText(data.apiKey);
        setCopied(true);
        toast.success("API key copied to clipboard!");
        window.setTimeout(() => setCopied(false), 1500);
    }

    const handleNextPage = async () => {
        if (!user || !nextCursor) return;
        await loadDashboard(user, nextCursor, true);
    };

    const handlePrevPage = async () => {
        if (!user || prevCursors.length === 0) return;
        const newPrev = [...prevCursors];
        newPrev.pop();
        setPrevCursors(newPrev);
        await loadDashboard(user, newPrev[newPrev.length - 1], false);
    };

    async function handleRegenerate() {
        if (!user) return;

        setRegenerating(true);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/user/api-access", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.message || "Failed to regenerate API key.");
            }

            setData((current) => current ? {
                ...current,
                apiKey: json.apiKey,
                apiRequestsUsed: json.apiRequestsUsed,
                apiQuotaTotal: json.apiQuotaTotal,
                remainingRequests: json.remainingRequests,
                apiKeyLastRotatedAt: json.apiKeyLastRotatedAt,
            } : current);

            toast.success("New API key generated successfully!", {
                description: "Previous API key has been revoked instantly.",
            });
        } catch (regenerateError) {
            toast.error(regenerateError instanceof Error ? regenerateError.message : "Failed to regenerate API key.");
        } finally {
            setRegenerating(false);
        }
    }

    if (loading) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-[100dvh] flex flex-col justify-between bg-background overflow-hidden select-none">
            {/* Header Navbar */}
            <div className="shrink-0">
                <TopNavbar />
            </div>

            {/* Main Single-Screen Content View (Broad Responsive Enlarge) */}
            <main className="flex-1 min-h-0 w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col justify-center items-center overflow-hidden">
                {!user ? (
                    <div className="w-full max-w-xl text-center p-8 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl space-y-4">
                        <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                        <h1 className="text-xl font-bold text-foreground">Sign in Required</h1>
                        <p className="text-sm text-muted-foreground">Please sign in to manage your developer API access.</p>
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="w-full space-y-3 sm:space-y-5"
                    >
                        {/* Header Banner */}
                        <div className="flex items-center justify-between gap-2 px-1">
                            <Link href="/" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition">
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to shortener</span>
                            </Link>

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] sm:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-mono">
                                    Developer Portal
                                </span>
                                <Link href="/documentation/api" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline">
                                    <span>API Documentation</span>
                                </Link>
                            </div>
                        </div>

                        {dataLoading || !data ? (
                            <LoadingView />
                        ) : !data.apiEligible ? (
                            /* Non-Eligible Plan Lock View */
                            <div className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-2xl p-6 sm:p-10 text-center space-y-5 max-w-4xl mx-auto">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-widest">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Unlocks on Business & Enterprise</span>
                                </div>

                                <div className="space-y-2">
                                    <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
                                        REST API & Developer Automation
                                    </h1>
                                    <p className="text-xs sm:text-base text-muted-foreground max-w-2xl mx-auto">
                                        Your current plan is <span className="font-bold text-foreground uppercase">{data.plan}</span>. Upgrade to generate API keys, create short URLs programmatically, and monitor request latency.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto text-left">
                                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1.5">
                                        <KeyRound className="h-5 w-5 text-indigo-500" />
                                        <p className="text-sm font-bold text-foreground">API Key Auth</p>
                                        <p className="text-xs text-muted-foreground">Bearer token authentication for secure endpoints.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1.5">
                                        <Zap className="h-5 w-5 text-emerald-500" />
                                        <p className="text-sm font-bold text-foreground">High Speed</p>
                                        <p className="text-xs text-muted-foreground">Sub-50ms Edge API request processing.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1.5">
                                        <ShieldCheck className="h-5 w-5 text-primary" />
                                        <p className="text-sm font-bold text-foreground">Usage Logs</p>
                                        <p className="text-xs text-muted-foreground">Full request audit trail & quota monitoring.</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                    <Link href="/pricing?plan=business">
                                        <Button className="h-11 sm:h-13 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-base px-6 shadow-xl">
                                            Upgrade to Business
                                        </Button>
                                    </Link>
                                    <Link href="/documentation/api">
                                        <Button variant="outline" className="h-11 sm:h-13 rounded-2xl text-xs sm:text-base font-bold px-5">
                                            Preview API Documentation
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            /* Eligible Plan Developer Console */
                            <div className="space-y-4">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-4 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-sm space-y-1.5">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Quota</p>
                                        <p className="text-xl sm:text-2xl font-black text-foreground font-mono">
                                            {data.apiRequestsUsed.toLocaleString()} / {data.apiQuotaTotal.toLocaleString()}
                                        </p>
                                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, Math.round((data.apiRequestsUsed / Math.max(1, data.apiQuotaTotal)) * 100))}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-sm space-y-1.5">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remaining Calls</p>
                                        <p className="text-xl sm:text-2xl font-black text-emerald-500 font-mono">
                                            {data.remainingRequests.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Resets at start of billing cycle</p>
                                    </div>

                                    <div className="p-4 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-sm space-y-1.5">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Status</p>
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <p className="text-base font-bold text-foreground">Active & Healthy</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono">
                                            {data.apiKeyLastRotatedAt ? `Rotated ${formatDistanceToNow(data.apiKeyLastRotatedAt)} ago` : "Never rotated"}
                                        </p>
                                    </div>
                                </div>

                                {/* API Key Action Panel */}
                                <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-xl space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <KeyRound className="h-5 w-5 text-indigo-500" />
                                            <h2 className="text-sm sm:text-base font-extrabold text-foreground">Secret API Key</h2>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setShowKey(!showKey)}
                                                className="text-xs font-bold text-primary hover:underline px-2.5 py-1"
                                            >
                                                {showKey ? "Hide" : "Reveal"}
                                            </button>

                                            <Button 
                                                size="sm"
                                                variant="outline"
                                                onClick={handleRegenerate}
                                                disabled={regenerating}
                                                className="h-8 sm:h-9 text-xs font-bold px-3 rounded-xl border-border"
                                            >
                                                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? "animate-spin" : ""}`} />
                                                <span>Rotate Key</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border font-mono text-xs sm:text-sm text-foreground">
                                        <TerminalSquare className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">
                                            {data.apiKey ? (showKey ? data.apiKey : `${data.apiKey.slice(0, 14)}••••••••••••••••••••`) : "No active API key"}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleCopy}
                                            disabled={!data.apiKey}
                                            className="h-8 px-3 text-xs hover:bg-muted font-bold cursor-pointer"
                                        >
                                            <Copy className="h-4 w-4 mr-1.5" />
                                            <span>{copied ? "Copied!" : "Copy"}</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Request Audit Logs */}
                                <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-xl space-y-3">
                                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-foreground">
                                        <span>Recent Request Audit Logs</span>
                                        <div className="flex items-center gap-1.5">
                                            <Button size="sm" variant="ghost" onClick={handlePrevPage} disabled={!canPrev || logsLoading} className="h-7 text-xs px-2.5 font-bold">
                                                Prev
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={handleNextPage} disabled={!canNext || logsLoading} className="h-7 text-xs px-2.5 font-bold">
                                                Next
                                            </Button>
                                        </div>
                                    </div>

                                    {data.recentRequests.length === 0 ? (
                                        <p className="text-center text-xs text-muted-foreground py-6">No API requests recorded yet.</p>
                                    ) : (
                                        <div className="divide-y divide-border/60 max-h-44 overflow-y-auto pr-1">
                                            {data.recentRequests.map((req) => (
                                                <div key={req.requestId} className="py-2 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2.5 font-mono">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                            req.method === "POST" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                                        }`}>
                                                            {req.method}
                                                        </span>
                                                        <span className="text-foreground truncate max-w-[160px] sm:max-w-md">{req.endpoint}</span>
                                                    </div>

                                                    <div className="flex items-center gap-4 font-mono">
                                                        <span className="text-muted-foreground">{req.responseTimeMs}ms</span>
                                                        <span className={`font-bold ${req.statusCode < 400 ? "text-emerald-500" : "text-rose-500"}`}>
                                                            {req.statusCode}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </main>

            {/* Footer */}
            <div className="shrink-0 hidden md:block">
                <HomeFooter />
            </div>
            <div className="shrink-0 block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}
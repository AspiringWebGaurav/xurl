"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, KeyRound, Loader2, RefreshCw, Sparkles, TerminalSquare } from "lucide-react";

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
};

function LoadingView() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <Skeleton className="mb-3 h-4 w-24" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Skeleton className="mb-4 h-5 w-40" />
                <Skeleton className="h-14 w-full" />
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
    const [data, setData] = useState<ApiDashboardData | null>(null);
    const [error, setError] = useState("");

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

    async function loadDashboard(currentUser: User) {
        setDataLoading(true);
        setError("");

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch("/api/user/api-access", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.message || "Failed to load API dashboard.");
            }

            setData(json);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Failed to load API dashboard.");
        } finally {
            setDataLoading(false);
        }
    }

    async function handleCopy() {
        if (!data?.apiKey) return;

        await navigator.clipboard.writeText(data.apiKey);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    }

    async function handleRegenerate() {
        if (!user) return;

        setRegenerating(true);
        setError("");

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
        } catch (regenerateError) {
            setError(regenerateError instanceof Error ? regenerateError.message : "Failed to regenerate API key.");
        } finally {
            setRegenerating(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <TopNavbar />
                <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Sign in Required</h1>
                    <p className="mt-2 text-slate-500">Please sign in to manage your developer API access.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <TopNavbar />
            <main className="flex-1 w-full px-6 py-12">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Developer API</h1>
                            <p className="mt-2 text-slate-500">Manage your API key, monitor request usage, and review recent activity.</p>
                        </div>
                        <Link href="/documentation/api" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline">
                            View API Docs
                        </Link>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                            {error}
                        </div>
                    )}

                    {dataLoading || !data ? (
                        <LoadingView />
                    ) : !data.apiEligible ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                            <div className="flex max-w-3xl flex-col gap-4">
                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Premium Access
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">API access unlocks on Business and Enterprise plans.</h2>
                                <p className="text-slate-500">
                                    Your current plan is <span className="font-semibold capitalize text-slate-700">{data.plan}</span>. Upgrade to generate API keys,
                                    create short links programmatically, and review request logs in one place.
                                </p>
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <Link href="/pricing?plan=business">
                                        <Button className="h-11 rounded-xl bg-slate-900 px-5 text-white hover:bg-slate-800">Upgrade to Business</Button>
                                    </Link>
                                    <Link href="/documentation/api">
                                        <Button variant="outline" className="h-11 rounded-xl border-slate-200 px-5 text-slate-700 hover:bg-slate-100">
                                            Preview the API Docs
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-500">Requests Used</span>
                                        <TerminalSquare className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <p className="text-[38px] font-extrabold tracking-tight text-slate-900">
                                        {data.apiRequestsUsed}
                                        <span className="ml-2 text-base font-semibold text-slate-400">/ {data.apiQuotaTotal}</span>
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-500">Remaining</span>
                                        <KeyRound className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <p className="text-[38px] font-extrabold tracking-tight text-slate-900">{data.remainingRequests}</p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-500">Plan</span>
                                        <Sparkles className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <p className="text-[38px] font-extrabold capitalize tracking-tight text-slate-900">{data.plan}</p>
                                </div>
                            </div>

                            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Your API Key</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Use this key in the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Authorization</code> header.
                                        </p>
                                    </div>
                                    {data.apiKeyLastRotatedAt && (
                                        <p className="text-xs text-slate-400">
                                            Last rotated {formatDistanceToNow(data.apiKeyLastRotatedAt, { addSuffix: true })}
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100">
                                        {data.apiKey || "No API key available"}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <Button onClick={handleCopy} className="h-10 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800">
                                            <Copy className="mr-2 h-4 w-4" />
                                            {copied ? "Copied" : "Copy"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleRegenerate}
                                            disabled={regenerating}
                                            className="h-10 rounded-xl border-slate-200 px-4 text-slate-700 hover:bg-slate-100"
                                        >
                                            {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            Regenerate
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="border-b border-slate-100 px-6 py-5">
                                    <h2 className="text-lg font-semibold text-slate-900">API Activity</h2>
                                    <p className="mt-1 text-sm text-slate-500">Recent API requests, response times, and status codes.</p>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                                            <tr>
                                                <th className="px-6 py-4 font-medium">Request</th>
                                                <th className="px-6 py-4 font-medium">Status</th>
                                                <th className="px-6 py-4 font-medium">Time</th>
                                                <th className="px-6 py-4 font-medium">Used</th>
                                                <th className="px-6 py-4 font-medium">When</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {data.recentRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                        No API activity yet. Your first request will appear here.
                                                    </td>
                                                </tr>
                                            ) : (
                                                data.recentRequests.map((requestLog) => {
                                                    const isError = requestLog.statusCode >= 400;

                                                    return (
                                                        <tr key={requestLog.requestId} className="hover:bg-slate-50/60">
                                                            <td className="px-6 py-4">
                                                                <div className="font-mono text-xs text-slate-900">{requestLog.method} {requestLog.endpoint}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${isError ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                                                                    {requestLog.statusCode}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 tabular-nums text-slate-500">{requestLog.responseTimeMs}ms</td>
                                                            <td className="px-6 py-4 tabular-nums text-slate-500">{requestLog.quotaUsage}</td>
                                                            <td className="px-6 py-4 text-slate-500">
                                                                {formatDistanceToNow(requestLog.createdAt, { addSuffix: true })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

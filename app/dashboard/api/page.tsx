"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    Copy, KeyRound, Loader2, RefreshCw, Sparkles, TerminalSquare, 
    ShieldCheck, Zap, Lock, CheckCircle2, Code2, 
    ExternalLink, Activity, Eye, EyeOff, Radio, Server, Check, 
    Terminal, Globe, Cpu, ChevronLeft, ChevronRight
} from "lucide-react";
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
        <div className="space-y-3 w-full max-w-7xl mx-auto py-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
                        <Skeleton className="mb-2 h-3 w-20" />
                        <Skeleton className="h-7 w-28" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <div className="lg:col-span-5 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <div className="lg:col-span-7 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-44 w-full" />
                </div>
            </div>
        </div>
    );
}

// Notion-Style Code Renderers with Rich Syntax Highlighting
function CurlCode({ url, apiKey }: { url: string; apiKey: string }) {
    return (
        <div className="font-mono text-[11.5px] leading-relaxed space-y-1">
            <p>
                <span className="text-rose-600 dark:text-rose-400 font-bold">curl</span>{" "}
                <span className="text-amber-700 dark:text-amber-400 font-semibold">-X POST</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">&quot;{url}/links&quot;</span>{" "}
                <span className="text-neutral-400 dark:text-neutral-500">\</span>
            </p>
            <p className="pl-4">
                <span className="text-amber-700 dark:text-amber-400 font-semibold">-H</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Authorization: Bearer <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 px-1 py-0.5 rounded font-bold">{apiKey}</span>&quot;</span>{" "}
                <span className="text-neutral-400 dark:text-neutral-500">\</span>
            </p>
            <p className="pl-4">
                <span className="text-amber-700 dark:text-amber-400 font-semibold">-H</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Content-Type: application/json&quot;</span>{" "}
                <span className="text-neutral-400 dark:text-neutral-500">\</span>
            </p>
            <p className="pl-4">
                <span className="text-amber-700 dark:text-amber-400 font-semibold">-d</span>{" "}
                <span className="text-neutral-600 dark:text-neutral-400">&apos;&#123;</span>
                <span className="text-blue-700 dark:text-sky-300 font-medium">&quot;url&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;https://example.com/launch&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">, </span>
                <span className="text-blue-700 dark:text-sky-300 font-medium">&quot;alias&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;my-brand&quot;</span>
                <span className="text-neutral-600 dark:text-neutral-400">&#125;&apos;</span>
            </p>
        </div>
    );
}

function NodeCode({ url, apiKey }: { url: string; apiKey: string }) {
    return (
        <div className="font-mono text-[11.5px] leading-relaxed space-y-0.5">
            <p>
                <span className="text-purple-700 dark:text-purple-400 font-semibold">import</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">fetch</span>{" "}
                <span className="text-purple-700 dark:text-purple-400 font-semibold">from</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;node-fetch&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">;</span>
            </p>
            <div className="h-1" />
            <p>
                <span className="text-purple-700 dark:text-purple-400 font-semibold">const</span>{" "}
                <span className="text-blue-700 dark:text-sky-300">res</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">=</span>{" "}
                <span className="text-purple-700 dark:text-purple-400 font-semibold">await</span>{" "}
                <span className="text-blue-700 dark:text-blue-400 font-semibold">fetch</span>
                <span className="text-neutral-600 dark:text-neutral-400">(</span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;{url}/links&quot;</span>
                <span className="text-neutral-600 dark:text-neutral-400">, &#123;</span>
            </p>
            <p className="pl-4">
                <span className="text-blue-700 dark:text-sky-300 font-medium">method:</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;POST&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">,</span>
            </p>
            <p className="pl-4">
                <span className="text-blue-700 dark:text-sky-300 font-medium">headers:</span>{" "}
                <span className="text-neutral-600 dark:text-neutral-400">&#123;</span>
            </p>
            <p className="pl-8">
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Authorization&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Bearer <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 px-1 py-0.5 rounded font-bold">{apiKey}</span>&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">,</span>
            </p>
            <p className="pl-8">
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Content-Type&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;application/json&quot;</span>
            </p>
            <p className="pl-4">
                <span className="text-neutral-600 dark:text-neutral-400">&#125;,</span>
            </p>
            <p className="pl-4">
                <span className="text-blue-700 dark:text-sky-300 font-medium">body:</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">JSON.</span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">stringify</span>
                <span className="text-neutral-600 dark:text-neutral-400">(&#123;</span>
            </p>
            <p className="pl-8">
                <span className="text-blue-700 dark:text-sky-300 font-medium">url:</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;https://example.com/launch&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">,</span>
            </p>
            <p className="pl-8">
                <span className="text-blue-700 dark:text-sky-300 font-medium">alias:</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;my-brand&quot;</span>
            </p>
            <p className="pl-4">
                <span className="text-neutral-600 dark:text-neutral-400">&#125;)</span>
            </p>
            <p>
                <span className="text-neutral-600 dark:text-neutral-400">&#125;);</span>
            </p>
            <div className="h-1" />
            <p>
                <span className="text-purple-700 dark:text-purple-400 font-semibold">const</span>{" "}
                <span className="text-blue-700 dark:text-sky-300">data</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">=</span>{" "}
                <span className="text-purple-700 dark:text-purple-400 font-semibold">await</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">res.</span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">json</span>
                <span className="text-neutral-600 dark:text-neutral-400">();</span>
            </p>
            <p>
                <span className="text-neutral-800 dark:text-neutral-200">console.</span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">log</span>
                <span className="text-neutral-600 dark:text-neutral-400">(</span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Short link:&quot;</span>
                <span className="text-neutral-600 dark:text-neutral-400">, data.shortUrl);</span>
            </p>
        </div>
    );
}

function PythonCode({ url, apiKey }: { url: string; apiKey: string }) {
    return (
        <div className="font-mono text-[11.5px] leading-relaxed space-y-0.5">
            <p>
                <span className="text-purple-700 dark:text-purple-400 font-semibold">import</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">requests</span>
            </p>
            <div className="h-1" />
            <p>
                <span className="text-blue-700 dark:text-sky-300 font-medium">url</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">=</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400">&quot;{url}/links&quot;</span>
            </p>
            <p>
                <span className="text-blue-700 dark:text-sky-300 font-medium">headers</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">= &#123;</span>
            </p>
            <p className="pl-4">
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Authorization&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Bearer <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 px-1 py-0.5 rounded font-bold">{apiKey}</span>&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">,</span>
            </p>
            <p className="pl-4">
                <span className="text-emerald-700 dark:text-emerald-400">&quot;Content-Type&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;application/json&quot;</span>
            </p>
            <p className="pl-4">
                <span className="text-neutral-600 dark:text-neutral-400">&#125;</span>
            </p>
            <p>
                <span className="text-blue-700 dark:text-sky-300 font-medium">payload</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">= &#123;</span>
            </p>
            <p className="pl-4">
                <span className="text-blue-700 dark:text-sky-300 font-medium">&quot;url&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;https://example.com/launch&quot;</span>
                <span className="text-neutral-400 dark:text-neutral-500">,</span>
            </p>
            <p className="pl-4">
                <span className="text-blue-700 dark:text-sky-300 font-medium">&quot;alias&quot;</span>
                <span className="text-neutral-500 dark:text-neutral-400">: </span>
                <span className="text-emerald-700 dark:text-emerald-400">&quot;my-brand&quot;</span>
            </p>
            <p className="pl-4">
                <span className="text-neutral-600 dark:text-neutral-400">&#125;</span>
            </p>
            <div className="h-1" />
            <p>
                <span className="text-blue-700 dark:text-sky-300 font-medium">res</span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">=</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">requests.</span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">post</span>
                <span className="text-neutral-600 dark:text-neutral-400">(url, json=payload, headers=headers)</span>
            </p>
            <p>
                <span className="text-purple-700 dark:text-purple-400 font-semibold">print</span>
                <span className="text-neutral-600 dark:text-neutral-400">(res.</span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold">json</span>
                <span className="text-neutral-600 dark:text-neutral-400">())</span>
            </p>
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
    const [confirmRotate, setConfirmRotate] = useState(false);
    const [snippetTab, setSnippetTab] = useState<"curl" | "node" | "python">("curl");
    const [snippetCopied, setSnippetCopied] = useState(false);
    const [baseUrlCopied, setBaseUrlCopied] = useState(false);
    const [data, setData] = useState<ApiDashboardData | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);

    // Enterprise In-Memory Page Cache to NEVER burn Firebase reads on pagination
    const [pagesCache, setPagesCache] = useState<Record<number, ApiRequestLog[]>>({});
    const [cursorMap, setCursorMap] = useState<Record<number, number | null>>({});
    const [currentPage, setCurrentPage] = useState(1);

    const isFetchingRef = useRef(false);
    const lastScrollFetchTime = useRef(0);
    const perPage = 8;

    const origin = typeof window !== "undefined" ? window.location.origin : "https://xurl.eu.cc";
    const baseApiUrl = `${origin}/api`;

    const loadDashboard = useCallback(async (currentUser: User, cursor?: number, targetPage = 1) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (targetPage === 1 && !cursor) {
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
                const message = json.message || "Failed to load API dashboard.";
                const cleanMessage = message.includes("authenticate data") || message.includes("Unsupported state")
                    ? "API key synchronized. Refreshing dashboard..."
                    : message;
                throw new Error(cleanMessage);
            }

            setData(json);

            // Cache page in memory to guarantee ZERO Firebase reads on backward navigation
            setPagesCache((prev) => ({
                ...prev,
                [targetPage]: json.recentRequests || [],
            }));

            // Record next cursor for targetPage
            setCursorMap((prev) => ({
                ...prev,
                [targetPage]: json.nextCursor ?? null,
            }));

            setCurrentPage(targetPage);
        } catch (fetchError) {
            toast.error(fetchError instanceof Error ? fetchError.message : "Failed to load API dashboard.");
        } finally {
            setDataLoading(false);
            setLogsLoading(false);
            isFetchingRef.current = false;
        }
    }, [perPage]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setLoading(false);

            if (!nextUser) {
                setData(null);
                return;
            }

            await ensureUserDocument(nextUser);
            await loadDashboard(nextUser, undefined, 1);
        });

        return () => unsubscribe();
    }, [loadDashboard]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        const handleProfileUpdated = () => {
            if (user && !isFetchingRef.current) {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    void loadDashboard(user, undefined, 1);
                }, 500);
            }
        };

        window.addEventListener("userProfileUpdated", handleProfileUpdated);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("userProfileUpdated", handleProfileUpdated);
        };
    }, [user, loadDashboard]);

    async function handleCopy() {
        if (!data?.apiKey) return;

        await navigator.clipboard.writeText(data.apiKey);
        setCopied(true);
        toast.success("API key copied to clipboard!");
        window.setTimeout(() => setCopied(false), 2000);
    }

    async function handleCopyBaseUrl() {
        await navigator.clipboard.writeText(baseApiUrl);
        setBaseUrlCopied(true);
        toast.success("Base API URL copied!");
        window.setTimeout(() => setBaseUrlCopied(false), 1500);
    }

    // Raw string snippets for copying directly to terminal
    const rawSnippets: Record<"curl" | "node" | "python", string> = useMemo(() => {
        const key = data?.apiKey || "YOUR_API_KEY";
        return {
            curl: `curl -X POST "${baseApiUrl}/links" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/launch", "alias": "my-brand"}'`,
            node: `import fetch from "node-fetch";

const res = await fetch("${baseApiUrl}/links", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://example.com/launch",
    alias: "my-brand"
  })
});

const data = await res.json();
console.log("Short link:", data.shortUrl);`,
            python: `import requests

url = "${baseApiUrl}/links"
headers = {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
}
payload = {
    "url": "https://example.com/launch",
    "alias": "my-brand"
}

res = requests.post(url, json=payload, headers=headers)
print(res.json())`
        };
    }, [baseApiUrl, data?.apiKey]);

    async function handleCopySnippet(tab?: "curl" | "node" | "python") {
        const targetTab = tab || snippetTab;
        await navigator.clipboard.writeText(rawSnippets[targetTab]);
        setSnippetCopied(true);
        toast.success(`${targetTab === "curl" ? "cURL" : targetTab === "node" ? "Node.js" : "Python"} code copied!`);
        window.setTimeout(() => setSnippetCopied(false), 2000);
    }

    // Enterprise Caching: Forward pagination checks memory first (0 Firebase reads)
    const handleNextPage = useCallback(async () => {
        if (!user) return;
        const nextPage = currentPage + 1;

        // 1. If already in memory cache, load instantly with 0 Firebase reads!
        if (pagesCache[nextPage]) {
            setCurrentPage(nextPage);
            return;
        }

        // 2. Fetch next page using cursor from current page
        const cursor = cursorMap[currentPage];
        if (cursor) {
            await loadDashboard(user, cursor, nextPage);
        }
    }, [user, currentPage, pagesCache, cursorMap, loadDashboard]);

    // Enterprise Caching: Backward pagination is 100% memory-cached (0 Firebase reads)
    const handlePrevPage = useCallback(() => {
        if (currentPage <= 1) return;
        const prevPage = currentPage - 1;

        if (pagesCache[prevPage]) {
            setCurrentPage(prevPage);
        }
    }, [currentPage, pagesCache]);

    // Refresh invalidates cache and queries fresh page 1
    const handleRefresh = async () => {
        if (!user) return;
        setPagesCache({});
        setCursorMap({});
        await loadDashboard(user, undefined, 1);
        toast.success("Requests refreshed from live stream");
    };

    // Scroll to fetch next page with 1s debounce guard
    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 24) {
            const now = Date.now();
            if (now - lastScrollFetchTime.current < 1000) return;
            lastScrollFetchTime.current = now;

            const canFetchNext = Boolean(cursorMap[currentPage]) || Boolean(pagesCache[currentPage + 1]);
            if (canFetchNext && !logsLoading && !isFetchingRef.current) {
                void handleNextPage();
            }
        }
    };

    async function handleRegenerate() {
        if (!user) return;

        setRegenerating(true);
        setConfirmRotate(false);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/user/api-access", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.message || "Failed to generate new key.");
            }

            setData((current) => current ? {
                ...current,
                apiKey: json.apiKey,
                apiRequestsUsed: json.apiRequestsUsed,
                apiQuotaTotal: json.apiQuotaTotal,
                remainingRequests: json.remainingRequests,
                apiKeyLastRotatedAt: json.apiKeyLastRotatedAt,
            } : current);

            toast.success("New API key generated!");
        } catch (regenerateError) {
            toast.error(regenerateError instanceof Error ? regenerateError.message : "Failed to generate new key.");
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

    const used = data?.apiRequestsUsed || 0;
    const total = Math.max(1, data?.apiQuotaTotal || 1);
    const usagePercent = Math.min(100, Math.round((used / total) * 100));
    const activeKeyToDisplay = data?.apiKey 
        ? (showKey ? data.apiKey : `${data.apiKey.slice(0, 14)}••••••••••••••••••••`)
        : "YOUR_API_KEY";

    // Active page logs from in-memory cache
    const currentLogs = pagesCache[currentPage] || data?.recentRequests || [];
    const totalCount = data?.apiRequestsUsed || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const endRecord = Math.min(currentPage * perPage, totalCount);
    const hasNextPage = Boolean(cursorMap[currentPage]) || Boolean(pagesCache[currentPage + 1]) || currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return (
        <div className="h-[100dvh] flex flex-col justify-between bg-background overflow-hidden select-none">
            {/* 1. Header Navbar */}
            <div className="shrink-0 z-20">
                <TopNavbar />
            </div>

            {/* 2. Main Single-Screen Content View */}
            <main className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-2 flex flex-col justify-between overflow-y-auto lg:overflow-hidden">
                {!user ? (
                    <div className="w-full max-w-xl mx-auto my-auto text-center p-8 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl space-y-4">
                        <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                        <h1 className="text-xl font-bold text-foreground">Sign in Required</h1>
                        <p className="text-sm text-muted-foreground">Please sign in to view and use your API keys.</p>
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="w-full flex-1 min-h-0 flex flex-col justify-between"
                    >
                        {/* A. Top Header Strip (Simple Words) */}
                        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 flex items-center justify-center">
                                        <Terminal className="h-3.5 w-3.5" />
                                    </div>
                                    <h1 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
                                        <span>Developer API</span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-border">
                                            REST v1
                                        </span>
                                    </h1>
                                </div>

                                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/60">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        API Online
                                    </span>
                                    <button 
                                        onClick={handleCopyBaseUrl}
                                        title="Click to copy API URL"
                                        className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted px-2 py-0.5 rounded-md border border-border/50 transition cursor-pointer"
                                    >
                                        <Globe className="h-3 w-3 text-muted-foreground" />
                                        <span>{baseApiUrl}</span>
                                        {baseUrlCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link 
                                    href="/documentation/api" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20"
                                >
                                    <span>API Docs</span>
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>

                        {dataLoading && !data ? (
                            <LoadingView />
                        ) : !data ? (
                            <LoadingView />
                        ) : !data.apiEligible ? (
                            /* Non-Eligible Plan Lock View */
                            <div className="my-auto rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-2xl p-6 sm:p-10 text-center space-y-4 max-w-3xl mx-auto">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-widest">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Available on Business & Enterprise</span>
                                </div>

                                <div className="space-y-1.5">
                                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                                        API & Automated Shortening
                                    </h2>
                                    <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
                                        Your current plan is <span className="font-bold text-foreground uppercase">{data.plan}</span>. Upgrade to generate API keys and shorten links directly from your code.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto pt-2">
                                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
                                        <KeyRound className="h-4 w-4 text-indigo-500" />
                                        <p className="text-xs font-bold text-foreground">API Key Auth</p>
                                        <p className="text-[11px] text-muted-foreground">Secure Bearer token authentication.</p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
                                        <Zap className="h-4 w-4 text-emerald-500" />
                                        <p className="text-xs font-bold text-foreground">High Speed</p>
                                        <p className="text-[11px] text-muted-foreground">Sub-50ms fast link creation.</p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        <p className="text-xs font-bold text-foreground">Usage Logs</p>
                                        <p className="text-[11px] text-muted-foreground">See your real-time API call history.</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-3 pt-3">
                                    <Link href="/pricing?plan=business">
                                        <Button className="h-9 sm:h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs px-5 shadow-lg">
                                            Upgrade to Business
                                        </Button>
                                    </Link>
                                    <Link href="/documentation/api" target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="h-9 sm:h-10 rounded-xl text-xs font-bold px-4">
                                            Preview Docs
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            /* Eligible Plan Developer Console */
                            <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 pt-1.5">
                                
                                {/* B. Top Metrics Cards (Simple Words) */}
                                <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
                                    {/* Card 1: Total API Quota */}
                                    <div className="p-2.5 rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-xs flex flex-col justify-between">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Cpu className="h-3 w-3 text-indigo-500" />
                                                <span>Total API Quota</span>
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-muted-foreground">{usagePercent}% used</span>
                                        </div>
                                        <p className="text-base sm:text-xl font-black text-foreground font-mono leading-tight mt-1">
                                            {used.toLocaleString()}{" "}
                                            <span className="text-xs font-semibold text-muted-foreground font-sans">
                                                / {total.toLocaleString()}
                                            </span>
                                        </p>
                                        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden mt-1.5">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all duration-300"
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Card 2: Remaining Calls */}
                                    <div className="p-2.5 rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Zap className="h-3 w-3 text-emerald-500" />
                                            <span>Remaining Calls</span>
                                        </span>
                                        <p className="text-base sm:text-xl font-black text-emerald-500 font-mono leading-tight mt-1">
                                            {data.remainingRequests.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight flex items-center gap-1 mt-1">
                                            <CheckCircle2 className="h-3 w-3 inline shrink-0" />
                                            <span>Permanent balance · Never expires</span>
                                        </p>
                                    </div>

                                    {/* Card 3: API Key Status */}
                                    <div className="p-2.5 rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <ShieldCheck className="h-3 w-3 text-primary" />
                                            <span>API Key Status</span>
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                            <p className="text-xs sm:text-sm font-bold text-foreground leading-tight">Active & Ready</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-mono leading-tight mt-1">
                                            {data.apiKeyLastRotatedAt 
                                                ? `Rotated ${formatDistanceToNow(data.apiKeyLastRotatedAt)} ago` 
                                                : "Active key"}
                                        </p>
                                    </div>

                                    {/* Card 4: Speed & Limits */}
                                    <div className="p-2.5 rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-xs flex flex-col justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Server className="h-3 w-3 text-amber-500" />
                                            <span>Speed & Limits</span>
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-base sm:text-xl font-black text-foreground font-mono leading-tight">600</p>
                                            <span className="text-[10px] font-semibold text-muted-foreground font-mono">calls / min</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-mono leading-tight mt-1">
                                            Fast response (&lt; 50ms)
                                        </p>
                                    </div>
                                </div>

                                {/* C. Two-Column Split (Fits in 1 Screen without scroll on desktop) */}
                                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                                    
                                    {/* Left Column: API Key & Code Snippet (5 cols) */}
                                    <div className="lg:col-span-5 flex flex-col gap-2 min-h-0">
                                        
                                        {/* C1. API Key Box */}
                                        <div className="p-3 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-2xl shadow-xs space-y-2 shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                                                    <span className="text-xs font-bold text-foreground">Your Secret API Key</span>
                                                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Live
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => setShowKey(!showKey)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted/60 transition cursor-pointer"
                                                    >
                                                        {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                        <span>{showKey ? "Hide" : "Reveal"}</span>
                                                    </button>

                                                    {!confirmRotate ? (
                                                        <Button 
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setConfirmRotate(true)}
                                                            disabled={regenerating}
                                                            className="h-6 text-[10px] font-bold px-2 rounded-lg border-border cursor-pointer"
                                                        >
                                                            <RefreshCw className={`h-2.5 w-2.5 mr-1 ${regenerating ? "animate-spin" : ""}`} />
                                                            <span>Rotate</span>
                                                        </Button>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <Button 
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={handleRegenerate}
                                                                disabled={regenerating}
                                                                className="h-6 text-[10px] font-bold px-2 rounded-lg cursor-pointer"
                                                            >
                                                                {regenerating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Confirm New Key"}
                                                            </Button>
                                                            <Button 
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setConfirmRotate(false)}
                                                                className="h-6 text-[10px] px-1.5 cursor-pointer"
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Key Display */}
                                            <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/60 font-mono text-xs text-foreground">
                                                <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="truncate flex-1 tracking-tight select-all">
                                                    {data.apiKey 
                                                        ? (showKey ? data.apiKey : `${data.apiKey.slice(0, 14)}••••••••••••••••••••`) 
                                                        : "No active API key"}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={handleCopy}
                                                    disabled={!data.apiKey}
                                                    className="h-6 px-2 text-[10px] font-bold cursor-pointer shrink-0"
                                                >
                                                    {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                                                    <span>{copied ? "Copied" : "Copy"}</span>
                                                </Button>
                                            </div>

                                            <p className="text-[10px] text-muted-foreground px-0.5">
                                                Use in request header: <code className="font-mono text-foreground font-semibold">Authorization: Bearer &lt;key&gt;</code>
                                            </p>
                                        </div>

                                        {/* C2. Code Examples - Notion-Style Clean Code Block */}
                                        <div className="p-3 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-2xl shadow-xs flex-1 min-h-0 flex flex-col justify-between">
                                            <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Code2 className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-xs font-bold text-foreground">Code Examples</span>
                                                </div>

                                                <div className="flex items-center gap-1 bg-[#F1F0EC] dark:bg-[#252525] p-0.5 rounded-lg border border-[#E3E2DE] dark:border-[#2F2F2F]">
                                                    {(["curl", "node", "python"] as const).map((tab) => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => setSnippetTab(tab)}
                                                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition cursor-pointer ${
                                                                snippetTab === tab 
                                                                    ? "bg-white dark:bg-[#191919] text-foreground shadow-xs border border-border/60 font-semibold" 
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            {tab === "curl" ? "cURL" : tab === "node" ? "Node.js" : "Python"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Notion-Style Clean Code Block */}
                                            <div className="mt-2 flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden border border-[#E3E2DE] dark:border-[#2F2F2F] bg-[#F7F6F3] dark:bg-[#1E1E1E]">
                                                {/* Notion Header Bar */}
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-[#F1F0EC]/90 dark:bg-[#252525]/90 border-b border-[#E3E2DE] dark:border-[#2F2F2F] shrink-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-mono font-medium text-muted-foreground">
                                                            {snippetTab === "curl" ? "bash" : snippetTab === "node" ? "javascript" : "python"}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleCopySnippet()}
                                                        title="Copy Code"
                                                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                                    >
                                                        {snippetCopied ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                                                        <span>{snippetCopied ? "Copied" : "Copy"}</span>
                                                    </button>
                                                </div>

                                                {/* Notion Code Content */}
                                                <div className="flex-1 min-h-0 overflow-y-auto p-3 text-foreground select-text">
                                                    {snippetTab === "curl" ? (
                                                        <CurlCode url={baseApiUrl} apiKey={activeKeyToDisplay} />
                                                    ) : snippetTab === "node" ? (
                                                        <NodeCode url={baseApiUrl} apiKey={activeKeyToDisplay} />
                                                    ) : (
                                                        <PythonCode url={baseApiUrl} apiKey={activeKeyToDisplay} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Recent Requests with Enterprise In-Memory Pagination (7 cols) */}
                                    <div className="lg:col-span-7 flex flex-col min-h-0">
                                        <div className="p-3 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-2xl shadow-xs flex-1 min-h-0 flex flex-col justify-between">
                                            
                                            {/* Header */}
                                            <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-xs font-bold text-foreground">Recent API Requests</span>
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Live
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* In-Memory Cache efficiency badge */}
                                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
                                                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                                        <span>Cached · 0 reads on back</span>
                                                    </span>

                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={handleRefresh}
                                                        disabled={logsLoading}
                                                        title="Refresh requests stream"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <RefreshCw className={`h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Requests Body */}
                                            {totalCount === 0 || currentLogs.length === 0 ? (
                                                /* Standby State (Simple Words) */
                                                <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-4 sm:p-6 border border-dashed border-border/60 rounded-xl bg-muted/15 my-2">
                                                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center mb-2.5">
                                                        <Radio className="h-5 w-5 animate-pulse" />
                                                    </div>
                                                    <h3 className="text-xs sm:text-sm font-bold text-foreground">No API requests yet</h3>
                                                    <p className="text-[11px] text-muted-foreground max-w-sm mt-1 leading-relaxed">
                                                        Copy the cURL code on the left and run it in your terminal to see your live API calls show up here.
                                                    </p>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleCopySnippet("curl")}
                                                        className="mt-3 h-7 px-3 rounded-xl text-[11px] font-bold border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                                    >
                                                        <Copy className="h-3 w-3 mr-1.5" />
                                                        <span>Copy cURL Command</span>
                                                    </Button>
                                                </div>
                                            ) : (
                                                /* Requests Table with Scroll & Pagination */
                                                <div className="flex-1 min-h-0 flex flex-col justify-between mt-1.5">
                                                    <div 
                                                        onScroll={handleTableScroll}
                                                        className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40 pr-1 text-[11px]"
                                                    >
                                                        {/* Table Column Header */}
                                                        <div className="sticky top-0 bg-card/95 backdrop-blur-xs py-1 flex items-center justify-between text-[10px] font-mono uppercase font-bold text-muted-foreground border-b border-border/60 mb-1">
                                                            <span className="w-16">Method</span>
                                                            <span className="flex-1 px-2">Endpoint</span>
                                                            <span className="w-16 text-right">Speed</span>
                                                            <span className="w-16 text-right">Status</span>
                                                        </div>

                                                        {currentLogs.map((req) => (
                                                            <div key={req.requestId} className="py-2 flex items-center justify-between font-mono hover:bg-muted/30 px-1 rounded-md transition-colors">
                                                                <div className="w-16">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                        req.method === "POST" 
                                                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25" 
                                                                            : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                                                                    }`}>
                                                                        {req.method}
                                                                    </span>
                                                                </div>

                                                                <div className="flex-1 px-2 min-w-0">
                                                                    <p className="truncate text-foreground font-semibold">{req.endpoint}</p>
                                                                    <p className="text-[9px] text-muted-foreground">
                                                                        {formatDistanceToNow(req.createdAt)} ago · Cost: {req.quotaUsage || 1} call
                                                                    </p>
                                                                </div>

                                                                <div className="w-16 text-right text-muted-foreground">
                                                                    {req.responseTimeMs}ms
                                                                </div>

                                                                <div className="w-16 text-right">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                        req.statusCode < 400 
                                                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                                                                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                                                    }`}>
                                                                        {req.statusCode}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {logsLoading && (
                                                            <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                                                <span>Loading next page...</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Dedicated Enterprise Pagination Toolbar */}
                                                    <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between text-xs shrink-0">
                                                        <div className="text-[11px] text-muted-foreground font-medium">
                                                            Showing <span className="font-bold text-foreground">{startRecord}–{endRecord}</span> of <span className="font-bold text-foreground">{totalCount}</span> calls
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50 border border-border/40 font-semibold">
                                                                Page {currentPage} of {totalPages}
                                                            </span>

                                                            <div className="flex items-center gap-1">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    onClick={handlePrevPage} 
                                                                    disabled={!hasPrevPage || logsLoading} 
                                                                    className="h-7 text-xs px-2.5 font-bold cursor-pointer rounded-xl border-border flex items-center gap-1"
                                                                >
                                                                    <ChevronLeft className="h-3.5 w-3.5" />
                                                                    <span>Prev</span>
                                                                </Button>

                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    onClick={handleNextPage} 
                                                                    disabled={!hasNextPage || logsLoading} 
                                                                    className="h-7 text-xs px-2.5 font-bold cursor-pointer rounded-xl border-border flex items-center gap-1"
                                                                >
                                                                    <span>Next</span>
                                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </main>

            {/* 3. Footer */}
            <div className="shrink-0 hidden md:block">
                <HomeFooter />
            </div>
            <div className="shrink-0 block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}
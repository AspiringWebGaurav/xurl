"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument, getPreferredDisplayName } from "@/lib/firebase/user-profile";
import { 
    Home, 
    BarChart2, 
    Settings, 
    Plus, 
    Loader2, 
    Sparkles, 
    ArrowRight, 
    Link2, 
    MousePointerClick, 
    Copy, 
    Check, 
    ExternalLink, 
    Zap, 
    ShieldCheck, 
    TrendingUp,
    Layers
} from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { MobileGuestLocked } from '@/components/mobile/MobileGuestLocked';
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { buildShortUrl } from "@/lib/utils/url-builder";
import Link from "next/link";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";

interface DashboardSummary {
    totalClicks: number;
    activeLinks: number;
    topLinks: Array<{
        slug: string;
        title?: string;
        destinationUrl?: string;
        originalUrl?: string;
        url?: string;
        clicks: number;
        createdAt?: number;
    }>;
}

export default function MobileDashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardSummary | null>(null);
    const [linksMeta, setLinksMeta] = useState<{
        plan: string;
        limit: number;
        paidLinksCreated: number;
        freeLinksCreated: number;
        totalLinksEver: number;
    }>({
        plan: "free",
        limit: 5,
        paidLinksCreated: 0,
        freeLinksCreated: 0,
        totalLinksEver: 0,
    });
    const [curatedOffer, setCuratedOffer] = useState<any>(null);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const { login, isLoggingIn } = useGoogleLogin({ toastId: "mobile-dashboard-login" });

    const fetchDashboardState = useCallback(async (u: User) => {
        try {
            const token = await u.getIdToken();
            const [resAnalytics, resLinks, resOffers] = await Promise.all([
                fetch("/api/analytics/dashboard", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/links?pageSize=5", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/user/partial-offers", { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (resAnalytics.ok) {
                const json = await resAnalytics.json();
                setData(json?.summary || null);
            }

            if (resLinks.ok) {
                const jsonLinks = await resLinks.json();
                setLinksMeta({
                    plan: jsonLinks.plan || "free",
                    limit: jsonLinks.limit || (jsonLinks.plan === "free" ? 5 : 25),
                    paidLinksCreated: jsonLinks.paidLinksCreated || 0,
                    freeLinksCreated: jsonLinks.freeLinksCreated || 0,
                    totalLinksEver: jsonLinks.totalLinksEver || 0,
                });
            }

            if (resOffers.ok) {
                const jsonOffers = await resOffers.json();
                if (Array.isArray(jsonOffers.offers) && jsonOffers.offers.length > 0) {
                    setCuratedOffer(jsonOffers.offers[0]);
                } else {
                    setCuratedOffer(null);
                }
            }
        } catch (e) {
            console.error("Failed to load dashboard state", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await ensureUserDocument(u);
                await fetchDashboardState(u);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchDashboardState]);

    const handleCopy = (slug: string, e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic(20);
        const url = buildShortUrl(slug);
        navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        toast.success("Link copied to clipboard!", { description: url });
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex flex-col flex-1 w-full bg-background min-h-[100dvh]">
                <TopNavbar />
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground">Loading your workspace...</span>
                </div>
                <MobileBottomNav />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 w-full bg-background overflow-hidden min-h-[100dvh]">
                <TopNavbar />
                
                <MobileGuestLocked 
                    title="Sign in Required" 
                    message="Create an account to access your personal dashboard, track link metrics in real-time, and bank permanent URLs."
                >
                    <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 mb-6 relative overflow-hidden">
                        <h2 className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">Total Link Traffic</h2>
                        <p className="text-4xl font-black text-foreground tracking-tight">12,482</p>
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-3">Live Edge Links</h3>
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center shadow-xs">
                                <div className="flex flex-col overflow-hidden pr-3">
                                    <span className="font-bold text-foreground truncate text-sm">xurl.co/promo{i}</span>
                                    <span className="text-muted-foreground text-xs truncate mt-0.5">https://example.com/very-long-url-that-needs-shortening</span>
                                </div>
                                <div className="flex flex-col items-end text-muted-foreground shrink-0">
                                    <span className="font-black text-foreground text-sm">2.4k</span>
                                    <span className="text-[10px]">clicks</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </MobileGuestLocked>

                <MobileBottomNav />
            </div>
        );
    }

    const totalClicks = data?.totalClicks || 0;
    const topLinks = data?.topLinks || [];
    const currentPlan = linksMeta.plan || "free";
    const isFree = currentPlan === "free";
    const usedLinks = isFree ? linksMeta.freeLinksCreated : linksMeta.paidLinksCreated;
    const linkLimit = linksMeta.limit || (isFree ? 5 : 25);
    const usagePercent = Math.min(100, Math.round((usedLinks / linkLimit) * 100));

    return (
        <div className="flex flex-col flex-1 w-full bg-background min-h-[100dvh]">
            <TopNavbar />

            <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 space-y-5">
                {/* User Header & Plan Pill */}
                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={user} className="h-11 w-11 shrink-0 text-base font-black ring-2 ring-primary/20" />
                        <div className="min-w-0">
                            <h1 className="text-base font-black text-foreground truncate leading-tight">
                                {getPreferredDisplayName(user)}
                            </h1>
                            <p className="text-xs text-muted-foreground truncate font-mono">
                                {user.email}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/mobile/plan"
                        onClick={() => triggerHaptic(20)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold hover:bg-primary/20 transition active:scale-95"
                    >
                        <Zap className="h-3.5 w-3.5 fill-primary" />
                        <span className="capitalize">{currentPlan}</span>
                    </Link>
                </div>

                {/* Curated Custom Plan Ready VIP Banner */}
                {curatedOffer && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden rounded-3xl border-2 border-indigo-500/60 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-4 shadow-xl"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600/25 via-purple-600/15 to-transparent pointer-events-none" />
                        <div className="relative z-10 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-2.5 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/40 animate-pulse">
                                    <Sparkles className="h-3 w-3 text-amber-300" />
                                    Curated Plan Ready
                                </span>
                                <span className="text-xs font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    ₹{curatedOffer.discountValue?.toLocaleString()}/mo
                                </span>
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white leading-snug">{curatedOffer.title}</h3>
                                <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{curatedOffer.description}</p>
                            </div>
                            <Link
                                href="/mobile/plan"
                                onClick={() => triggerHaptic(30)}
                                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs h-9 shadow-md transition active:scale-[0.98]"
                            >
                                <span>Claim Curated Plan</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </motion.div>
                )}

                {/* Key Metric Overview Cards */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Total Clicks Card */}
                    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xs">
                        <div className="flex items-center justify-between text-primary mb-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Traffic</span>
                            <MousePointerClick className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                {totalClicks.toLocaleString()}
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mt-0.5">
                                <TrendingUp className="h-3 w-3 text-emerald-500" /> Across all links
                            </span>
                        </div>
                    </div>

                    {/* Banked Links Capacity Card */}
                    <div className="bg-card border border-border rounded-3xl p-4 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center justify-between text-muted-foreground mb-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Banked Links</span>
                            <Layers className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                            <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                {usedLinks} <span className="text-sm font-semibold text-muted-foreground">/ {linkLimit}</span>
                            </div>
                            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1.5">
                                <div 
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${usagePercent}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Action Navigation Bar */}
                <div className="grid grid-cols-3 gap-2">
                    <Link
                        href="/mobile"
                        onClick={() => triggerHaptic(20)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 active:scale-95 transition-all text-center gap-1.5"
                    >
                        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Plus className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold text-foreground">New Link</span>
                    </Link>

                    <Link
                        href="/mobile/analytics"
                        onClick={() => triggerHaptic(20)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 active:scale-95 transition-all text-center gap-1.5"
                    >
                        <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <BarChart2 className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold text-foreground">Analytics</span>
                    </Link>

                    <Link
                        href="/mobile/plan"
                        onClick={() => triggerHaptic(20)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 active:scale-95 transition-all text-center gap-1.5"
                    >
                        <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Zap className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold text-foreground">Plans</span>
                    </Link>
                </div>

                {/* Links Management Section */}
                <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black tracking-tight text-foreground uppercase">
                            Recent Links ({topLinks.length})
                        </h2>
                        <Link
                            href="/mobile/analytics"
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                            <span>Full Stats</span>
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {topLinks.length === 0 ? (
                        <div className="text-center py-10 px-4 rounded-3xl border border-dashed border-border bg-card/50 space-y-3">
                            <Link2 className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-foreground">No links created yet</h3>
                                <p className="text-xs text-muted-foreground">Shorten your first URL to start tracking real-time traffic.</p>
                            </div>
                            <Link
                                href="/mobile"
                                onClick={() => triggerHaptic(20)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Create Short Link</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {topLinks.map((link, i) => {
                                const isCopied = copiedSlug === link.slug;
                                const destination = link.destinationUrl || link.originalUrl || link.url || "";
                                const shortUrl = buildShortUrl(link.slug);

                                return (
                                    <div 
                                        key={link.slug || i} 
                                        className="bg-card border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-primary/30 transition-all"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-foreground truncate">
                                                    /{link.slug}
                                                </span>
                                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                                                    {link.clicks?.toLocaleString() || 0} clicks
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                {destination || link.title || "No destination URL"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => handleCopy(link.slug, e)}
                                                className="h-8 w-8 rounded-xl border border-border bg-background hover:bg-muted active:scale-95 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                                                aria-label="Copy short link"
                                            >
                                                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                            <a
                                                href={shortUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="h-8 w-8 rounded-xl border border-border bg-background hover:bg-muted active:scale-95 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                                                aria-label="Open short link"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Security & Reliability Footer Note */}
                <div className="pt-4 pb-2 flex items-center justify-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Permanent link bank · Real-time edge routing</span>
                </div>
            </div>

            <MobileBottomNav />
        </div>
    );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
    ensureUserDocument,
    PROFILE_UPDATED_EVENT,
    type ProfileUpdatedDetail,
} from "@/lib/firebase/user-profile";
import { signOut, signInWithGoogle, releasePopupLock } from "@/services/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { History, LogOut, Loader2, ArrowLeft, BarChart3 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

import { HistorySidebar } from "./HistorySidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { isAdminEmail } from "@/lib/admin-config";
import { DeveloperModeToggle } from "@/components/dev/DeveloperModeToggle";

interface TopNavbarProps {
    isCreateDisabled?: boolean;
}

export function TopNavbar({ isCreateDisabled = false }: TopNavbarProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");
    const [hasNewHistory, setHasNewHistory] = useState(false);
    const [hasGuestHistory, setHasGuestHistory] = useState(false);
    const [linkCount, setLinkCount] = useState<number | null>(null);
    const [pulseBadge, setPulseBadge] = useState(false);
    const [plan, setPlan] = useState<string>("free");
    const [quota, setQuota] = useState<{ limit: number, currentActive: number, ttlHours: number | "Unlimited" } | null>(null);
    const [pricingLabelIndex, setPricingLabelIndex] = useState(0);
    const [isPricingHovered, setIsPricingHovered] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const pricingLabels = ["Pricing", "Plans"] as const;
    const isDevEnv = process.env.NODE_ENV === "development";
    const isDeveloper =
        !!user?.email && user.email.toLowerCase() === "gauravpatil9262@gmail.com";

    const syncGuestHistoryState = useCallback(() => {
        const h = localStorage.getItem("xurl_guest_link_history");
        if (!h) {
            setHasGuestHistory(false);
            setLinkCount(0);
            return;
        }

        try {
            const parsed = JSON.parse(h);
            if (parsed.expiresAt > Date.now()) {
                setHasGuestHistory(true);
                setLinkCount(1);
            } else {
                setHasGuestHistory(false);
                setLinkCount(0);
            }
        } catch {
            setHasGuestHistory(false);
            setLinkCount(0);
        }
    }, []);

    const syncUserHistoryState = useCallback(async (currentUser: User) => {
        setHasGuestHistory(false);
        setLinkCount(0);

        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/links?pageSize=25", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();

            const nextLinkCount = Array.isArray(data.links) ? data.links.length : 0;
            const currentActive = (data.freeLinksCreated || 0) + (data.paidLinksCreated || 0);

            setLinkCount(nextLinkCount);
            setPlan(data.plan || "free");

            if (typeof data.limit === "number") {
                setQuota({
                    limit: data.limit,
                    currentActive,
                    ttlHours: data.planTtlHours,
                });
            } else {
                setQuota(null);
            }
        } catch (error) {
            console.error(error);
            setLinkCount(0);
            setPlan("free");
            setQuota(null);
        }
    }, []);

    useEffect(() => {
        const handleLinkGenerated = () => {
            setHasNewHistory(true);
            setPulseBadge(true);
            setTimeout(() => setPulseBadge(false), 200);

            const currentUser = auth.currentUser;
            if (currentUser) {
                void syncUserHistoryState(currentUser);
                return;
            }

            syncGuestHistoryState();
        };

        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (!user) {
            intervalId = setInterval(syncGuestHistoryState, 1000);
        }

        window.addEventListener("linkGenerated", handleLinkGenerated);
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            window.removeEventListener("linkGenerated", handleLinkGenerated);
        };
    }, [syncGuestHistoryState, syncUserHistoryState, user]);

    const resetLoginState = () => {
        setIsLoggingIn(false);
        setShowOverlay(false);
        releasePopupLock();
    };

    const handleGoogleLogin = async () => {
        if (isLoggingIn) return;

        setIsLoggingIn(true);
        setOverlayMessage("Connecting to Google...");
        setShowOverlay(true);

        try {
            const { user: loggedInUser, error } = await signInWithGoogle();
            
            if (error) {
                if (error === "auth/popup-blocked") {
                    setOverlayMessage(
                        <>
                            Popup blocked — click to retry login
                            <br />
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resetLoginState();
                                    setTimeout(() => handleGoogleLogin(), 50);
                                }}
                                className="underline cursor-pointer hover:text-foreground transition-colors mt-2 inline-block"
                            >
                                Open login
                            </span>
                        </>
                    );
                    // Do not auto-close overlay so user can click it
                    return;
                } else {
                    setOverlayMessage("Login cancelled — returning to dashboard...");
                    setTimeout(() => resetLoginState(), 700);
                }
            } else if (loggedInUser) {
                setOverlayMessage("Signing in...");
                setTimeout(() => resetLoginState(), 600);
            } else {
                resetLoginState();
            }
        } catch (e) {
            console.error("Login unexpected error", e);
            resetLoginState();
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            setHasNewHistory(false);
            if (u) {
                void ensureUserDocument(u);
                void syncUserHistoryState(u);
            } else {
                syncGuestHistoryState();
                setPlan("free");
                setQuota(null);
            }
        });
        return () => unsubscribe();
    }, [syncGuestHistoryState, syncUserHistoryState]);

    useEffect(() => {
        const handleProfileUpdated = (event: Event) => {
            const { detail } = event as CustomEvent<ProfileUpdatedDetail>;
            if (!detail?.displayName) {
                return;
            }

            setUser((currentUser) => {
                if (!currentUser) {
                    return currentUser;
                }

                return {
                    ...currentUser,
                    displayName: detail.displayName,
                    email: detail.email ?? currentUser.email,
                    photoURL: detail.photoURL ?? currentUser.photoURL,
                } as User;
            });
        };

        window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener);
        return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener);
    }, []);

    useEffect(() => {
        if (pathname === "/pricing" || isPricingHovered) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setPricingLabelIndex((current) => (current + 1) % pricingLabels.length);
        }, 5000);

        return () => window.clearInterval(intervalId);
    }, [isPricingHovered, pathname, pricingLabels.length]);

    const handleHistoryLinksChange = useCallback((count: number) => {
        setLinkCount(count);
        if (auth.currentUser) {
            setHasGuestHistory(false);
            return;
        }

        setHasGuestHistory(count > 0);
    }, []);

    const getPlanBadgeStyle = (p: string) => {
        switch (p.toLowerCase()) {
            case 'starter': return "bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 border-amber-300/50";
            case 'pro': return "bg-gradient-to-r from-sky-200 to-blue-400 text-blue-900 border-blue-300/50";
            case 'business': return "bg-gradient-to-r from-fuchsia-200 to-pink-400 text-fuchsia-900 border-fuchsia-300/50";
            case 'enterprise': return "bg-gradient-to-r from-emerald-200 to-teal-400 text-emerald-900 border-emerald-300/50";
            case 'bigenterprise': return "bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-slate-700";
            default: return "bg-slate-100 text-slate-600 border-slate-200";
        }
    };

    const navActionBase =
        "inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.98]";
    const primaryAction =
        "bg-slate-900 text-slate-50 shadow-sm hover:bg-slate-800 hover:shadow-md";
    const secondaryAction =
        "border border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900";
    const apiEnabledForPlan = Boolean(PLAN_CONFIGS[resolvePlanType(plan)].apiAccess);
    const canAccessAdmin = isAdminEmail(user?.email);

    return (
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
            <div className="flex flex-1 items-center gap-3">
                <Logo size="md" />
                {user && canAccessAdmin && (
                    <span
                        className="relative inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)] ring-1 ring-emerald-100/80 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_32px_-12px_rgba(16,185,129,0.55)] hover:ring-2 hover:ring-emerald-200/90 hover:bg-gradient-to-r hover:from-emerald-50 hover:via-emerald-100/70 hover:to-white"
                    >
                        <span className="relative h-2.5 w-2.5 flex items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.25)]" />
                        </span>
                        Admin
                    </span>
                )}
                {plan && plan !== "free" && (
                    <div className="relative group flex items-center">
                        <Link href={`/pricing?plan=${plan}`} className={`hidden sm:flex items-center px-2 py-0.5 rounded border shadow-sm text-[10px] font-bold tracking-widest uppercase transition-all duration-300 hover:brightness-105 hover:scale-105 cursor-pointer ${getPlanBadgeStyle(plan)}`}>
                            {plan}
                        </Link>

                        {/* Hover Tooltip Card */}
                        {quota && (
                            <div className="absolute top-full left-0 mt-3.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] translate-y-2 group-hover:translate-y-0">
                                <div className="bg-white border border-slate-200/60 shadow-xl rounded-xl p-3.5 w-[220px] text-xs font-medium relative top-1">
                                    {/* Triangle pointer */}
                                    <div className="absolute -top-1.5 left-5 w-3 h-3 bg-white border-l border-t border-slate-200/60 transform rotate-45"></div>

                                    <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-2 mb-2 relative z-10 bg-white">
                                        <span className="font-bold text-[13px] capitalize tracking-tight">{plan} Plan</span>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${quota.ttlHours === "Unlimited" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"}`}>
                                            {quota.ttlHours === "Unlimited" ? "No Expiry" : (quota.ttlHours < 1 ? `${Math.round(quota.ttlHours * 60)}m TTL` : `${quota.ttlHours}h TTL`)}
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 relative z-10 bg-white">
                                        <div className="flex justify-between items-center px-0.5">
                                            <span className="text-slate-500 font-medium">Links Used</span>
                                            <span className={`font-bold tabular-nums ${quota.currentActive >= quota.limit ? 'text-red-500' : 'text-slate-900'}`}>{quota.currentActive} <span className="text-slate-400 font-medium">/ {quota.limit}</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${quota.currentActive >= quota.limit ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min((quota.currentActive / quota.limit) * 100, 100)}%` }}
                                            />
                                        </div>
                                        {quota.currentActive >= quota.limit && (
                                            <p className="text-[10px] text-red-500/90 leading-tight pt-0.5 font-medium tracking-tight">Limit reached. Upgrade to create more.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-1 items-center justify-center">
                {isDevEnv && isDeveloper && (
                    <DeveloperModeToggle visible={true} />
                )}
            </div>

            <div className="flex flex-1 items-center justify-end gap-2 sm:gap-2.5">
                <div className="hidden sm:flex items-center gap-2">
                    {pathname !== "/pricing" ? (
                        <Link
                            href="/pricing"
                            className={cn(
                                navActionBase,
                                secondaryAction
                            )}
                            onMouseEnter={() => setIsPricingHovered(true)}
                            onMouseLeave={() => setIsPricingHovered(false)}
                        >
                            <span className="relative inline-flex h-5 w-[44px] items-center justify-center overflow-hidden">
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.span
                                        key={pricingLabels[pricingLabelIndex]}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                        className="absolute inset-0 inline-flex items-center justify-center"
                                    >
                                        {pricingLabels[pricingLabelIndex]}
                                    </motion.span>
                                </AnimatePresence>
                            </span>
                        </Link>
                    ) : (
                        <Link
                            href="/"
                            className={cn(
                                navActionBase,
                                "gap-1.5 border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to shortener
                        </Link>
                    )}
                    {user && (
                        <Link
                            href="/analytics"
                            className={cn(
                                navActionBase,
                                secondaryAction,
                                "gap-1.5"
                            )}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Analytics
                        </Link>
                    )}
                    {user && apiEnabledForPlan && (
                        <Link
                            href="/dashboard/api"
                            className={cn(
                                navActionBase,
                                secondaryAction,
                                "gap-1.5"
                            )}
                        >
                            API
                        </Link>
                    )}
                    {user && canAccessAdmin && (
                        <Link
                            href="/admin/promo-codes"
                            className={cn(
                                navActionBase,
                                secondaryAction,
                                "gap-1.5"
                            )}
                        >
                            Admin
                        </Link>
                    )}
                    <button
                        onClick={() => {
                            if (pathname !== "/") {
                                router.push("/?focus=true");
                            } else {
                                window.dispatchEvent(new Event("focusUrlInput"));
                            }
                        }}
                        disabled={isCreateDisabled}
                        className={cn(
                            navActionBase,
                            secondaryAction,
                            "min-w-[118px] px-4 whitespace-nowrap shrink-0", // keep width consistent across auth states
                            isCreateDisabled && "cursor-not-allowed opacity-50"
                        )}
                    >
                        Create link
                    </button>
                </div>
                {loading ? (
                    <>
                        <Skeleton className="hidden h-8 w-[88px] rounded-md bg-slate-100 sm:block" />
                        <Skeleton className="h-8 w-8 rounded-full bg-slate-100" />
                    </>
                ) : (
                    user ? (
                        <>
                                {/* Desktop History Button */}
                                <button
                                    onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                    className={cn(
                                        navActionBase,
                                        secondaryAction,
                                        "hidden sm:flex relative"
                                    )}
                                >
                                    History
                                    <AnimatePresence>
                                        {linkCount !== null && linkCount > 0 && (
                                            <motion.div
                                                key={linkCount}
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: pulseBadge ? 1.2 : 1, opacity: 1 }}
                                                transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 15 }}
                                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-background shadow-sm"
                                            >
                                                {linkCount > 99 ? '99+' : linkCount}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {hasNewHistory && (
                                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="relative h-8 w-8 rounded-full overflow-hidden border border-slate-200 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-all">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs">
                                                    {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                            )}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 mt-1.5" sideOffset={4}>
                                        <div className="flex items-center justify-start gap-2 p-2">
                                            <div className="flex flex-col space-y-0.5 leading-none">
                                                {user.displayName && <p className="font-medium text-[13px]">{user.displayName}</p>}
                                                <p className="w-[200px] truncate text-xs text-muted-foreground">{user.email}</p>
                                            </div>
                                        </div>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <Link href="/profile" className="w-full cursor-pointer text-[13px]">
                                                <span className="flex-1">Profile</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/dashboard/api" className="w-full cursor-pointer text-[13px]">
                                                <span className="flex-1">API Keys</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/purchase-history" className="w-full cursor-pointer text-[13px]">
                                                <span className="flex-1">Billing</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        {canAccessAdmin && (
                                            <DropdownMenuItem asChild>
                                                <Link href="/admin/promo-codes" className="w-full cursor-pointer text-[13px]">
                                                    <span className="flex-1">Admin</span>
                                                </Link>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem className="sm:hidden text-[13px]" onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}>
                                            <span className="flex-1">Link History</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer text-[13px]"
                                            onClick={async () => {
                                                await signOut();
                                                router.push("/");
                                            }}
                                        >
                                            <LogOut className="mr-2 h-3.5 w-3.5" />
                                            <span>Sign out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                        </>
                    ) : (
                        <>
                            {hasGuestHistory && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                    className={`relative text-[13px] font-medium h-8 px-2.5 rounded-md border transition-all ${linkCount !== null && linkCount > 0 ? "border-emerald-200/80 shadow-sm text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 hover:border-emerald-300" : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 hover:border-slate-200"
                                        } transition-transform duration-150`}
                                >
                                    <History className="h-3.5 w-3.5 mr-1.5" />
                                    History
                                    <AnimatePresence>
                                        {linkCount !== null && linkCount > 0 && (
                                            <motion.div
                                                key={linkCount}
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: pulseBadge ? 1.2 : 1, opacity: 1 }}
                                                transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 15 }}
                                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-background shadow-sm"
                                            >
                                                {linkCount > 99 ? '99+' : linkCount}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {hasNewHistory && (
                                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleGoogleLogin}
                                disabled={isLoggingIn}
                                className={cn(
                                    navActionBase,
                                    primaryAction,
                                    "min-w-[96px] px-4 disabled:opacity-80 disabled:hover:shadow-sm"
                                )}
                            >
                                {isLoggingIn ? "Connecting..." : "Login"}
                            </Button>
                        </>
                    )
                )}
            </div>
            <HistorySidebar
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                userId={user?.uid || ""}
                onLinksChange={handleHistoryLinksChange}
            />

            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-md"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground tracking-tight text-center">
                                {overlayMessage}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}

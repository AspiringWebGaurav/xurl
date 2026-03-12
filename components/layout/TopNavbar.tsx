"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { signOut, signInWithGoogle, releasePopupLock } from "@/services/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { History, LogOut, Loader2, Plus, ArrowLeft } from "lucide-react";
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
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const checkGuestHistory = () => {
            const h = localStorage.getItem("xurl_guest_link_history");
            if (h) {
                try {
                    const parsed = JSON.parse(h);
                    if (parsed.expiresAt > Date.now()) {
                        setHasGuestHistory(true);
                        setLinkCount(prev => prev === null ? 1 : prev);
                    } else {
                        setHasGuestHistory(false);
                        setLinkCount(prev => prev === null ? 0 : prev);
                    }
                } catch {
                    setHasGuestHistory(false);
                    setLinkCount(prev => prev === null ? 0 : prev);
                }
            } else {
                setHasGuestHistory(false);
                setLinkCount(prev => prev === null ? 0 : prev);
            }
        };

        checkGuestHistory(); // Initial check

        const intervalId = setInterval(checkGuestHistory, 1000); // Check every second for expiration

        const handleLinkGenerated = () => {
            setHasNewHistory(true);
            checkGuestHistory(); // Recheck when a link is generated
            setLinkCount(prev => prev !== null ? prev + 1 : 1);
            setPulseBadge(true);
            setTimeout(() => setPulseBadge(false), 200);
        };

        window.addEventListener("linkGenerated", handleLinkGenerated);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener("linkGenerated", handleLinkGenerated);
        };
    }, []);

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
            if (u) {
                u.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(d => {
                            if (d.linksCreated !== undefined) {
                                setLinkCount(d.linksCreated);
                            }
                            if (d.plan) {
                                setPlan(d.plan);
                            }
                            if (d.limit) {
                                setQuota({ limit: d.limit, currentActive: d.linksCreated || 0, ttlHours: d.planTtlHours });
                            }
                        })
                        .catch(console.error);
                });
            } else {
                // If not logged in, we rely on the localStorage check to set linkCount for guest
                const h = localStorage.getItem("xurl_guest_link_history");
                setLinkCount(h ? 1 : 0);
                setPlan("free");
                setQuota(null);
            }
        });
        return () => unsubscribe();
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

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
            <div className="flex items-center gap-3">
                <Logo size="md" />
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

            <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center gap-3">
                    {pathname !== "/pricing" ? (
                        <Link
                            href="/pricing"
                            className="text-[13px] font-medium transition-colors flex items-center gap-1.5 h-8 px-3 rounded-md border border-primary/20 bg-primary/5 text-primary shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:bg-primary/10 hover:border-primary/30"
                        >
                            Pricing
                        </Link>
                    ) : (
                        <Link
                            href="/"
                            className="text-[13px] font-medium transition-colors flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to shortener
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
                        className={`text-[13px] font-medium transition-colors flex items-center gap-1.5 ${isCreateDisabled ? "text-slate-400/50 cursor-not-allowed" : "text-slate-600 hover:text-slate-900"}`}
                    >
                        Create link
                    </button>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-200 mx-1" />
                {!loading && (
                    user ? (
                        <>
                                {/* Desktop History Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                    className={`hidden sm:flex relative text-[13px] font-medium h-8 px-2.5 rounded-md border transition-all ${linkCount !== null && linkCount > 0 ? "border-emerald-200/80 shadow-sm text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 hover:border-emerald-300" : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 hover:border-slate-200"
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

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="relative h-8 w-8 rounded-full overflow-hidden border border-slate-200 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-all">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-xs">
                                                    {user.email?.charAt(0).toUpperCase() || 'U'}
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
                                            <Link href="/purchase-history" className="w-full cursor-pointer text-[13px]">
                                                <span className="flex-1">Purchase History</span>
                                            </Link>
                                        </DropdownMenuItem>
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
                                className="h-8 px-3.5 rounded-md text-[13px] font-medium shadow-sm bg-slate-900 text-slate-50 hover:bg-slate-800 disabled:opacity-80 transition-colors"
                            >
                                {isLoggingIn ? "Connecting..." : "Login"}
                            </Button>
                        </>
                    )
                )}
            </div>
            <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} userId={user?.uid || ""} />

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

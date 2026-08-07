"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { Sparkles, Percent, Gift, ClipboardList, ListChecks, Loader2, ShieldCheck, Link as LinkIcon, ShieldAlert, Ban, Settings, Tag, Power, Lock } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { cn } from "@/lib/utils";
import { getOrCreateGuestSessionId } from "@/lib/utils/fingerprint";
import { useRef } from "react";

import { motion } from "framer-motion";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: Sparkles },
    { href: "/admin/plans", label: "Plan Configuration", icon: Settings },
    { href: "/admin/offers", label: "Global Offers", icon: Tag },
    { href: "/admin/partial-offers", label: "Partial Offers", icon: Percent },
    { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag },
    { href: "/admin/grant-plan", label: "Grant Plan", icon: Gift },
    { href: "/admin/bans", label: "Bans & Appeals", icon: ShieldCheck },
    { href: "/admin/system-bans", label: "System Bans", icon: ShieldAlert },
    { href: "/admin/links", label: "Link Management", icon: LinkIcon },
    { href: "/admin/purchase-history", label: "Purchase History", icon: ClipboardList },
    { href: "/admin/logs", label: "Admin Logs", icon: ListChecks },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [strikeWarning, setStrikeWarning] = useState<string | null>(null);
    const [isBanned, setIsBanned] = useState(false);

    // ── Screen Width Check for Desktop-Only Admin Control ──
    const [isDesktop, setIsDesktop] = useState(true);
    useEffect(() => {
        const checkScreen = () => setIsDesktop(window.innerWidth >= 1024);
        checkScreen();
        window.addEventListener("resize", checkScreen);
        return () => window.removeEventListener("resize", checkScreen);
    }, []);

    // ── Emergency Kill Switch 3-Second Hold Logic ──
    const [killSwitchActive, setKillSwitchActive] = useState(false);
    const [togglingKillSwitch, setTogglingKillSwitch] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const holdProgressRef = useRef(0);

    const toggleKillSwitch = async () => {
        if (togglingKillSwitch || !auth.currentUser) return;
        setTogglingKillSwitch(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const nextActive = !killSwitchActive;
            const res = await fetch("/api/admin/kill-switch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    active: nextActive,
                    reason: nextActive ? "Emergency outage activated by admin" : "Normal system operations restored"
                })
            });

            if (res.ok) {
                const data = await res.json();
                setKillSwitchActive(data.state.active);
                window.dispatchEvent(new Event("systemKillSwitchUpdated"));
            }
        } catch (err) {
            console.error("Error toggling kill switch:", err);
        } finally {
            setTogglingKillSwitch(false);
        }
    };

    const startHold = () => {
        if (togglingKillSwitch) return;
        setIsHolding(true);
        holdProgressRef.current = 0;
        setHoldProgress(0);

        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

        holdIntervalRef.current = setInterval(() => {
            holdProgressRef.current += 100 / 30; // 30 ticks = 3000ms
            if (holdProgressRef.current >= 100) {
                setHoldProgress(100);
                clearInterval(holdIntervalRef.current!);
                holdIntervalRef.current = null;
                setIsHolding(false);
                toggleKillSwitch();
            } else {
                setHoldProgress(holdProgressRef.current);
            }
        }, 100);
    };

    const stopHold = () => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
        setIsHolding(false);
        setHoldProgress(0);
        holdProgressRef.current = 0;
    };

    const isAdmin = isAdminEmail(user?.email);

    useEffect(() => {
        let mounted = true;
        if (!isAdmin && !loading) {
            const logStrike = async () => {
                try {
                    let headers: Record<string, string> = {
                        "Content-Type": "application/json"
                    };
                    if (user) {
                        const token = await user.getIdToken();
                        headers["Authorization"] = `Bearer ${token}`;
                    }

                    const res = await fetch("/api/admin/system-bans", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            action: "record_strike",
                            email: user?.email || undefined,
                            guestId: getOrCreateGuestSessionId(),
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (mounted) {
                            if (data.isBanned) {
                                setIsBanned(true);
                            } else if (data.message) {
                                setStrikeWarning(data.message);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to log security strike:", e);
                }
            };
            logStrike();
        }
        return () => { mounted = false; };
    }, [isAdmin, loading, user]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                await ensureUserDocument(u);
                setUser(u);
                if (isAdminEmail(u.email)) {
                    const token = await u.getIdToken();
                    fetch("/api/admin/kill-switch", {
                        headers: { "Authorization": `Bearer ${token}` }
                    }).then(r => r.json()).then(d => setKillSwitchActive(Boolean(d.state?.active))).catch(() => {});
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // 🔒 Glassmorphic Mobile/Tablet Lock Screen for Admin Panel
    if (!isDesktop) {
        return (
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 p-6 overflow-hidden select-none text-white">
                {/* Ambient Glowing Background Aura */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
                <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 max-w-md w-full rounded-3xl border border-white/15 bg-slate-900/80 p-8 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-center space-y-6">
                    {/* Header Icon */}
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-inner">
                        <Lock className="h-8 w-8 text-indigo-400" />
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/20">
                            <span>Admin Operational Policy</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Admin Panel is Desktop Only
                        </h2>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                        This command center was specifically engineered to be operated on desktop by <strong>Gaurav</strong>. Please switch to a desktop workstation or expand your screen to access administrative controls.
                    </p>

                    <div className="pt-2 border-t border-white/10 flex flex-col items-center gap-3">
                        <a
                            href="/"
                            className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 border border-white/10"
                        >
                            Return to Public Application
                        </a>
                        <span className="text-[11px] font-mono text-slate-500">
                            MINIMUM REQUIRED SCREEN WIDTH: 1024px
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    const title = useMemo(() => {
        return NAV_ITEMS.find((item) => item.href === pathname)?.label || "Admin Console";
    }, [pathname]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
                <div className="fixed inset-x-0 top-0 z-50">
                    <TopNavbar />
                </div>
                <div className="flex min-h-screen items-center justify-center pt-14">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            </div>
        );
    }

    if (!user || !isAdmin) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
                <div className="fixed inset-x-0 top-0 z-50">
                    <TopNavbar />
                </div>
                <main className="flex min-h-screen items-center justify-center px-6 pt-14">
                    <div className={cn("w-full max-w-2xl rounded-[32px] border bg-white/85 p-10 text-center shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-colors", strikeWarning ? "border-amber-400 shadow-amber-500/20" : "border-white/70")}>
                        <div className={cn("mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg", strikeWarning ? "bg-amber-500 shadow-amber-500/30" : "bg-slate-900 shadow-slate-900/20")}>
                            {strikeWarning ? <ShieldAlert className="h-9 w-9" /> : <ShieldCheck className="h-9 w-9" />}
                        </div>
                        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">
                            {strikeWarning ? "Access Violation Warning" : "Admin access required"}
                        </h1>
                        <p className={cn("mx-auto mt-4 max-w-xl text-base font-medium", strikeWarning ? "text-amber-700" : "text-slate-600")}>
                            {strikeWarning || "This workspace is reserved for configured XURL administrators. Sign in with an authorized admin email to access promo tools, grants, and billing controls."}
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                                Go to homepage
                            </Link>
                            <Link href="/login" className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
                                Sign in with admin email
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div id="admin-root" className="min-h-screen bg-[#f5f7fb] text-slate-900">
            <div className="fixed inset-x-0 top-0 z-50">
                <TopNavbar />
            </div>

            <div className="pt-14">
                <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-56px)] w-96 border-r border-slate-200/80 bg-white/90 backdrop-blur-xl lg:block">
                    <div className="flex h-full flex-col px-5 py-6">
                        <div className="shrink-0 rounded-[24px] border border-slate-200/80 bg-white/95 p-4.5 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Admin Console</p>
                            </div>
                            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">Operate XURL</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600 font-medium">Manage promotions, grants, and billing from one calm workspace.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto my-4 pr-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <nav className="flex flex-col gap-1.5 relative">
                                {NAV_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    const active = pathname === item.href;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 z-10",
                                                active
                                                    ? "text-indigo-950 font-bold"
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {active && (
                                                <motion.div
                                                    layoutId="admin-nav-pill"
                                                    className="absolute inset-0 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 shadow-sm -z-10"
                                                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                                />
                                            )}
                                            <span className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 shrink-0 group-hover:scale-105",
                                                active 
                                                    ? "border-indigo-300 bg-white text-indigo-600 shadow-sm" 
                                                    : "border-slate-200/80 bg-slate-50/80 text-slate-500 group-hover:bg-white group-hover:border-slate-300 group-hover:text-slate-900"
                                            )}
                                            >
                                                <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                            </span>
                                            <span className="tracking-tight">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="mt-auto shrink-0 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Signed in</p>
                                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{user.email}</p>
                                    <p className="mt-0.5 text-xs font-medium text-emerald-600 flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                        Admin access verified
                                    </p>
                                </div>

                                {/* 3-Second Press-and-Hold Emergency Kill Switch Power Button */}
                                <div className="shrink-0 flex flex-col items-center">
                                    <button
                                        type="button"
                                        title={killSwitchActive ? "Press & hold 3s to DISENGAGE Kill Switch" : "Press & hold 3s to ENGAGE Global Emergency Kill Switch"}
                                        onMouseDown={startHold}
                                        onMouseUp={stopHold}
                                        onMouseLeave={stopHold}
                                        onTouchStart={startHold}
                                        onTouchEnd={stopHold}
                                        className={cn(
                                            "relative flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200 select-none shadow-xs active:scale-95",
                                            killSwitchActive
                                                ? "border-rose-400 bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.5)] animate-pulse"
                                                : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600"
                                        )}
                                    >
                                        {/* Circular SVG Ring Fill for 3s Progress */}
                                        <svg className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none" viewBox="0 0 44 44">
                                            <circle
                                                cx="22"
                                                cy="22"
                                                r="19"
                                                className="stroke-slate-200/40 fill-none"
                                                strokeWidth="3.5"
                                            />
                                            <circle
                                                cx="22"
                                                cy="22"
                                                r="19"
                                                className={cn("fill-none transition-all duration-75", killSwitchActive ? "stroke-white" : "stroke-rose-600")}
                                                strokeWidth="3.5"
                                                strokeDasharray="119.38"
                                                strokeDashoffset={119.38 - (119.38 * holdProgress) / 100}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        {togglingKillSwitch ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Power className="h-5 w-5 relative z-10" />
                                        )}
                                    </button>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">
                                        {isHolding ? `${Math.ceil((3000 - (holdProgress * 30)) / 1000)}s Hold` : killSwitchActive ? "ENGAGED" : "KILL SW"}
                                    </span>
                                </div>
                            </div>

                            {killSwitchActive && (
                                <div className="mt-2.5 pt-2 border-t border-rose-200 bg-rose-50/80 -mx-4 -mb-4 px-4 py-2 flex items-center justify-between text-[10px] font-black text-rose-700">
                                    <span className="flex items-center gap-1">
                                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600 animate-bounce" />
                                        EMERGENCY OUTAGE ACTIVE
                                    </span>
                                    <span className="underline">Hold 3s to turn OFF</span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="lg:pl-96">
                    <div className="sticky top-14 z-30 border-b border-slate-200/80 bg-[#f5f7fb]/95 px-4 py-4 backdrop-blur-xl lg:hidden">
                        <div className="flex flex-col gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Admin</p>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {NAV_ITEMS.map((item) => {
                                    const active = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-all active:scale-95",
                                                active
                                                    ? "border-indigo-300 bg-indigo-50 text-indigo-900 font-bold shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="h-[calc(100vh-56px)] overflow-y-auto">
                        <div className="mx-auto w-full px-4 py-6 lg:px-8 lg:py-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

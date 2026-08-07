"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Send, CheckCircle2, Loader2, Lock, ArrowRight, Activity, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Logo } from "@/components/ui/Logo";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { isAdminEmail } from "@/lib/admin-config";

interface KillSwitchState {
    active: boolean;
    reason?: string;
    activatedAt?: number;
}

type SequenceStage = "IDLE" | "ACTIVATE_COUNTDOWN" | "ENGAGED" | "RESTORE_COUNTDOWN" | "RESTORE_LOADER";

export function KillSwitchGuard({
    children,
    initialKillSwitchActive = false,
}: {
    children: React.ReactNode;
    initialKillSwitchActive?: boolean;
}) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [killSwitch, setKillSwitch] = useState<KillSwitchState>({ active: initialKillSwitchActive });
    
    // Dramatic Sequence State Machine
    const [sequenceStage, setSequenceStage] = useState<SequenceStage>(
        initialKillSwitchActive ? "ENGAGED" : "IDLE"
    );
    const [countdownVal, setCountdownVal] = useState<number>(3);
    const prevActiveRef = useRef<boolean>(initialKillSwitchActive);
    const isFirstRun = useRef<boolean>(true);

    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);

        const unsub = onAuthStateChanged(auth, (u) => setUser(u));

        const checkKillSwitch = async () => {
            try {
                const res = await fetch("/api/public/kill-switch", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setKillSwitch(data);
                }
            } catch (err) {
                console.error("Kill switch fetch error:", err);
            }
        };

        checkKillSwitch();
        const interval = setInterval(checkKillSwitch, 4000);

        const handleUpdate = () => checkKillSwitch();
        window.addEventListener("systemKillSwitchUpdated", handleUpdate);

        return () => {
            unsub();
            clearInterval(interval);
            window.removeEventListener("systemKillSwitchUpdated", handleUpdate);
        };
    }, []);

    // ── Handle Live State Transitions ──
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const wasActive = prevActiveRef.current;
        const isNowActive = killSwitch.active;
        prevActiveRef.current = isNowActive;

        if (!wasActive && isNowActive) {
            // 🚨 LIVE ACTIVATION SEQUENCE
            toast.error("🚨 Incident has occurred. Admin activated Emergency Mode.", {
                duration: 6000,
                position: "top-center",
            });

            setSequenceStage("ACTIVATE_COUNTDOWN");
            setCountdownVal(3);

            const t1 = setTimeout(() => setCountdownVal(2), 1000);
            const t2 = setTimeout(() => setCountdownVal(1), 2000);
            const t3 = setTimeout(() => setSequenceStage("ENGAGED"), 3000);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        } else if (wasActive && !isNowActive) {
            // 🟢 LIVE RESTORATION SEQUENCE
            setSequenceStage("RESTORE_COUNTDOWN");
            setCountdownVal(3);

            const t1 = setTimeout(() => setCountdownVal(2), 1000);
            const t2 = setTimeout(() => setCountdownVal(1), 2000);
            const t3 = setTimeout(() => setSequenceStage("RESTORE_LOADER"), 3000);
            const t4 = setTimeout(() => setSequenceStage("IDLE"), 4500); // 3s countdown + 1.5s loader

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
                clearTimeout(t4);
            };
        }
    }, [killSwitch.active]);

    const isAdminUser = Boolean(user?.email && isAdminEmail(user.email));
    const isAdminRoute = pathname?.startsWith("/admin");
    const isLoginRoute = pathname?.startsWith("/login");
    const isShortLinkRoute = pathname && pathname !== "/" && !pathname.includes("/") && pathname.length <= 30; // slug check

    // Admin or exempt routes always pass through with banner if active
    if (isAdminUser || isAdminRoute) {
        return (
            <>
                {killSwitch.active && (
                    <div className="fixed top-0 left-0 right-0 z-[10000] bg-rose-600 text-white px-4 py-2 text-center shadow-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 animate-pulse">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>EMERGENCY KILL SWITCH ACTIVE (ADMIN BYPASS ENGAGED) — PUBLIC APP IS LOCKED IN MAINTENANCE MODE</span>
                    </div>
                )}
                {children}
            </>
        );
    }

    if (isLoginRoute || isShortLinkRoute || pathname?.startsWith("/r")) {
        return <>{children}</>;
    }

    // ── STAGE 1: Live Activation 3-2-1 Countdown ──
    if (sequenceStage === "ACTIVATE_COUNTDOWN") {
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 text-white p-6 overflow-hidden select-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-900/30 via-slate-950 to-slate-950 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-5 py-2 text-xs font-black uppercase tracking-widest text-rose-400 border border-rose-500/40 shadow-lg animate-pulse">
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                        Incident Triggered • Emergency Mode
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={countdownVal}
                            initial={{ scale: 0.3, opacity: 0, y: 40 }}
                            animate={{ scale: [0.3, 1.25, 1], opacity: 1, y: 0 }}
                            exit={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className="relative flex items-center justify-center"
                        >
                            <div className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border-4 border-rose-500/40 animate-ping pointer-events-none" />
                            <span className="text-8xl sm:text-9xl font-black text-white tracking-tight drop-shadow-[0_0_60px_rgba(244,63,94,0.9)]">
                                {countdownVal}
                            </span>
                        </motion.div>
                    </AnimatePresence>

                    <div className="space-y-2 max-w-md">
                        <h2 className="text-xl sm:text-2xl font-black text-rose-100 tracking-tight">
                            Pausing All XURL Operations
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-400">
                            Securing databases and shifting system into Emergency Control Mode...
                        </p>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // ── STAGE 2: Live Restoration 3-2-1 Countdown ──
    if (sequenceStage === "RESTORE_COUNTDOWN") {
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 text-white p-6 overflow-hidden select-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-slate-950 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-8">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2 text-xs font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/40 shadow-lg animate-pulse">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Admin Restored System Normalcy
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={countdownVal}
                            initial={{ scale: 0.3, opacity: 0, y: 40 }}
                            animate={{ scale: [0.3, 1.25, 1], opacity: 1, y: 0 }}
                            exit={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className="relative flex items-center justify-center"
                        >
                            <div className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border-4 border-emerald-500/40 animate-ping pointer-events-none" />
                            <span className="text-8xl sm:text-9xl font-black text-emerald-400 tracking-tight drop-shadow-[0_0_60px_rgba(16,185,129,0.9)]">
                                {countdownVal}
                            </span>
                        </motion.div>
                    </AnimatePresence>

                    <div className="space-y-2 max-w-md">
                        <h2 className="text-xl sm:text-2xl font-black text-emerald-100 tracking-tight">
                            Restoring XURL Back To Normal
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-400">
                            Re-enabling API gateways, shortener logic, and billing controls...
                        </p>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // ── STAGE 3: Restoration 1.5s XURL Brand Pre-Loader ──
    if (sequenceStage === "RESTORE_LOADER") {
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 text-white p-6 overflow-hidden select-none">
                {/* Ambient Glowing Background Aura */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-indigo-500/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.04, y: -10 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="relative z-10 flex flex-col items-center justify-center space-y-7 text-center max-w-sm"
                >
                    {/* Glowing Logo Icon Container */}
                    <div className="relative group">
                        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 opacity-65 blur-lg group-hover:opacity-100 transition duration-500 animate-pulse" />
                        <div className="relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900/90 border border-white/20 backdrop-blur-2xl shadow-[0_20px_50px_rgba(16,185,129,0.3)]">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-xl shadow-md">
                                X
                            </div>
                            <span className="text-2xl font-black tracking-[0.2em] text-white uppercase drop-shadow">
                                URL
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-64 sm:w-80 space-y-2.5">
                        <div className="h-2 w-full bg-slate-900 rounded-full border border-emerald-500/30 overflow-hidden p-0.5 relative shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5, ease: "easeInOut" }}
                                className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                            />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 px-1">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                Restoring Services
                            </span>
                            <span className="text-slate-300">100%</span>
                        </div>
                    </div>

                    {/* Subhead Status */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-4 py-1.5 text-xs font-bold text-emerald-300 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>System Operations Restored • Welcome Back</span>
                    </div>
                </motion.div>
            </div>,
            document.body
        );
    }

    // If Kill Switch is OFF and sequence is IDLE, render children
    if (!killSwitch.active && sequenceStage === "IDLE") {
        return <>{children}</>;
    }

    // ── STAGE 4: ENGAGED Full Screen Edge-to-Edge Kill Switch Outage UI ──
    const handleAppealSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (!email.includes("@")) {
            setError("Please enter a valid email address.");
            return;
        }
        if (message.length < 5) {
            setError("Please detail your urgent inquiry or appeal.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/public/appeals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, message }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSubmitted(true);
            } else {
                setError(data.message || "Failed to submit appeal");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const overlayContent = (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="fixed inset-0 z-[99999] flex flex-col lg:flex-row bg-slate-950 overflow-y-auto lg:overflow-hidden text-white"
            >
                {/* Ambient Red Alert Light Orbs */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
                <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[140px] pointer-events-none" />

                {/* Left Column: Full Viewport Emergency Incident Briefing */}
                <div className="flex-1 flex flex-col justify-between px-6 py-10 lg:px-16 xl:px-24 bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950 relative z-10">
                    <div className="max-w-2xl my-auto space-y-6">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-rose-400 border border-rose-500/30 shadow-sm">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>
                                Emergency Maintenance Mode
                            </div>

                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 shadow-sm">
                                <Activity className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                                <span>STATUS: KILL SWITCH ENGAGED</span>
                            </div>
                        </div>

                        {/* Main Title */}
                        <div className="space-y-4">
                            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.08] drop-shadow-md">
                                Looks like App has been down
                            </h1>
                            <p className="text-base sm:text-xl font-medium text-slate-300 leading-relaxed max-w-xl">
                                Don’t worry, our engineering team is actively investigating the situation and taking full control to ensure complete system safety and stability.
                            </p>
                        </div>

                        {/* Security Protocol Info Box */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-2.5 max-w-xl">
                            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase tracking-wider">
                                <ShieldAlert className="h-4 w-4 shrink-0" />
                                System Security Hold Active
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                All shortener operations, billing checkouts, and account controls have been temporarily locked by an administrator. Existing short links remain active and operational.
                            </p>
                        </div>
                    </div>

                    {/* Bottom Footer Admin Link */}
                    <div className="pt-6 border-t border-white/10 flex items-center justify-between text-xs font-medium text-slate-400">
                        <span>XURL Security Protocol v2.4</span>
                        <a
                            href="/login?redirect=/admin"
                            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                        >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Admin Portal Access</span>
                            <ArrowRight className="h-3 w-3" />
                        </a>
                    </div>
                </div>

                {/* Right Column: Full Height Direct Appeal Drawer */}
                <div className="w-full lg:w-[480px] xl:w-[560px] bg-black/60 backdrop-blur-3xl border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col justify-center px-6 py-10 lg:px-12 relative z-20">
                    <div className="max-w-md w-full mx-auto space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Submit Direct Appeal
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                Have an urgent business query or appeal? Submit your message directly to our engineering team for immediate review.
                            </p>
                        </div>

                        {submitted ? (
                            <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-inner">
                                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-black">Emergency Appeal Received</p>
                                    <p className="text-xs font-medium text-emerald-200/90 leading-relaxed">
                                        Your message has been submitted directly to administrative logs. Our team will review your email shortly.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAppealSubmit} className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                                        Your Email Address
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-black/50 border-white/15 text-white placeholder:text-slate-600 rounded-xl h-12 text-sm font-semibold focus:border-rose-400 focus:ring-rose-400"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                                        Urgent Inquiry / Direct Details
                                    </label>
                                    <textarea
                                        placeholder="Explain your urgent request or system query..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="w-full bg-black/50 border border-white/15 text-white placeholder:text-slate-600 rounded-xl p-4 text-sm font-medium min-h-[140px] focus:outline-none focus:border-rose-400 focus:ring-rose-400 resize-none shadow-inner"
                                        required
                                    />
                                </div>

                                {error && (
                                    <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span>{error}</span>
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all shadow-lg hover:shadow-rose-600/30 active:scale-98"
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Send className="h-4 w-4 mr-2" />
                                    )}
                                    Submit Direct Emergency Appeal
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );

    if (!mounted) {
        return overlayContent;
    }

    return createPortal(overlayContent, document.body);
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Crown, Sparkles, Check, Lock, Terminal } from "lucide-react";
import Image from "next/image";
import { triggerHaptic } from "@/lib/haptics";

export type AuthTransitionType = "admin_login" | "user_login" | "logout" | null;

export interface AuthTransitionState {
    type: AuthTransitionType;
    userName?: string;
    userEmail?: string;
    photoURL?: string | null;
    statusText?: string;
}

interface AuthTransitionOverlayProps {
    transition: AuthTransitionState;
    onAnimationComplete?: () => void;
}

// Synthesize pleasant sound effects using the Web Audio API without external audio assets
function playAudioChime(type: "admin_login" | "user_login" | "logout") {
    if (typeof window === "undefined") return;
    try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;

        if (type === "admin_login") {
            // High-tech sci-fi authorization chord
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const osc3 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = "sine";
            osc2.type = "triangle";
            osc3.type = "sine";

            // Arpeggiated high-tech chord: C5 -> E5 -> G5 -> C6
            osc1.frequency.setValueAtTime(523.25, now);
            osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
            osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.28);

            osc2.frequency.setValueAtTime(261.63, now);
            osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.2);

            osc3.frequency.setValueAtTime(1318.51, now + 0.15); // E6 sparkle

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

            osc1.connect(gain);
            osc2.connect(gain);
            osc3.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc3.start(now + 0.15);

            osc1.stop(now + 0.9);
            osc2.stop(now + 0.9);
            osc3.stop(now + 0.9);
        } else if (type === "user_login") {
            // Soft, delightful dual-tone chime
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";

            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.1); // A5

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.55);
        } else if (type === "logout") {
            // Gentle descending tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";

            osc.frequency.setValueAtTime(659.25, now); // E5
            osc.frequency.exponentialRampToValueAtTime(392.0, now + 0.22); // G4

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.45);
        }
    } catch {
        // Audio policy or unsupported browser
    }
}

export function AuthTransitionOverlay({ transition, onAnimationComplete }: AuthTransitionOverlayProps) {
    const { type, userName, userEmail, photoURL, statusText } = transition;
    const [progress, setProgress] = useState(0);

    // Trigger chime and haptics on mount/change
    useEffect(() => {
        if (!type) return;

        if (type === "admin_login") {
            playAudioChime("admin_login");
            triggerHaptic([40, 50, 60, 40]);
        } else if (type === "user_login") {
            playAudioChime("user_login");
            triggerHaptic([30, 40]);
        } else if (type === "logout") {
            playAudioChime("logout");
            triggerHaptic(30);
        }

        setProgress(0);
        const timer = setTimeout(() => setProgress(100), 50);
        return () => clearTimeout(timer);
    }, [type]);

    const displayName = useMemo(() => {
        if (userName?.trim()) return userName.trim();
        if (userEmail) return userEmail.split("@")[0];
        return type === "admin_login" ? "Commander" : "Friend";
    }, [userName, userEmail, type]);

    if (!type) return null;

    return (
        <AnimatePresence onExitComplete={onAnimationComplete}>
            <motion.div
                key={`auth-overlay-${type}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none overflow-hidden"
                style={{
                    backgroundColor:
                        type === "admin_login"
                            ? "rgba(3, 7, 18, 0.88)"
                            : "rgba(15, 23, 42, 0.75)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                {/* ─── ADMIN LOGIN SPECIAL EFFECT ─── */}
                {type === "admin_login" && (
                    <div className="relative flex flex-col items-center max-w-md w-full text-center">
                        {/* Radiant Ambient Aura */}
                        <div className="absolute -inset-20 bg-radial-gradient from-amber-500/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

                        {/* Animated Cyber Ring / Shield Icon */}
                        <div className="relative mb-6 flex items-center justify-center">
                            {/* Rotating Outer Hex Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                                className="w-32 h-32 rounded-full border-2 border-dashed border-amber-400/40 absolute"
                            />

                            {/* Counter-rotating Inner Hex Ring */}
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-28 h-28 rounded-full border border-amber-300/30 absolute"
                            />

                            {/* Pulsing Aura */}
                            <motion.div
                                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500/30 to-yellow-300/20 absolute blur-md"
                            />

                            {/* Core Avatar or Shield Badge */}
                            <motion.div
                                initial={{ scale: 0.5, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                                className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/80 border-2 border-amber-400/70 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.45)]"
                            >
                                {photoURL ? (
                                    <div className="relative w-full h-full rounded-xl overflow-hidden">
                                        <Image
                                            src={photoURL}
                                            alt={displayName}
                                            fill
                                            sizes="96px"
                                            className="object-cover"
                                            priority
                                        />
                                    </div>
                                ) : (
                                    <ShieldCheck className="w-12 h-12 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                                )}

                                {/* Crown Badge Overlay */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                                    className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 p-1 flex items-center justify-center shadow-lg border border-yellow-200"
                                >
                                    <Crown className="w-4 h-4 text-slate-950 fill-slate-950" />
                                </motion.div>
                            </motion.div>

                            {/* Particle Sparks */}
                            <motion.div
                                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute -top-4 -left-2 text-amber-300"
                            >
                                <Sparkles className="w-5 h-5 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                            </motion.div>
                        </div>

                        {/* High-Tech Security Pill */}
                        <motion.div
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.15 }}
                            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-mono tracking-widest uppercase mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        >
                            <Terminal className="w-3.5 h-3.5 text-amber-400" />
                            <span>Level 1 Root Clearance Granted</span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        </motion.div>

                        {/* Title & Greeting */}
                        <motion.h2
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.25 }}
                            className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1.5"
                        >
                            Welcome Commander,{" "}
                            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow">
                                {displayName}
                            </span>
                        </motion.h2>

                        <motion.p
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.35 }}
                            className="text-xs sm:text-sm text-amber-200/70 font-mono mb-6"
                        >
                            {statusText || "Initializing administrative command telemetry..."}
                        </motion.p>

                        {/* Futuristic Loading Bar */}
                        <div className="w-full max-w-xs bg-slate-900/90 rounded-full h-1.5 p-0.5 overflow-hidden border border-amber-500/30">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1.1, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                            />
                        </div>
                    </div>
                )}

                {/* ─── STANDARD USER LOGIN TRANSITION ─── */}
                {type === "user_login" && (
                    <motion.div
                        initial={{ scale: 0.92, y: 12, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 20 }}
                        className="relative w-full max-w-sm rounded-3xl bg-card/90 dark:bg-slate-900/90 border border-border/80 p-7 flex flex-col items-center text-center shadow-2xl backdrop-blur-2xl"
                    >
                        {/* Avatar / Success Check */}
                        <div className="relative mb-5 flex items-center justify-center">
                            {/* Outer Pulse */}
                            <motion.div
                                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                                className="w-20 h-20 rounded-full bg-emerald-500/20 absolute blur-md"
                            />

                            <motion.div
                                initial={{ scale: 0.6 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                className="relative w-16 h-16 rounded-full ring-4 ring-emerald-500/30 bg-emerald-500/10 flex items-center justify-center overflow-hidden"
                            >
                                {photoURL ? (
                                    <Image
                                        src={photoURL}
                                        alt={displayName}
                                        fill
                                        sizes="64px"
                                        className="object-cover"
                                        priority
                                    />
                                ) : (
                                    <Check className="w-8 h-8 text-emerald-500 stroke-[2.5]" />
                                )}
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 350 }}
                                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-background shadow-md"
                            >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </motion.div>
                        </div>

                        {/* Title & Greeting */}
                        <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">
                            Welcome back, {displayName}!
                        </h3>
                        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                            {statusText || "Synchronizing your links, preferences, and workspace..."}
                        </p>

                        {/* Smooth Progress Indicator */}
                        <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.9, ease: "easeInOut" }}
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            />
                        </div>
                    </motion.div>
                )}

                {/* ─── LOGOUT TRANSITION ─── */}
                {type === "logout" && (
                    <motion.div
                        initial={{ scale: 0.92, y: 12, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 20 }}
                        className="relative w-full max-w-sm rounded-3xl bg-card/90 dark:bg-slate-900/90 border border-border/80 p-7 flex flex-col items-center text-center shadow-2xl backdrop-blur-2xl"
                    >
                        {/* Lock Animation */}
                        <div className="relative mb-5 flex items-center justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-20 h-20 rounded-full bg-slate-500/20 absolute blur-md"
                            />

                            <motion.div
                                initial={{ scale: 0.7, rotate: -15 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                                className="relative w-16 h-16 rounded-2xl bg-muted/80 border border-border flex items-center justify-center shadow-inner"
                            >
                                <Lock className="w-8 h-8 text-muted-foreground stroke-[2.2]" />
                            </motion.div>
                        </div>

                        {/* Heading & Subtext */}
                        <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">
                            Signed Out Securely
                        </h3>
                        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                            {statusText || "Your session and keys were cleared safely. See you soon!"}
                        </p>

                        {/* Farewell Pill */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Thank you for using XURL</span>
                        </div>

                        {/* Progress */}
                        <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.75, ease: "easeOut" }}
                                className="h-full bg-muted-foreground/50 rounded-full"
                            />
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

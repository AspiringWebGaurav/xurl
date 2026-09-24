"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Crown, Sparkles, Check, Lock, Terminal } from "lucide-react";
import Image from "next/image";

export type AuthTransitionType = "admin_login" | "user_login" | "logout" | null;

export interface AuthTransitionState {
    type: AuthTransitionType;
    userName?: string;
    userEmail?: string;
    photoURL?: string | null;
    statusText?: string;
    isFirstLogin?: boolean;
}

interface AuthTransitionOverlayProps {
    transition: AuthTransitionState;
    onAnimationComplete?: () => void;
}

export function AuthTransitionOverlay({ transition, onAnimationComplete }: AuthTransitionOverlayProps) {
    const { type, userName, userEmail, photoURL, statusText, isFirstLogin } = transition;
    const [progress, setProgress] = useState(0);
    const [dynamicStatus, setDynamicStatus] = useState(statusText || "");
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [photoURL]);

    useEffect(() => {
        if (!type) return;

        setProgress(0);
        const timer = setTimeout(() => setProgress(100), 80);

        let t1: NodeJS.Timeout | undefined;
        let t2: NodeJS.Timeout | undefined;

        if (type === "admin_login") {
            setDynamicStatus(
                isFirstLogin
                    ? "Initializing master administrator workspace..."
                    : "Verifying administrative identity & security clearance..."
            );
            t1 = setTimeout(() => {
                setDynamicStatus(
                    isFirstLogin
                        ? "Configuring command telemetry & security controls..."
                        : "Synchronizing command telemetry & analytics..."
                );
            }, 1100);
            t2 = setTimeout(() => {
                setDynamicStatus(
                    isFirstLogin
                        ? "Root clearance active. Welcome aboard, Commander!"
                        : "Root clearance confirmed. At your command!"
                );
            }, 2100);
        } else if (type === "user_login") {
            setDynamicStatus(
                isFirstLogin
                    ? "Setting up your personalized link dashboard..."
                    : "Authenticating account credentials..."
            );
            t1 = setTimeout(() => {
                setDynamicStatus(
                    isFirstLogin
                        ? "Allocating banked link quota & workspace..."
                        : (statusText || "Synchronizing your banked links & workspace...")
                );
            }, 1100);
            t2 = setTimeout(() => {
                setDynamicStatus(
                    isFirstLogin
                        ? "Workspace ready. Enjoy shortening!"
                        : "Workspace synchronized safely!"
                );
            }, 2100);
        } else if (type === "logout") {
            setDynamicStatus("Terminating secure session...");
            t1 = setTimeout(() => {
                setDynamicStatus(statusText || "Session cleared safely. See you soon!");
            }, 900);
        }

        return () => {
            clearTimeout(timer);
            if (t1) clearTimeout(t1);
            if (t2) clearTimeout(t2);
        };
    }, [type, statusText, isFirstLogin]);

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
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 select-none overflow-y-auto overflow-x-hidden min-h-[100dvh]"
                style={{
                    backgroundColor:
                        type === "admin_login"
                            ? "rgba(3, 7, 18, 0.92)"
                            : "rgba(15, 23, 42, 0.80)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                }}
            >
                {/* ─── ADMIN LOGIN SPECIAL EFFECT ─── */}
                {type === "admin_login" && (
                    <div className="relative flex flex-col items-center w-full max-w-[340px] sm:max-w-md mx-auto text-center px-2 py-4 my-auto">
                        {/* Radiant Ambient Aura */}
                        <div className="absolute -inset-10 sm:-inset-20 bg-radial-gradient from-amber-500/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

                        {/* Animated Cyber Ring / Shield Icon */}
                        <div className="relative mb-4 sm:mb-6 flex items-center justify-center">
                            {/* Rotating Outer Hex Ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-dashed border-amber-400/40 absolute"
                            />

                            {/* Counter-rotating Inner Hex Ring */}
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border border-amber-300/30 absolute"
                            />

                            {/* Pulsing Aura */}
                            <motion.div
                                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-18 h-18 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-amber-500/30 to-yellow-300/20 absolute blur-md"
                            />

                            {/* Core Avatar or Shield Badge */}
                            <motion.div
                                initial={{ scale: 0.5, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/80 border-2 border-amber-400/70 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.45)]"
                            >
                                {photoURL && !imageError ? (
                                    <div className="relative w-full h-full rounded-xl overflow-hidden">
                                        <Image
                                            src={photoURL}
                                            alt={displayName}
                                            fill
                                            unoptimized
                                            sizes="(max-width: 640px) 80px, 96px"
                                            className="object-cover"
                                            priority
                                            referrerPolicy="no-referrer"
                                            onError={() => setImageError(true)}
                                        />
                                    </div>
                                ) : (
                                    <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                                )}

                                {/* Crown Badge Overlay */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                                    className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 p-1 flex items-center justify-center shadow-lg border border-yellow-200"
                                >
                                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 fill-slate-950" />
                                </motion.div>
                            </motion.div>

                            {/* Particle Sparks */}
                            <motion.div
                                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute -top-3 -left-1 sm:-top-4 sm:-left-2 text-amber-300"
                            >
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                            </motion.div>
                        </div>

                        {/* High-Tech Security Pill */}
                        <motion.div
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.15 }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] sm:text-[11px] font-mono tracking-wider sm:tracking-widest uppercase mb-2.5 sm:mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] max-w-full"
                        >
                            <Terminal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">Level 1 Root Clearance Granted</span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        </motion.div>

                        {/* Title & Greeting */}
                        <motion.h2
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.25 }}
                            className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white mb-1 sm:mb-1.5 break-words max-w-full leading-tight"
                        >
                            {isFirstLogin ? "Welcome Commander, " : "Welcome back, Commander "}
                            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow">
                                {displayName}
                            </span>
                        </motion.h2>

                        <motion.p
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.35 }}
                            className="text-[11px] sm:text-xs md:text-sm text-amber-200/80 font-mono mb-4 sm:mb-6 min-h-[2.5rem] flex items-center justify-center max-w-xs sm:max-w-sm px-1 leading-relaxed"
                        >
                            {dynamicStatus}
                        </motion.p>

                        {/* Futuristic Loading Bar */}
                        <div className="w-full max-w-[220px] sm:max-w-xs bg-slate-900/90 rounded-full h-1.5 sm:h-2 p-0.5 overflow-hidden border border-amber-500/30">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 2.6, ease: "easeInOut" }}
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
                        className="relative w-full max-w-[320px] sm:max-w-sm rounded-2xl sm:rounded-3xl bg-card/95 dark:bg-slate-900/95 border border-border/80 p-5 sm:p-7 flex flex-col items-center text-center shadow-2xl backdrop-blur-2xl mx-auto my-auto"
                    >
                        {/* Avatar / Success Check */}
                        <div className="relative mb-4 sm:mb-5 flex items-center justify-center">
                            {/* Outer Pulse */}
                            <motion.div
                                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 absolute blur-md"
                            />

                            <motion.div
                                initial={{ scale: 0.6 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-4 ring-emerald-500/30 bg-emerald-500/10 flex items-center justify-center overflow-hidden"
                            >
                                {photoURL && !imageError ? (
                                    <Image
                                        src={photoURL}
                                        alt={displayName}
                                        fill
                                        unoptimized
                                        sizes="(max-width: 640px) 56px, 64px"
                                        className="object-cover"
                                        priority
                                        referrerPolicy="no-referrer"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <Check className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 stroke-[2.5]" />
                                )}
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 350 }}
                                className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-background shadow-md"
                            >
                                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                            </motion.div>
                        </div>

                        {/* Title & Greeting */}
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-1 break-words max-w-full leading-snug">
                            {isFirstLogin ? `Welcome, ${displayName}!` : `Welcome back, ${displayName}!`}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mb-4 sm:mb-5 leading-relaxed min-h-[2.2rem] flex items-center justify-center max-w-[280px] sm:max-w-xs px-1">
                            {dynamicStatus}
                        </p>

                        {/* Smooth Progress Indicator */}
                        <div className="w-full bg-muted/60 rounded-full h-1 sm:h-1.5 overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 2.2, ease: "easeInOut" }}
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
                        className="relative w-full max-w-[320px] sm:max-w-sm rounded-2xl sm:rounded-3xl bg-card/95 dark:bg-slate-900/95 border border-border/80 p-5 sm:p-7 flex flex-col items-center text-center shadow-2xl backdrop-blur-2xl mx-auto my-auto"
                    >
                        {/* Lock Animation */}
                        <div className="relative mb-4 sm:mb-5 flex items-center justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-500/20 absolute blur-md"
                            />

                            <motion.div
                                initial={{ scale: 0.7, rotate: -15 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-muted/80 border border-border flex items-center justify-center shadow-inner"
                            >
                                <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground stroke-[2.2]" />
                            </motion.div>
                        </div>

                        {/* Heading & Subtext */}
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-1 leading-snug">
                            Signed Out Securely
                        </h3>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mb-3 sm:mb-4 leading-relaxed min-h-[2.2rem] flex items-center justify-center max-w-[280px] sm:max-w-xs px-1">
                            {dynamicStatus}
                        </p>

                        {/* Farewell Pill */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted text-muted-foreground text-[10px] sm:text-[11px] font-medium mb-3.5 sm:mb-4 max-w-full truncate">
                            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
                            <span>Thank you for using XURL</span>
                        </div>

                        {/* Progress */}
                        <div className="w-full bg-muted/60 rounded-full h-1 sm:h-1.5 overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1.8, ease: "easeInOut" }}
                                className="h-full bg-muted-foreground/50 rounded-full"
                            />
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

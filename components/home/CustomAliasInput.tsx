"use client";

import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Lock, Check, Loader2 } from "lucide-react";
import type { User } from "firebase/auth";

interface CustomAliasInputProps {
    user: User | null;
    quota: any;
    alias: string;
    setAlias: (val: string) => void;
    aliasStatus: string;
    shortDomain: string;
    isDisabled: boolean;
    loading: boolean;
    isValidUrl: boolean;
    handleShorten: () => void;
    premiumFieldShellBase: string;
}

export function CustomAliasInput({
    user,
    quota,
    alias,
    setAlias,
    aliasStatus,
    shortDomain,
    isDisabled,
    loading,
    isValidUrl,
    handleShorten,
    premiumFieldShellBase
}: CustomAliasInputProps) {
    const controls = useAnimation();
    const textControls = useAnimation();
    const [isShaking, setIsShaking] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Check if the user is allowed to use custom aliases (paid plan)
    const isAllowed = user && quota && quota.plan !== "free";

    const handleInteraction = () => {
        if (!isAllowed) {
            setIsShaking(true);

            // Shake animation for input shell
            controls.start({
                x: [0, -8, 8, -6, 6, -4, 4, 0],
                transition: { duration: 0.4, ease: "easeInOut" }
            }).then(() => setIsShaking(false));

            // Pop animation for the hint text
            textControls.start({
                scale: [1, 1.05, 0.98, 1],
                transition: { duration: 0.4, ease: "easeInOut" }
            });
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        if (isAllowed) {
            controls.start({
                scale: [1, 1.02, 1],
                transition: { duration: 0.3, ease: "easeOut" }
            });
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-medium text-foreground px-1 flex items-center gap-2">
                <span>Custom Alias</span>
                {(() => {
                    if (!user) {
                        return (
                            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-sm border border-amber-200/50">
                                <Lock className="w-2.5 h-2.5" /> Paid Plan
                            </span>
                        );
                    }
                    if (quota && quota.plan !== 'free') {
                        return (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-sm border border-emerald-200/50"
                            >
                                <Check className="w-2.5 h-2.5" /> {quota.plan}
                            </motion.span>
                        );
                    }
                    return (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-sm border border-slate-200/50">
                            <Lock className="w-2.5 h-2.5" /> Starter+
                        </span>
                    );
                })()}
            </label>

            <motion.div
                animate={controls}
                className={`${premiumFieldShellBase.replace("transition-all", "transition-colors")} relative ${isShaking ? "border-red-400/80 bg-red-50/50 dark:bg-red-900/20" :
                        (isFocused && isAllowed) ? "!border-emerald-400/80 !bg-emerald-50/30 !ring-4 !ring-emerald-500/15 dark:!bg-emerald-900/20" :
                            aliasStatus === "taken" || aliasStatus === "invalid"
                                ? "border-red-200 focus-within:ring-red-500"
                                : "border-border/80 focus-within:border-foreground/20 focus-within:ring-slate-900/10"
                    } ${(isDisabled || loading || !isAllowed) ? (isShaking ? "cursor-not-allowed" : "bg-muted/50 cursor-not-allowed") : ""}`}
            >
                {/* Invisible overlay to capture clicks when disabled so input doesn't eat them */}
                {!isAllowed && (
                    <div className="absolute inset-0 z-10 cursor-not-allowed" onClick={handleInteraction} onTouchStart={handleInteraction} />
                )}

                <span className="pl-3 pr-1 text-muted-foreground text-sm select-none pointer-events-none whitespace-nowrap">
                    {shortDomain} /
                </span>
                <input
                    type="text"
                    placeholder={!user ? "Sign in with a paid plan" : (quota && quota.plan === 'free') ? "Upgrade to Starter+ to unlock" : "type-alias"}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                    disabled={isDisabled || loading || !isAllowed}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={(e) => e.key === "Enter" && isAllowed && isValidUrl && aliasStatus !== "checking" && aliasStatus !== "taken" && aliasStatus !== "invalid" && handleShorten()}
                    className={`flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground h-full disabled:cursor-not-allowed ${alias.trim() ? "pr-[130px] sm:pr-[220px]" : "pr-3"
                        }`}
                />

                {/* Idle animation for allowed users */}
                {isAllowed && !alias.trim() && !loading && (
                    <motion.div
                        animate={{ opacity: [0.2, 0.6, 0.2] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 pointer-events-none"
                    />
                )}

                {alias.trim() && (
                    <div className={`absolute right-3 flex items-center select-none pointer-events-none pl-1 ${isDisabled || loading || !user ? "bg-transparent" : "bg-background"}`}>
                        {aliasStatus === "checking" && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> checking...</span>}
                        {aliasStatus === "available" && <span className="text-xs text-emerald-600 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> available</span>}
                        {aliasStatus === "taken" && <span className="text-xs text-red-500 flex items-center gap-1.5">already claimed — try another</span>}
                        {aliasStatus === "invalid" && <span className="text-xs text-red-500 flex items-center gap-1.5">invalid format</span>}
                    </div>
                )}
            </motion.div>
            <motion.div
                animate={textControls}
                className="text-[11px] px-1 mt-0.5"
            >
                {!user ? (
                    <motion.span layout className={`font-medium tracking-tight transition-colors duration-300 ${isShaking ? 'text-red-500' : 'text-amber-600/90'}`}>Sign in with a paid plan to create custom aliases.</motion.span>
                ) : quota && quota.plan === 'free' ? (
                    <motion.span layout className={`font-medium tracking-tight transition-colors duration-300 ${isShaking ? 'text-red-500' : 'text-amber-600/90'}`}>Upgrade to Starter or above to unlock custom aliases.</motion.span>
                ) : (
                    <motion.span layout className={`font-medium transition-colors duration-300 ${(isFocused && isAllowed) ? 'text-emerald-600/90 dark:text-emerald-400' : 'text-muted-foreground'}`}>You can create your own alias or leave it empty — the system will generate one.</motion.span>
                )}
            </motion.div>
        </div>
    );
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useUrlShortener } from "@/lib/hooks/useUrlShortener";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase/config";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link2, Loader2, Lock, Unlock, QrCode, Clock, ExternalLink, ArrowRight, Gift, Sun, Moon } from "lucide-react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RateLimitModal } from "@/components/ui/rate-limit-modal";
import { HomePageSkeleton } from "./HomePageSkeleton";
import type { GuestQuotaResult } from "@/lib/server/quota-check";
import { formatCooldown } from "@/lib/utils/format-time";
import { CustomAliasInput } from "@/components/home/CustomAliasInput";
import { useConfirmLink } from "@/components/providers/ConfirmLinkProvider";


/** Reads ?focus=true from the URL — must be wrapped in <Suspense>. */
function SearchParamsHandler({ onFocus }: { onFocus: () => void }) {
    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams.get("focus") === "true") {
            onFocus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);
    return null;
}

interface HomePageClientProps {
    initialGuestStatus: GuestQuotaResult;
}

export function HomePageClient({ initialGuestStatus }: HomePageClientProps) {
    const {
        user, authLoading, quotaLoading, quotaFetched,
        url, setUrl, isValidUrl, setIsValidUrl, shortDomain, mounted,
        showPasteHint, setShowPasteHint, alias, setAlias, aliasStatus, setAliasStatus,
        shortUrl, setShortUrl, loading, loadingText,
        error, setError, copied, guestUsed, showUnlockAnimation,
        guestSessionId, guestLoading, showQR, setShowQR, preview, faviconError, setFaviconError,
        highlightInput, setHighlightInput, quota, guestExpiresAt,
        countdown, viewingPastLink, setViewingPastLink, focusTriggered, setFocusTriggered,
        isRateLimited, setIsRateLimited, showDelayedModuleSkeleton, setShowDelayedModuleSkeleton,
        grantNotified, setGrantNotified, selectedQuota, setSelectedQuota, handleGoogleLogin, isLoggingIn,
        checkUrl, handleUrlChange, handleUrlPaste, handleCopy, handleReset, handleShorten, router,
        isStrictlyLoading, heroCardBase, statusPillBase, premiumInputClass, premiumFieldShellBase, premiumPrimaryButtonClass
    } = useUrlShortener(initialGuestStatus);

    const resultRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { handleLinkClick } = useConfirmLink();

    const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const isDark = document.documentElement.classList.contains("dark");
            setPageTheme(isDark ? "dark" : "light");
        }
        return () => {
            // Theme toggle scoped ONLY to this page — reset dark mode when leaving
            if (typeof window !== "undefined") {
                document.documentElement.classList.remove("dark");
            }
        };
    }, []);

    const togglePageTheme = () => {
        const nextTheme = pageTheme === "light" ? "dark" : "light";
        setPageTheme(nextTheme);
        if (nextTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    };

    if (isStrictlyLoading) {
        return <HomePageSkeleton />;
    }

    const isDisabled = isStrictlyLoading || isRateLimited;
    const isGuestLocked = !user && guestUsed && !showUnlockAnimation && !viewingPastLink;
    const isOverQuota = isGuestLocked || (quota ? (quota.used !== undefined ? quota.used : quota.freeLinksCreated) >= quota.limit : false);


    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-gradient-to-b from-slate-100/90 via-indigo-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
            {/* Silent Drifting Animated Background Orbs */}
            <motion.div
                animate={{
                    x: [0, 35, -25, 0],
                    y: [0, -30, 25, 0],
                    scale: [1, 1.15, 0.9, 1],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 15,
                    ease: "easeInOut",
                }}
                className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-br from-indigo-400/25 via-purple-400/15 to-pink-400/10 dark:from-indigo-600/30 dark:via-purple-600/20 dark:to-emerald-500/10 rounded-full blur-[110px] pointer-events-none -z-10"
            />
            <motion.div
                animate={{
                    x: [0, -40, 30, 0],
                    y: [0, 35, -25, 0],
                    scale: [1, 0.85, 1.1, 1],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 19,
                    ease: "easeInOut",
                }}
                className="absolute -bottom-24 -right-20 w-[520px] h-[520px] bg-gradient-to-tr from-emerald-400/20 via-teal-400/15 to-indigo-400/20 dark:from-emerald-600/25 dark:via-teal-600/20 dark:to-indigo-600/25 rounded-full blur-[120px] pointer-events-none -z-10"
            />
            <Suspense fallback={null}>
                <SearchParamsHandler onFocus={() => setFocusTriggered(true)} />
            </Suspense>
            <TopNavbar isCreateDisabled={isDisabled} />

            <AnimatePresence>
                {showUnlockAnimation && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.1, y: -50 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm"
                    >
                        <div className="flex flex-col items-center justify-center p-8 bg-card border shadow-2xl rounded-3xl text-center">
                            <div className="bg-emerald-100 p-4 rounded-full mb-4">
                                <Unlock className="w-12 h-12 text-emerald-600 animate-bounce" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Lock Lifted!</h2>
                            <p className="text-muted-foreground">The admin has successfully unlocked your account.</p>
                            <p className="text-sm font-semibold text-emerald-600 mt-4">You can now create a new link!</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <main
                className="flex-1 flex flex-col w-full px-4 sm:px-6 md:px-8 overflow-hidden pt-14 pb-12 items-center justify-center"
            >
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-[340px] sm:max-w-xl flex flex-col gap-3 sm:gap-6 mx-auto my-auto"
                >
                    <div className="text-center relative">
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none -z-10" />
                        <h1 className="text-2xl min-[400px]:text-3xl sm:text-[52px] font-extrabold leading-[1.1] tracking-[-0.05em] bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 pb-0.5 sm:pb-1">
                            Shorten your URL
                        </h1>

                        {!authLoading && (
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                                {user ? (
                                    quota ? (
                                        <>
                                            {/* Free Plan Status - Show usage count and cooldown */}
                                            {quota.plan === "free" && (
                                                <>
                                                    <button
                                                        onClick={() => !viewingPastLink && setSelectedQuota('free')}
                                                        disabled={viewingPastLink}
                                                        title={selectedQuota === 'free' ? 'Currently selected' : 'Click to use Free Quota'}
                                                        className={`${statusPillBase} transition-all duration-200 ${viewingPastLink ? 'cursor-default' : 'cursor-pointer'} ${selectedQuota === 'free'
                                                                ? 'bg-indigo-100 border-indigo-400 text-indigo-800 ring-2 ring-indigo-400 ring-offset-2 ring-offset-background shadow-md scale-105'
                                                                : 'bg-indigo-50/90 border-indigo-200/80 text-indigo-700 hover:bg-indigo-100/80 hover:border-indigo-300'
                                                            } ${viewingPastLink && selectedQuota !== 'free' ? 'opacity-50 hover:bg-indigo-50/90 hover:border-indigo-200/80' : ''}`}
                                                    >
                                                        <Link2 className={`w-3.5 h-3.5 ${selectedQuota === 'free' ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                                        {Math.min(quota.freeUsageCount || 0, quota.freeMaxUses || 3)} / {quota.freeMaxUses || 3} free links
                                                        {quota.cooldownRemainingMs && quota.cooldownRemainingMs > 0 ? (
                                                            <>
                                                                <span className="text-indigo-300 mx-0.5">|</span>
                                                                <Clock className={`w-3.5 h-3.5 ${selectedQuota === 'free' ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                                                Next in {formatCooldown(quota.cooldownRemainingMs)}
                                                            </>
                                                        ) : null}
                                                    </button>
                                                    {/* Render Aggregate Gift Badge */
                                                        (() => {
                                                            const totalGiftBonus = quota.activeGiftQuotas?.reduce((sum: number, g: any) => sum + (g.amount || 0), 0) || 0;
                                                            if (totalGiftBonus === 0) return null;
                                                            const remainingGiftLinks = Math.max(0, totalGiftBonus - (quota.giftUsageCount || 0));
                                                            if (remainingGiftLinks === 0) return null;

                                                            const isPermanent = quota.activeGiftQuotas!.some((g: any) => !g.expiresAt);

                                                            let expiryText = "Expiring";
                                                            if (!isPermanent && quota.activeGiftQuotas!.length > 0) {
                                                                const earliestExpiry = Math.min(...quota.activeGiftQuotas!.map((g: any) => g.expiresAt));
                                                                const hoursLeft = Math.max(0, (earliestExpiry - Date.now()) / (1000 * 60 * 60));
                                                                if (hoursLeft > 48) {
                                                                    expiryText = `Expires in ${Math.ceil(hoursLeft / 24)}d`;
                                                                } else if (hoursLeft > 0) {
                                                                    expiryText = `Expires in ${Math.ceil(hoursLeft)}h`;
                                                                }
                                                            }

                                                            const hasGiftsAvailable = remainingGiftLinks > 0;

                                                            const isSelected = selectedQuota === 'gift';
                                                            const baseColors = isPermanent
                                                                ? 'bg-fuchsia-50/90 border-fuchsia-300/80 text-fuchsia-700 shadow-[0_0_12px_rgba(232,121,249,0.3)]'
                                                                : 'bg-pink-50/90 border-pink-200/80 text-pink-700';
                                                            const hoverColors = isPermanent
                                                                ? 'hover:bg-fuchsia-100 hover:border-fuchsia-400'
                                                                : 'hover:bg-pink-100 hover:border-pink-300';
                                                            const selectedColors = isPermanent
                                                                ? 'bg-fuchsia-100 border-fuchsia-500 text-fuchsia-900 ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-background shadow-lg scale-105'
                                                                : 'bg-pink-100 border-pink-400 text-pink-800 ring-2 ring-pink-400 ring-offset-2 ring-offset-background shadow-md scale-105';

                                                            return (
                                                                <button
                                                                    key="aggregate-gift"
                                                                    onClick={() => !viewingPastLink && hasGiftsAvailable && setSelectedQuota('gift')}
                                                                    disabled={!hasGiftsAvailable || viewingPastLink}
                                                                    title={isSelected ? 'Currently selected' : (hasGiftsAvailable ? 'Click to use Gift Quota' : 'No gift quota available')}
                                                                    className={`${statusPillBase} transition-all duration-200 ${hasGiftsAvailable && !viewingPastLink ? 'cursor-pointer' : (viewingPastLink ? 'cursor-default' : 'opacity-50 cursor-not-allowed')} ${isSelected ? selectedColors : `${baseColors} ${hoverColors}`
                                                                        } ${viewingPastLink && !isSelected ? 'opacity-50' : ''} ${viewingPastLink && !isSelected && isPermanent ? 'hover:bg-fuchsia-50/90 hover:border-fuchsia-300/80' : ''} ${viewingPastLink && !isSelected && !isPermanent ? 'hover:bg-pink-50/90 hover:border-pink-200/80' : ''}`}
                                                                >
                                                                    <Gift className={`w-3.5 h-3.5 ${isPermanent ? (isSelected ? 'text-fuchsia-600' : 'text-fuchsia-500') : (isSelected ? 'text-pink-600' : 'text-pink-500')}`} />
                                                                    {remainingGiftLinks} Gift Links
                                                                    <span className={isPermanent ? 'text-fuchsia-300 mx-0.5' : 'text-pink-300 mx-0.5'}>|</span>
                                                                    <Clock className={`w-3.5 h-3.5 ${isPermanent ? (isSelected ? 'text-fuchsia-600' : 'text-fuchsia-500') : (isSelected ? 'text-pink-600' : 'text-pink-500')}`} />
                                                                    {isPermanent ? (
                                                                        <span className="font-bold">Permanent</span>
                                                                    ) : (
                                                                        <span>{expiryText}</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                </>
                                            )}

                                            {/* Paid Plan Status (if any) */}
                                            {quota.plan !== "free" && (
                                                <div className={`${statusPillBase} bg-emerald-50/90 border-emerald-200/80 text-emerald-700`}>
                                                    <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    {quota.paidLinksCreated} / {quota.limit} {quota.plan} links
                                                    {quota.planRenewals && quota.planRenewals > 1 ? ` (×${quota.planRenewals})` : ""}
                                                    <span className="text-emerald-300 mx-0.5">|</span>
                                                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                                    Expires in {quota.planTtlHours === "Unlimited" ? "never" : (quota.planTtlHours !== undefined && quota.planTtlHours < 1 ? `${Math.round(quota.planTtlHours * 60)}m` : `${quota.planTtlHours || 12}h`)}
                                                </div>
                                            )}

                                            {/* Expired Links Warning */}
                                            {quota.expiredLinksCount !== undefined && quota.expiredLinksCount > 0 && (
                                                <button
                                                    onClick={() => window.dispatchEvent(new Event("openHistory"))}
                                                    className={`${statusPillBase} transition-all duration-200 cursor-pointer bg-amber-50/90 border-amber-200/80 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm`}
                                                    title={`${quota.expiredLinksCount} links have expired (click to view)`}
                                                >
                                                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                    {quota.expiredLinksCount} expired history
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Skeleton className="h-[28px] w-[110px] rounded-full bg-blue-50/50" />
                                            <Skeleton className="h-[28px] w-[140px] rounded-full bg-emerald-50/50" />
                                        </>
                                    )
                                ) : (
                                    <Link href="/guest-policy" onClick={(e) => handleLinkClick(e, "/guest-policy")} className="group relative overflow-hidden flex items-center px-4 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 backdrop-blur-md border border-amber-500/30 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 hover:border-amber-400 hover:shadow-[0_8px_20px_-6px_rgba(217,119,6,0.3)] hover:-translate-y-0.5 transition-all duration-300 text-xs font-bold tracking-wide cursor-pointer">
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-orange-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"></div>
                                        <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400 group-hover:text-amber-700 transition-colors relative z-10" />
                                        <span className="relative z-10">1 free link for no login policy</span>
                                        <span className="mx-2 text-amber-400/80 relative z-10">—</span>
                                        <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400 group-hover:text-amber-700 transition-colors relative z-10" />
                                        <span className="relative z-10">
                                            Expires in {initialGuestStatus.guestTtlMs ? Math.round(initialGuestStatus.guestTtlMs / 60000) + 'm' : '5m'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-amber-500 dark:text-amber-400 group-hover:text-amber-700 group-hover:translate-x-1 transition-all relative z-10" />
                                    </Link>
                                )}
                                <button
                                    onClick={togglePageTheme}
                                    title={`Switch to ${pageTheme === "light" ? "Dark" : "Light"} theme`}
                                    className="group relative overflow-hidden flex items-center px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-300 text-xs font-bold tracking-wide cursor-pointer shadow-sm"
                                >
                                    {pageTheme === "light" ? (
                                        <>
                                            <Moon className="w-3.5 h-3.5 mr-1.5 text-indigo-500 transition-transform group-hover:rotate-12" />
                                            <span>Dark</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sun className="w-3.5 h-3.5 mr-1.5 text-amber-400 transition-transform group-hover:rotate-45" />
                                            <span>Light</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {isStrictlyLoading ? (
                            showDelayedModuleSkeleton ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`${heroCardBase} flex flex-col min-h-[290px] justify-center gap-4`}
                                >
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Skeleton className="h-4 w-28 bg-muted/60" />
                                        </div>
                                        <Skeleton className="h-12 w-full rounded-lg bg-muted/40" />
                                    </div>
                                    <div className="flex flex-col gap-2 mt-1">
                                        <Skeleton className="h-4 w-24 bg-muted/60 px-1" />
                                        <Skeleton className="h-12 w-full rounded-lg bg-muted/40" />
                                    </div>
                                    <Skeleton className="h-12 w-full rounded-lg bg-muted/60 mt-2" />
                                </motion.div>
                            ) : (
                                <div
                                    key="loading-placeholder"
                                    aria-hidden="true"
                                    className="min-h-[290px] w-full"
                                />
                            )
                        ) : (shortUrl && viewingPastLink) ? (
                            <motion.div
                                key="result"
                                ref={resultRef}
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className="w-full bg-card border border-emerald-500/30 rounded-xl p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] flex flex-col md:flex-row gap-6 items-center min-h-[290px] overflow-hidden"
                            >
                                <div className="flex-1 w-full flex flex-col justify-center h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                            Your short link
                                        </p>
                                        <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium flex items-center gap-1.5 border border-emerald-100/50">
                                            <Check className="h-3 w-3" /> Saved to History
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <code className="flex-1 text-[15px] font-mono bg-muted px-4 py-3.5 rounded-lg truncate border border-border select-all">
                                            <a
                                                href={shortUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-foreground transition-colors"
                                                title="Open in new tab"
                                            >
                                                {shortUrl}
                                            </a>
                                        </code>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                asChild
                                                className="h-12 w-12 border-border hover:bg-muted rounded-lg shadow-sm text-muted-foreground hover:text-foreground"
                                                title="Open link in new tab"
                                            >
                                                <a href={shortUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleCopy(shortUrl)}
                                                className="h-12 w-12 border-border hover:bg-muted rounded-lg shadow-sm"
                                                title="Copy link"
                                            >
                                                {copied ? (
                                                    <Check className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {preview && (
                                        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/50 mb-4">
                                            {(preview.favicon && !faviconError) ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={preview.favicon}
                                                    alt=""
                                                    className="w-6 h-6 rounded-sm bg-background border border-border/50"
                                                    onError={() => setFaviconError(true)}
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-sm bg-muted border border-border flex items-center justify-center shrink-0">
                                                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{preview.title || "Unknown Title"}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex justify-between items-center border-t border-border/60">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowQR(!showQR)}
                                            className={`text-[13px] h-9 px-4 rounded-lg font-medium transition-all duration-200 border-border shadow-sm ${showQR ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background border-foreground" : "text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:shadow-md"}`}
                                        >
                                            <QrCode className="h-4 w-4 mr-2" />
                                            {showQR ? "Hide QR" : "QR Code"}
                                        </Button>
                                        <Button
                                            onClick={handleReset}
                                            size="sm"
                                            className="text-[13px] h-9 px-4 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all duration-200"
                                        >
                                            <Link2 className="h-4 w-4 mr-2" />
                                            Create another
                                        </Button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showQR && (
                                        <motion.div
                                            initial={{ width: 0, opacity: 0, scale: 0.8 }}
                                            animate={{ width: "180px", opacity: 1, scale: 1 }}
                                            exit={{ width: 0, opacity: 0, scale: 0.8 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="shrink-0 flex flex-col items-center justify-center"
                                        >
                                            <div className="bg-white p-3 rounded-xl border border-border/80 shadow-sm w-[160px] h-[160px] flex items-center justify-center mb-3 transition-transform hover:scale-105">
                                                <QRCode value={shortUrl} size={140} className="w-full h-auto" />
                                            </div>
                                            <p className="text-[11px] font-medium text-muted-foreground text-center whitespace-nowrap">Scan or Download QR</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className={`${heroCardBase} flex flex-col gap-4 min-h-[290px] justify-center`}
                            >
                                <div className={`flex flex-col gap-1.5 ${isOverQuota ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-xs font-medium text-foreground">Destination URL</label>
                                        <AnimatePresence>
                                            {showPasteHint && isValidUrl && (
                                                <motion.span
                                                    initial={{ opacity: 0, y: -2 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5"
                                                >
                                                    Press <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border shadow-sm text-foreground">Enter</kbd> to shorten instantly
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <div className="relative flex items-center">
                                        <Link2 className="absolute left-3.5 w-4 h-4 text-muted-foreground/60 pointer-events-none transition-colors" />
                                        <Input
                                            ref={inputRef}
                                            type="url"
                                            placeholder="https://example.com/very-long-url"
                                            value={url}
                                            onChange={handleUrlChange}
                                            onPaste={handleUrlPaste}
                                            disabled={isDisabled || loading}
                                            onKeyDown={(e) => e.key === "Enter" && isValidUrl && handleShorten()}
                                            className={`${premiumInputClass} pl-10 ${highlightInput ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/10" : ""
                                                }`}
                                        />
                                    </div>
                                </div>

                                <div className={`${isOverQuota ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <CustomAliasInput
                                        user={user}
                                        quota={quota}
                                        alias={alias}
                                        setAlias={setAlias}
                                        aliasStatus={aliasStatus}
                                        shortDomain={shortDomain}
                                        isDisabled={isDisabled}
                                        loading={loading}
                                        isValidUrl={isValidUrl}
                                        handleShorten={handleShorten}
                                        premiumFieldShellBase={premiumFieldShellBase}
                                    />
                                </div>

                                {isOverQuota ? (
                                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-xl p-6 text-center shadow-[inset_0_4px_24px_rgba(0,0,0,0.02)]">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3 ring-4 ring-emerald-50/50">
                                            <Lock className="w-5 h-5 text-emerald-600" />
                                        </div>

                                        {/* Guest limit */}
                                        {isGuestLocked ? (
                                            <>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">Guest Limit Reached</h3>
                                                <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                                    You have already claimed your 1 free link as per our no-login policy. Sign in to create more links.
                                                </p>
                                                <Button
                                                    onClick={handleGoogleLogin}
                                                    disabled={isLoggingIn}
                                                    className="w-full max-w-[240px] h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all rounded-lg font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isLoggingIn ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            Connecting...
                                                        </>
                                                    ) : (
                                                        "Sign In / Sign Up"
                                                    )}
                                                </Button>
                                                {shortUrl && (
                                                    <Button
                                                        onClick={() => {
                                                            window.dispatchEvent(new Event("openHistory"));
                                                        }}
                                                        variant="outline"
                                                        className="mt-2 w-full max-w-[240px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 rounded-lg"
                                                    >
                                                        <Link2 className="w-4 h-4 mr-2" />
                                                        View link history
                                                    </Button>
                                                )}
                                            </>
                                        ) : user && quota && quota.plan === "free" && quota.cooldownRemainingMs && quota.cooldownRemainingMs > 0 ? (
                                            <>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">Cooldown Active</h3>
                                                <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                                    Free plan allows {quota.freeMaxUses || 3} links with 24-hour cooldown between each. Next link available in {formatCooldown(quota.cooldownRemainingMs)}.
                                                </p>
                                                <Button
                                                    asChild
                                                    className="w-full max-w-[240px] h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all rounded-lg font-medium tracking-wide"
                                                >
                                                    <Link href="/pricing" className="flex items-center justify-center">
                                                        Upgrade for Instant Access <ArrowRight className="w-4 h-4 ml-2" />
                                                    </Link>
                                                </Button>
                                            </>
                                        ) : user && quota && quota.plan === "free" && quota.freeUsageCount !== undefined && quota.freeMaxUses !== undefined && quota.freeUsageCount >= quota.freeMaxUses ? (
                                            /* Free plan quota exhausted */
                                            <>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">Free Plan Limit Reached</h3>
                                                <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                                    You&apos;ve used all {quota.freeMaxUses} free link creations. Upgrade to Starter for 5 links with 2-hour expiry and custom aliases.
                                                </p>
                                                <Button
                                                    asChild
                                                    className="w-full max-w-[240px] h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all rounded-lg font-medium tracking-wide"
                                                >
                                                    <Link href="/pricing" className="flex items-center justify-center">
                                                        Upgrade to Continue <ArrowRight className="w-4 h-4 ml-2" />
                                                    </Link>
                                                </Button>
                                            </>
                                        ) : user && quota ? (
                                            /* Paid plan limit */
                                            <>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1.5 capitalize">{quota.plan} Plan Limit Reached</h3>
                                                <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                                    You&apos;ve reached your maximum capacity of {quota.limit} active links on the {quota.plan} plan. {(quota.plan === "enterprise" || quota.plan === "bigenterprise") ? 'Contact our sales team to increase your limits.' : `Upgrade to Business for up to 100 links at just ₹199.`}
                                                </p>
                                                {(quota.plan === "enterprise" || quota.plan === "bigenterprise") ? (
                                                    <Button
                                                        asChild
                                                        className="w-full max-w-[240px] h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all rounded-lg font-medium tracking-wide"
                                                    >
                                                        <a href="mailto:support@xurl.eu.cc" className="flex items-center justify-center">
                                                            Contact Support <ExternalLink className="w-4 h-4 ml-2" />
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        asChild
                                                        className="w-full max-w-[240px] h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all rounded-lg font-medium tracking-wide"
                                                    >
                                                        <Link href="/pricing" className="flex items-center justify-center">
                                                            Upgrade Workspace <ArrowRight className="w-4 h-4 ml-2" />
                                                        </Link>
                                                    </Button>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                ) : (
                                    <Button
                                        onClick={handleShorten}
                                        disabled={!isValidUrl || isDisabled || loading || aliasStatus === "checking" || aliasStatus === "taken" || aliasStatus === "invalid"}
                                        className={premiumPrimaryButtonClass}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Link2 className="h-4 w-4 mr-2" />
                                        )}
                                        {loading ? (loadingText || "Shortening...") : "Shorten"}
                                        {error && !shortUrl && (
                                            <motion.div
                                                initial={{ opacity: 0, y: "100%" }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="absolute inset-0 flex items-center justify-center bg-red-500 text-white font-medium"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </Button>
                                )}
                                <div className="mt-3 text-center text-[11px] text-muted-foreground/70 leading-relaxed px-4">
                                    By shortening a URL, you agree to our <a href="/terms" onClick={(e) => handleLinkClick(e, "/terms")} className="font-medium text-muted-foreground/80 hover:text-foreground active:text-emerald-600 transition-colors whitespace-nowrap cursor-pointer">Terms of Service <ExternalLink className="inline-block w-[10px] h-[10px] mb-[2px] opacity-60" /></a>, <a href="/acceptable-use" onClick={(e) => handleLinkClick(e, "/acceptable-use")} className="font-medium text-muted-foreground/80 hover:text-foreground active:text-emerald-600 transition-colors whitespace-nowrap cursor-pointer">Acceptable Use Policy <ExternalLink className="inline-block w-[10px] h-[10px] mb-[2px] opacity-60" /></a>, and <a href="/code-of-conduct" onClick={(e) => handleLinkClick(e, "/code-of-conduct")} className="font-medium text-muted-foreground/80 hover:text-foreground active:text-emerald-600 transition-colors whitespace-nowrap cursor-pointer">Code of Conduct <ExternalLink className="inline-block w-[10px] h-[10px] mb-[2px] opacity-60" /></a>.
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </main>

            <RateLimitModal
                isOpen={isRateLimited}
                onClose={() => setIsRateLimited(false)}
            />

            <div className="hidden md:block">
                <HomeFooter />
            </div>
            <div className="block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}
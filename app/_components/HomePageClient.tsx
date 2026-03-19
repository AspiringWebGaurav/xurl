"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { env } from "@/lib/env";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link2, Loader2, Lock, QrCode, Clock, ExternalLink, ArrowRight } from "lucide-react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RateLimitModal } from "@/components/ui/rate-limit-modal";
import { HomePageSkeleton } from "./HomePageSkeleton";
import type { GuestQuotaResult } from "@/lib/server/quota-check";
import { formatCooldown } from "@/lib/utils/format-time";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";

import { useRouter, useSearchParams } from "next/navigation";

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
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [quotaLoading, setQuotaLoading] = useState(false);
    const [quotaFetched, setQuotaFetched] = useState(false);
    const [url, setUrl] = useState("");
    const [isValidUrl, setIsValidUrl] = useState(false);
    const [shortDomain, setShortDomain] = useState("xurl.eu.cc");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Hydrate the actual domain at runtime to avoid Next.js static build inlining bugs
        if (typeof window !== "undefined") {
            const envDomain = env.NEXT_PUBLIC_SHORT_DOMAIN;
            // Unconditionally trust the browser's hostname in production (Vercel) over env vars
            if (window.location.hostname !== "localhost") {
                setShortDomain(window.location.host);
            } else {
                setShortDomain(envDomain);
            }
        }
    }, []);
    const [showPasteHint, setShowPasteHint] = useState(false);
    const [alias, setAlias] = useState("");
    const [aliasStatus, setAliasStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
    const [shortUrl, setShortUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [guestUsed, setGuestUsed] = useState(!initialGuestStatus.allowed);
    const [guestLoading, setGuestLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [preview, setPreview] = useState<{ title?: string, favicon?: string } | null>(null);
    const [faviconError, setFaviconError] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [highlightInput, setHighlightInput] = useState(false);
    const [quota, setQuota] = useState<{ 
        freeLinksCreated: number;
        paidLinksCreated: number;
        limit: number;
        plan: string;
        planRenewals?: number;
        planTtlHours?: number | "Unlimited";
        expiredLinksCount?: number;
        totalLinksEver?: number;
        freeUsageCount?: number;
        freeMaxUses?: number;
        cooldownRemainingMs?: number;
        canCreateFreeLink?: boolean;
    } | null>(null);
    const [guestExpiresAt, setGuestExpiresAt] = useState<number | null>(initialGuestStatus.expiresIn && initialGuestStatus.expiresIn > 0 ? Date.now() + (initialGuestStatus.expiresIn * 1000) : null);
    const [countdown, setCountdown] = useState<string>("");
    const [viewingPastLink, setViewingPastLink] = useState(false);
    const [focusTriggered, setFocusTriggered] = useState(false);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [showDelayedModuleSkeleton, setShowDelayedModuleSkeleton] = useState(false);
    const [grantNotified, setGrantNotified] = useState(false);
    const router = useRouter();

    // Google login hook with consistent error handling
    const { login: handleGoogleLogin, isLoggingIn } = useGoogleLogin({
        toastId: "guest-login",
        onCancel: () => {
            // Keep guest locked, only reset viewing state
            // DO NOT reset guestUsed - that would bypass quota!
            setViewingPastLink(false);
        }
    });

    // CRITICAL: Strict loading gate - prevents any render until all data is ready
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
            
            if (u) {
                // CRITICAL: Block render until quota fetched
                setQuotaLoading(true);
                setQuotaFetched(false);
                
                void ensureUserDocument(u);
                // Clear any guest state so logged-in user gets a fresh form
                setUrl("");
                setIsValidUrl(false);
                setShortUrl("");
                setAlias("");
                setAliasStatus("idle");
                setError("");
                setPreview(null);
                setShowQR(false);
                setGuestUsed(false);
                setGuestExpiresAt(null);
                setViewingPastLink(false);
                setCountdown("");
                
                u.getIdToken()
                    .then(token => fetch("/api/links?pageSize=1", { 
                        headers: { "Authorization": `Bearer ${token}` } 
                    }))
                    .then(r => r.json())
                    .then(d => {
                        if (d.limit) {
                            setQuota({
                                freeLinksCreated: d.freeLinksCreated,
                                paidLinksCreated: d.paidLinksCreated,
                                limit: d.limit,
                                plan: d.plan || "free",
                                planRenewals: d.planRenewals,
                                planTtlHours: d.planTtlHours,
                                expiredLinksCount: d.expiredLinksCount,
                                totalLinksEver: d.totalLinksEver,
                                // Free plan specific fields
                                freeUsageCount: d.freeUsageCount,
                                freeMaxUses: d.freeMaxUses,
                                cooldownRemainingMs: d.cooldownRemainingMs,
                                canCreateFreeLink: d.canCreateFreeLink
                            });
                        }
                        setQuotaFetched(true);
                    })
                    .catch(err => {
                        console.error("Quota fetch failed", err);
                        setQuotaFetched(true); // Still unblock, but with no quota
                    })
                    .finally(() => {
                        setQuotaLoading(false);
                    });
            } else {
                // Guest - no quota needed
                setQuota(null);
                setQuotaFetched(true);
                setQuotaLoading(false);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user || grantNotified || typeof window === "undefined") {
            return;
        }

        const raw = localStorage.getItem("xurl_pending_grants_applied");
        if (!raw) {
            return;
        }

        try {
            const parsed = JSON.parse(raw) as {
                items?: Array<{ type: string; planId?: string; quantity?: number; expiresAt?: number | null }>;
                ts?: number;
            };

            if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
                localStorage.removeItem("xurl_pending_grants_applied");
                return;
            }

            if (parsed.ts && Date.now() - parsed.ts > 10 * 60 * 1000) {
                localStorage.removeItem("xurl_pending_grants_applied");
                return;
            }

            for (const item of parsed.items) {
                if (item.type === "plan" && item.planId) {
                    toast.success(
                        `Admin granted your ${item.planId} plan${item.expiresAt === null ? " permanently" : ""}.`,
                        { position: "top-center", duration: 5500, closeButton: true }
                    );
                } else if (item.type === "link_gift" && item.quantity) {
                    toast.success(
                        `Admin gifted ${item.quantity} extra links${item.expiresAt ? ` until ${new Date(item.expiresAt).toLocaleString()}` : ""}.`,
                        { position: "top-center", duration: 5500, closeButton: true }
                    );
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.style.position = "fixed";
            canvas.style.inset = "0";
            canvas.style.pointerEvents = "none";
            canvas.style.zIndex = "9999";
            document.body.appendChild(canvas);

            const ctx = canvas.getContext("2d");
            if (ctx) {
                const colors = ["#16a34a", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899"];
                const particles = Array.from({ length: 80 }, () => ({
                    x: Math.random() * canvas.width,
                    y: -20 - Math.random() * canvas.height * 0.35,
                    vx: (Math.random() - 0.5) * 4,
                    vy: 2 + Math.random() * 3,
                    size: 4 + Math.random() * 6,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * Math.PI,
                }));

                const startedAt = performance.now();
                const draw = (time: number) => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    particles.forEach((particle) => {
                        particle.x += particle.vx;
                        particle.y += particle.vy;
                        particle.rotation += 0.05;
                        ctx.save();
                        ctx.translate(particle.x, particle.y);
                        ctx.rotate(particle.rotation);
                        ctx.fillStyle = particle.color;
                        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 1.8);
                        ctx.restore();
                    });

                    if (time - startedAt < 1400) {
                        requestAnimationFrame(draw);
                    } else {
                        canvas.remove();
                    }
                };

                requestAnimationFrame(draw);
            } else {
                canvas.remove();
            }

            localStorage.removeItem("xurl_pending_grants_applied");
            setGrantNotified(true);
        } catch {
            localStorage.removeItem("xurl_pending_grants_applied");
        }
    }, [user, grantNotified]);

    useEffect(() => {
        if (shortUrl && resultRef.current) {
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
        }
    }, [shortUrl]);

    // ── Keyboard shortcut & Programmatic Focus ──
    useEffect(() => {
        const handleFocus = () => {
            if (inputRef.current) {
                inputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                inputRef.current.focus();
                setHighlightInput(true);
                setTimeout(() => setHighlightInput(false), 250);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not typing in another input
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault();
                handleFocus();
            }
        };

        window.addEventListener("focusUrlInput", handleFocus as EventListener);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("focusUrlInput", handleFocus as EventListener);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    // ── Handle Auto-Focus from Navigation ──
    useEffect(() => {
        if (focusTriggered) {
            // Small delay to ensure the DOM is ready and animated
            setTimeout(() => {
                window.dispatchEvent(new Event("focusUrlInput"));
            }, 100);

            // Clean up the URL
            const url = new URL(window.location.href);
            url.searchParams.delete("focus");
            window.history.replaceState({}, '', url.toString());
            setFocusTriggered(false);
        }
    }, [focusTriggered]);

    // ── Initialize guest state from server-provided data ──
    useEffect(() => {
        if (!initialGuestStatus.allowed && initialGuestStatus.slug) {
            // Guest has already used their link
            setGuestUsed(true);
            if (initialGuestStatus.expiresIn && initialGuestStatus.expiresIn > 0) {
                const expiresAt = Date.now() + (initialGuestStatus.expiresIn * 1000);
                setGuestExpiresAt(expiresAt);
                localStorage.setItem("xurl_guest_link_history", JSON.stringify({ 
                    slug: initialGuestStatus.slug, 
                    expiresAt 
                }));
                
                // Restore the success card data
                setShortUrl(buildShortUrl(initialGuestStatus.slug));
                if (initialGuestStatus.originalUrl) {
                    setUrl(initialGuestStatus.originalUrl);
                }
            }
        }
    }, [initialGuestStatus]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (guestExpiresAt && !user) {
            const updateCountdown = () => {
                const now = Date.now();
                if (guestExpiresAt <= now) {
                    setGuestUsed(false);
                    setGuestExpiresAt(null);
                    setShortUrl("");
                    setViewingPastLink(false);
                    setCountdown("");
                    setUrl("");
                    setIsValidUrl(false);
                    return;
                }

                const remainingSeconds = Math.floor((guestExpiresAt - now) / 1000);
                const h = Math.floor(remainingSeconds / 3600);
                const m = Math.floor((remainingSeconds % 3600) / 60);
                const s = remainingSeconds % 60;
                setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            };

            updateCountdown();
            interval = setInterval(updateCountdown, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [guestExpiresAt, user]);

    useEffect(() => {
        if (!alias.trim()) {
            setAliasStatus("idle");
            return;
        }

        if (!/^[a-zA-Z0-9-]+$/.test(alias)) {
            setAliasStatus("invalid");
            return;
        }

        setAliasStatus("checking");
        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`/api/check-slug?slug=${encodeURIComponent(alias)}`);
                const data = await res.json();
                if (data.available) {
                    setAliasStatus("available");
                } else {
                    setAliasStatus("taken");
                }
            } catch {
                setAliasStatus("idle");
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [alias]);

    const checkUrl = (str: string) => {
        if (!str.trim()) return false;
        try {
            const parsed = new URL(str.trim());
            return ["http:", "https:"].includes(parsed.protocol);
        } catch {
            return false;
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setUrl(val);
        const valid = checkUrl(val);
        setIsValidUrl(valid);
        if (!valid) setShowPasteHint(false);
    };

    const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData("Text");
        if (checkUrl(pastedText)) {
            setShowPasteHint(true);
        }
    };

    const handleCopy = async (textToCopy: string) => {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success("Link copied to clipboard", {
            position: "bottom-center",
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        if (!user && guestUsed) {
            setViewingPastLink(false);
            return;
        }
        setShortUrl("");
        setUrl("");
        setAlias("");
        setAliasStatus("idle");
        setPreview(null);
        setFaviconError(false);
        setError("");
        setViewingPastLink(false);
    };

    const handleShorten = async () => {
        setError("");
        setShortUrl("");
        setPreview(null);
        setFaviconError(false);

        if (!url.trim()) {
            setError("Please enter a URL.");
            return;
        }

        try {
            const parsed = new URL(url);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                setError("Only http and https URLs are supported.");
                return;
            }
        } catch {
            setError("Please enter a valid URL (e.g. https://example.com).");
            return;
        }

        if (aliasStatus === "taken") {
            setError("Custom alias is already taken.");
            return;
        }
        if (aliasStatus === "invalid") {
            setError("Custom alias can only contain letters, numbers, and dashes.");
            return;
        }

        if (!user && guestUsed) {
            setError("Free users can only shorten 1 link. Sign in to create more.");
            return;
        }

        setLoadingText("");
        setLoading(true);

        const checkSecurityTimeout = setTimeout(() => {
            setLoadingText("Checking request security...");
        }, 500);

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "x-device-fingerprint": await getDeviceFingerprint(),
            };
            if (user) {
                headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
            }

            const res = await fetch("/api/links", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    originalUrl: url.trim(),
                    customSlug: alias.trim() || undefined
                }),
            });

            clearTimeout(checkSecurityTimeout);
            setLoadingText("");

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429 && data.code === "RATE_LIMITED") {
                    setIsRateLimited(true);
                    return;
                }

                setError(data.message || "Failed to create link. Please try again.");
                if (data.error === "guest_limit_reached" && data.expiresIn) {
                    setGuestUsed(true);
                    const expiresAt = Date.now() + (data.expiresIn * 1000);
                    setGuestExpiresAt(expiresAt);
                    if (data.slug) {
                        localStorage.setItem("xurl_guest_link_history", JSON.stringify({ slug: data.slug, expiresAt }));
                    }

                    if (data.slug && data.originalUrl) {
                        const generated = buildShortUrl(data.slug);
                        setShortUrl(generated);
                        setViewingPastLink(true);
                        // Trigger history update to show the sidebar button
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("linkGenerated"));
                        }
                    }
                }
                return;
            }

            const generated = buildShortUrl(data.slug);
            setShortUrl(generated);

            setViewingPastLink(true);

            // Auto copy
            handleCopy(generated);

            if (!user) {
                const newGuestExpiresAt = Date.now() + (5 * 60 * 1000);
                setGuestUsed(true);
                setGuestExpiresAt(newGuestExpiresAt);
                localStorage.setItem("xurl_guest_link_history", JSON.stringify({ slug: data.slug, expiresAt: newGuestExpiresAt }));
            } else {
                // Refresh quota automatically
                user.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(d => {
                            if (d.limit) setQuota({ freeLinksCreated: d.freeLinksCreated, paidLinksCreated: d.paidLinksCreated, limit: d.limit, plan: d.plan || "free", planRenewals: d.planRenewals, planTtlHours: d.planTtlHours, expiredLinksCount: d.expiredLinksCount, totalLinksEver: d.totalLinksEver });
                        })
                        .catch(console.error);
                });
            }

            // Dispatch event to instantly sync the History Sidebar
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("linkGenerated"));
            }

            // Fetch preview metadata
            fetch(`/api/preview?url=${encodeURIComponent(url.trim())}`)
                .then(r => r.json())
                .then(p => {
                    if (p && (p.title || p.favicon)) {
                        setPreview(p);
                    }
                })
                .catch(console.error);

        } catch (err) {
            console.error(err);
            clearTimeout(checkSecurityTimeout);
            setLoadingText("");
            setError("Failed to create link. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // STRICT LOADING GATE - All conditions must pass before rendering
    const isStrictlyLoading = 
        authLoading || 
        quotaLoading || 
        !mounted ||
        (user !== null && !quotaFetched);
    const isGuestLocked = !user && guestUsed && !viewingPastLink;

    useEffect(() => {
        if (!isStrictlyLoading) {
            setShowDelayedModuleSkeleton(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShowDelayedModuleSkeleton(true);
        }, 150);

        return () => window.clearTimeout(timeoutId);
    }, [isStrictlyLoading]);

    // Determine if the user has reached their quota limit or is in cooldown
    const isFreeLimitReached = !!(user && quota?.plan === "free" && (
        (quota.freeUsageCount !== undefined && quota.freeMaxUses !== undefined && quota.freeUsageCount >= quota.freeMaxUses) ||
        (quota.cooldownRemainingMs !== undefined && quota.cooldownRemainingMs > 0)
    ));
    const isPaidOverQuota = !!(user && quota && quota.plan !== "free" && quota.paidLinksCreated >= quota.limit);
    const isGuestBlocked = !user && guestUsed && !viewingPastLink;
    const isOverQuota = isFreeLimitReached || isPaidOverQuota || isGuestBlocked;
    const isDisabled = isOverQuota;
    
    // CRITICAL: If still loading, show skeleton immediately to prevent any flash
    if (isStrictlyLoading) {
        return <HomePageSkeleton />;
    }
    const heroCardBase = "w-full bg-card border border-border/70 rounded-2xl p-5 sm:p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)] relative overflow-hidden";
    const statusPillBase = "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold tracking-wide shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-20px_rgba(15,23,42,0.28)]";
    const premiumInputClass = "h-12 bg-background/95 border-border/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)] rounded-xl text-[15px] placeholder:text-muted-foreground/75 focus-visible:border-foreground/20 focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-slate-900/10 focus-visible:shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_16px_32px_-22px_rgba(15,23,42,0.32)] transition-all duration-200";
    const premiumFieldShellBase = "relative flex items-center w-full h-12 rounded-xl border bg-background/95 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 focus-within:shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_16px_32px_-22px_rgba(15,23,42,0.32)]";
    const premiumPrimaryButtonClass = "w-full h-12 rounded-xl py-0 shadow-[0_14px_28px_-18px_rgba(15,23,42,0.55)] bg-foreground text-background hover:-translate-y-0.5 hover:bg-foreground/92 hover:shadow-[0_20px_36px_-20px_rgba(15,23,42,0.58)] active:translate-y-0 font-medium mt-2 transition-all duration-200 relative overflow-hidden";

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
            <Suspense fallback={null}>
                <SearchParamsHandler onFocus={() => setFocusTriggered(true)} />
            </Suspense>
            <TopNavbar isCreateDisabled={isDisabled} />

            <main
                className={`flex-1 flex flex-col w-full px-6 md:px-8 overflow-x-hidden ${isGuestLocked ? "overflow-y-hidden justify-center items-center" : "overflow-y-auto"}`}
                style={isGuestLocked ? { minHeight: "calc(100vh - 64px)" } : undefined}
            >
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`w-full max-w-xl flex flex-col gap-6 ${isGuestLocked ? "items-center" : "m-auto"}`}
                >
                    {!isGuestLocked && (
                        <div className="text-center">
                            <h1 className="text-[40px] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[46px]">
                                Shorten your URL
                            </h1>
                            <p className="mx-auto mt-3 max-w-[34rem] text-sm leading-6 text-muted-foreground/90 sm:text-[15px]">
                                Turn long URLs into clean, shareable links with optional custom aliases in a few quick steps.
                            </p>
                            {!authLoading && (
                                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                                    {user ? (
                                        quota ? (
                                            <>
                                                {/* Free Plan Status - Show usage count and cooldown */}
                                                {quota.plan === "free" && (
                                                    <div className={`${statusPillBase} bg-indigo-50/90 border-indigo-200/80 text-indigo-700`}>
                                                        <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                                                        {quota.freeUsageCount || 0} / {quota.freeMaxUses || 3} free links used
                                                        {quota.cooldownRemainingMs && quota.cooldownRemainingMs > 0 && (
                                                            <>
                                                                <span className="text-indigo-300 mx-0.5">|</span>
                                                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                                Next in {formatCooldown(quota.cooldownRemainingMs)}
                                                            </>
                                                        )}
                                                    </div>
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
                                                    <div className={`${statusPillBase} bg-amber-50/90 border-amber-200/80 text-amber-700`} title={`${quota.expiredLinksCount} links have expired`}>
                                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                        {quota.expiredLinksCount} expired history
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Skeleton className="h-[28px] w-[110px] rounded-full bg-blue-50/50" />
                                                <Skeleton className="h-[28px] w-[140px] rounded-full bg-emerald-50/50" />
                                            </>
                                        )
                                    ) : (
                                        <Link href="/guest-policy" target="_blank" className="group flex items-center px-4 py-1.5 rounded-full bg-amber-50/85 border border-amber-300/40 text-amber-700 hover:bg-amber-100/80 hover:border-amber-400/50 shadow-[0_10px_24px_-18px_rgba(217,119,6,0.4)] hover:shadow-[0_14px_32px_-20px_rgba(217,119,6,0.45)] hover:-translate-y-0.5 transition-all duration-300 text-xs font-semibold tracking-wide cursor-pointer">
                                            <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-600/80 group-hover:text-amber-700 transition-colors" />
                                            <span>1 free link for no login policy</span>
                                            <span className="mx-2 text-amber-300">—</span>
                                            <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600/80 group-hover:text-amber-700 transition-colors" />
                                            <span>Expires in 5m</span>
                                            <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-amber-500/80 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

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
                                    <Input
                                        ref={inputRef}
                                        type="url"
                                        placeholder="https://example.com/very-long-url"
                                        value={url}
                                        onChange={handleUrlChange}
                                        onPaste={handleUrlPaste}
                                        disabled={isDisabled || loading}
                                        onKeyDown={(e) => e.key === "Enter" && isValidUrl && handleShorten()}
                                        className={`${premiumInputClass} ${highlightInput ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/10" : ""
                                            }`}
                                    />
                                </div>

                                <div className={`flex flex-col gap-1.5 ${isOverQuota ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="text-xs font-medium text-foreground px-1 flex items-center gap-2">
                                        <span>Custom Alias</span>
                                        {(() => {
                                            // Dynamic badge based on user state
                                            if (!user) {
                                                // Guest: show that a paid plan is needed
                                                return (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-sm border border-amber-200/50">
                                                        <Lock className="w-2.5 h-2.5" /> Paid Plan
                                                    </span>
                                                );
                                            }
                                            if (quota && quota.plan !== 'free') {
                                                // Paid user: show their current plan name
                                                return (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-sm border border-emerald-200/50">
                                                        <Check className="w-2.5 h-2.5" /> {quota.plan}
                                                    </span>
                                                );
                                            }
                                            // Free plan user: show upgrade hint
                                            return (
                                                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-sm border border-slate-200/50">
                                                    <Lock className="w-2.5 h-2.5" /> Starter+
                                                </span>
                                            );
                                        })()}
                                    </label>
                                    <div className={`${premiumFieldShellBase} ${aliasStatus === "taken" || aliasStatus === "invalid"
                                        ? "border-red-200 focus-within:ring-red-500"
                                        : "border-border/80 focus-within:border-foreground/20 focus-within:ring-slate-900/10"
                                        } ${(isDisabled || loading || !user || (quota && quota.plan === 'free')) ? "bg-muted/50 cursor-not-allowed" : ""}`}>
                                        <span className="pl-3 pr-1 text-muted-foreground text-sm select-none pointer-events-none whitespace-nowrap">
                                            {shortDomain} /
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={!user ? "Sign in with a paid plan" : (quota && quota.plan === 'free') ? "Upgrade to Starter+ to unlock" : "type-alias"}
                                            value={alias}
                                            onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                                            disabled={isDisabled || loading || !user || (quota != null && quota.plan === 'free')}
                                            onKeyDown={(e) => e.key === "Enter" && !(!user) && isValidUrl && aliasStatus !== "checking" && aliasStatus !== "taken" && aliasStatus !== "invalid" && handleShorten()}
                                            className={`flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground h-full disabled:cursor-not-allowed ${alias.trim() ? "pr-[130px] sm:pr-[220px]" : "pr-3"
                                                }`}
                                        />
                                        {alias.trim() && (
                                            <div className={`absolute right-3 flex items-center select-none pointer-events-none pl-1 ${isDisabled || loading || !user ? "bg-transparent" : "bg-background"}`}>
                                                {aliasStatus === "checking" && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> checking...</span>}
                                                {aliasStatus === "available" && <span className="text-xs text-emerald-600 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> available</span>}
                                                {aliasStatus === "taken" && <span className="text-xs text-red-500 flex items-center gap-1.5">already claimed — try another</span>}
                                                {aliasStatus === "invalid" && <span className="text-xs text-red-500 flex items-center gap-1.5">invalid format</span>}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground px-1 mt-0.5">
                                        {!user ? (
                                            <span className="text-amber-600/90 font-medium tracking-tight">Sign in with a paid plan to create custom aliases.</span>
                                        ) : quota && quota.plan === 'free' ? (
                                            <span className="text-amber-600/90 font-medium tracking-tight">Upgrade to Starter or above to unlock custom aliases.</span>
                                        ) : (
                                            "You can create your own alias or leave it empty — the system will generate one."
                                        )}
                                    </p>
                                </div>

                                {isOverQuota ? (
                                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-xl p-6 text-center shadow-[inset_0_4px_24px_rgba(0,0,0,0.02)]">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3 ring-4 ring-emerald-50/50">
                                            <Lock className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        
                                        {/* Guest limit */}
                                        {isGuestBlocked ? (
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
                                                        onClick={() => setViewingPastLink(true)}
                                                        variant="outline"
                                                        className="mt-2 w-full max-w-[240px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 rounded-lg"
                                                    >
                                                        <Link2 className="w-4 h-4 mr-2" />
                                                        See your created link
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
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </main>

            <RateLimitModal
                isOpen={isRateLimited}
                onClose={() => setIsRateLimited(false)}
            />

            {!isGuestLocked && <HomeFooter />}
        </div>
    );
}
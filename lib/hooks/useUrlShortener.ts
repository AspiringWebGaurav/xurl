import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { env } from "@/lib/env";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { getDeviceFingerprint, getOrCreateGuestSessionId } from "@/lib/utils/fingerprint";
import { toast } from "sonner";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";
import { useRouter } from "next/navigation";
import type { GuestQuotaResult } from "@/lib/server/quota-check";

export interface UserQuotaState {
    plan?: string;
    limit?: number;
    activeLinks?: number;
    linksCreated?: number;
    freeUsageCount?: number;
    freeMaxUses?: number;
    cooldownRemainingMs?: number;
    canCreateFreeLink?: boolean;
    activeGiftQuotas?: Array<{ id: string; amount: number; expiresAt: number | null; used?: number }>;
    giftUsageCount?: number;
    paidLinksCreated?: number;
    planTtlHours?: number | null;
    expiredLinksCount?: number | null;
    [key: string]: any;
}

export function useUrlShortener(initialGuestStatus: GuestQuotaResult) {
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
    const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
    const previousGuestUsedRef = useRef(!initialGuestStatus.allowed);
    const [guestSessionId, setGuestSessionId] = useState("");
    const unsubGuestRef = useRef<(() => void) | null>(null);
    const [guestLoading, setGuestLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [preview, setPreview] = useState<{ title?: string, favicon?: string } | null>(null);
    const [faviconError, setFaviconError] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [highlightInput, setHighlightInput] = useState(false);
    const [quota, setQuota] = useState<any>(null);
    const [guestExpiresAt, setGuestExpiresAt] = useState<number | null>(initialGuestStatus.expiresIn && initialGuestStatus.expiresIn > 0 ? Date.now() + (initialGuestStatus.expiresIn * 1000) : null);
    const [countdown, setCountdown] = useState<string>("");
    const [viewingPastLink, setViewingPastLink] = useState(false);
    const [focusTriggered, setFocusTriggered] = useState(false);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [showDelayedModuleSkeleton, setShowDelayedModuleSkeleton] = useState(false);
    const [grantNotified, setGrantNotified] = useState(false);
    const [selectedQuota, setSelectedQuotaState] = useState<'free' | 'gift' | null>(null);
    const router = useRouter();

    const setSelectedQuota = (q: 'free' | 'gift') => {
        setSelectedQuotaState(q);
        if (typeof window !== 'undefined') {
            localStorage.setItem('xurl_quota_pref', q);
        }
    };

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
        let quotaAbortController: AbortController | null = null;

        const unsubscribe = onAuthStateChanged(auth, (u) => {
            // Abort any in-flight quota fetch from a previous auth state change
            if (quotaAbortController) {
                quotaAbortController.abort();
                quotaAbortController = null;
            }

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

                quotaAbortController = new AbortController();
                const { signal } = quotaAbortController;

                u.getIdToken()
                    .then(token => fetch("/api/links?pageSize=1", {
                        headers: { "Authorization": `Bearer ${token}` },
                        signal
                    }))
                    .then(r => r.json())
                    .then(d => {
                        if (signal.aborted) return;
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
                                canCreateFreeLink: d.canCreateFreeLink,
                                activeGiftQuotas: d.activeGiftQuotas,
                                giftUsageCount: d.giftUsageCount
                            });

                            // Initialize selectedQuota (prioritize gift, fallback to free)
                            const activeGifts = (d.activeGiftQuotas as Array<{ amount?: number }> | undefined) || [];
                            const totalGiftBonus = activeGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                            const hasGiftsAvailable = totalGiftBonus > (Number(d.giftUsageCount) || 0);
                            const savedPref = typeof window !== 'undefined' ? localStorage.getItem('xurl_quota_pref') : null;

                            if (hasGiftsAvailable && savedPref !== 'free') {
                                setSelectedQuotaState('gift');
                            } else if (d.canCreateFreeLink || savedPref === 'free') {
                                setSelectedQuotaState('free');
                            } else if (hasGiftsAvailable) {
                                setSelectedQuotaState('gift');
                            } else {
                                setSelectedQuotaState('free');
                            }
                        }
                        setQuotaFetched(true);
                    })
                    .catch(err => {
                        if (err?.name === "AbortError") return;
                        console.error("Quota fetch failed", err);
                        setQuotaFetched(true); // Still unblock, but with no quota
                    })
                    .finally(() => {
                        if (!signal.aborted) setQuotaLoading(false);
                    });
            } else {
                // Guest - no quota needed
                setQuota(null);
                setQuotaFetched(true);
                setQuotaLoading(false);

                // Setup live guest session (UUID)
                let sessionId: string | null = null;
                const setupSession = async () => {
                    sessionId = await getOrCreateGuestSessionId();
                };
                void setupSession().then(() => {
                    if (sessionId) {
                        setGuestSessionId(sessionId);

                        if (unsubGuestRef.current) unsubGuestRef.current();

                        unsubGuestRef.current = onSnapshot(doc(db, "guest_sessions", sessionId), (docSnap) => {
                            if (docSnap.exists()) {
                                const data = docSnap.data();
                                if (data.locked) {
                                    setGuestUsed(true);
                                    previousGuestUsedRef.current = true;
                                    setViewingPastLink(false);
                                    if (data.slug && data.expiresAt && data.expiresAt > Date.now()) {
                                        setShortUrl(buildShortUrl(data.slug));
                                        setGuestExpiresAt(data.expiresAt);
                                    } else {
                                        setShortUrl("");
                                        setGuestExpiresAt(null);
                                    }
                                } else {
                                    if (previousGuestUsedRef.current) {
                                        setShowUnlockAnimation(true);
                                        toast.success("Admin has lifted your sign-up lock!", { icon: '🔓', duration: 5000 });
                                        setTimeout(() => setShowUnlockAnimation(false), 3000);
                                        // Keep showing the old link so it doesn't vanish immediately
                                        setViewingPastLink(true);
                                    }
                                    previousGuestUsedRef.current = false;
                                    setGuestUsed(false);
                                }
                            } else {
                                if (previousGuestUsedRef.current) {
                                    setShowUnlockAnimation(true);
                                    toast.success("Admin has lifted your sign-up lock!", { icon: '🔓', duration: 5000 });
                                    setTimeout(() => setShowUnlockAnimation(false), 3000);
                                    // Keep showing the old link so it doesn't vanish immediately
                                    setViewingPastLink(true);
                                }
                                previousGuestUsedRef.current = false;
                                setGuestUsed(false);
                            }
                        }, (err) => {
                            console.error("Guest session sync error:", err);
                        });
                    }
                });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => {
            if (quotaAbortController) quotaAbortController.abort();
            if (unsubGuestRef.current) unsubGuestRef.current();
            unsubscribe();
        };
    }, []);

    // Cleanup old legacy localStorage usage
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("xurl_guest_locked");
            localStorage.removeItem("xurl_guest_link_history");
            sessionStorage.removeItem("xurl_guest_locked");
        }
    }, []);

    useEffect(() => {
        if (!user || grantNotified || typeof window === "undefined") {
            return;
        }

        const raw = localStorage.getItem("xurl_pending_grants_applied");
        if (!raw) {
            return;
        }

        let animFrameId: number | null = null;
        let confettiCanvas: HTMLCanvasElement | null = null;

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
            confettiCanvas = canvas;
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
                        animFrameId = requestAnimationFrame(draw);
                    } else {
                        canvas.remove();
                        confettiCanvas = null;
                    }
                };

                animFrameId = requestAnimationFrame(draw);
            } else {
                canvas.remove();
                confettiCanvas = null;
            }

            localStorage.removeItem("xurl_pending_grants_applied");
            setGrantNotified(true);
        } catch {
            localStorage.removeItem("xurl_pending_grants_applied");
        }

        return () => {
            if (animFrameId !== null) cancelAnimationFrame(animFrameId);
            if (confettiCanvas) confettiCanvas.remove();
        };
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

            // ALWAYS update localStorage with the latest known state from the server check
            // to ensure history is populated even if it's expired
            const historyItem = {
                slug: initialGuestStatus.slug,
                originalUrl: initialGuestStatus.originalUrl || "",
                createdAt: initialGuestStatus.createdAt || Date.now(),
                expiresAt: initialGuestStatus.expiresAt || (Date.now() + (initialGuestStatus.expiresIn ? initialGuestStatus.expiresIn * 1000 : 0))
            };
            localStorage.setItem("xurl_guest_link_history_v2", JSON.stringify([historyItem]));

            if (initialGuestStatus.expiresIn && initialGuestStatus.expiresIn > 0) {
                const expiresAt = Date.now() + (initialGuestStatus.expiresIn * 1000);
                setGuestExpiresAt(expiresAt);

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
                    // Link expired — keep guest LOCKED (lifetime limit enforced by server)
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
            if (!user && guestSessionId) {
                headers["x-guest-session-id"] = guestSessionId;
            }
            if (user) {
                headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
            }

            const res = await fetch("/api/links", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    originalUrl: url.trim(),
                    customSlug: alias.trim() || undefined,
                    quotaPreference: selectedQuota || undefined
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
                
                localStorage.setItem("xurl_guest_link_history_v2", JSON.stringify([{
                    slug: data.slug,
                    originalUrl: url.trim(),
                    createdAt: Date.now(),
                    expiresAt: newGuestExpiresAt
                }]));
            } else {
                // Refresh quota automatically with ALL fields including free plan counters
                user.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
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
                                    // CRITICAL: Free plan specific fields for real-time quota enforcement
                                    freeUsageCount: d.freeUsageCount,
                                    freeMaxUses: d.freeMaxUses,
                                    cooldownRemainingMs: d.cooldownRemainingMs,
                                    canCreateFreeLink: d.canCreateFreeLink,
                                    activeGiftQuotas: d.activeGiftQuotas,
                                    giftUsageCount: d.giftUsageCount
                                });
                                // Initialize selectedQuota (prioritize gift, fallback to free)
                                const activeGifts = (d.activeGiftQuotas as Array<{ amount?: number }> | undefined) || [];
                                const totalGiftBonus = activeGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                                const hasGiftsAvailable = totalGiftBonus > (Number(d.giftUsageCount) || 0);
                                const savedPref = typeof window !== 'undefined' ? localStorage.getItem('xurl_quota_pref') : null;

                                if (hasGiftsAvailable && savedPref !== 'free') {
                                    setSelectedQuotaState('gift');
                                } else if (d.canCreateFreeLink || savedPref === 'free') {
                                    setSelectedQuotaState('free');
                                } else if (hasGiftsAvailable) {
                                    setSelectedQuotaState('gift');
                                } else {
                                    setSelectedQuotaState('free');
                                }
                            }
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

    const freeUsageCount = Number(quota?.freeUsageCount);
    const freeMaxUses = Number(quota?.freeMaxUses);
    const cooldownMs = Number(quota?.cooldownRemainingMs);
    const activeGiftList = (quota?.activeGiftQuotas as Array<{ amount?: number }> | undefined) || [];
    const totalGifts = activeGiftList.reduce((sum, g) => sum + (g.amount || 0), 0);
    const giftUsed = Number(quota?.giftUsageCount) || 0;

    const isFreeLimitReached = !!(user && quota?.plan === "free" && (
        selectedQuota === 'free'
            ? ((quota.freeUsageCount !== undefined && quota.freeMaxUses !== undefined && freeUsageCount >= freeMaxUses) ||
                (cooldownMs > 0))
            : (selectedQuota === 'gift'
                ? (totalGifts <= giftUsed)
                : true)
    ));
    const isPaidOverQuota = !!(user && quota && quota.plan !== "free" && Number(quota.paidLinksCreated) >= Number(quota.limit));
    const isOverQuota = isFreeLimitReached || isPaidOverQuota;
    const isDisabled = isOverQuota;

    const heroCardBase = "w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl p-4 sm:p-8 shadow-[0_25px_60px_-15px_rgba(99,102,241,0.12)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-300 hover:border-indigo-400/40";
    const statusPillBase = "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold tracking-wide shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md";
    const premiumInputClass = "h-12 bg-white/50 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-xl text-[15px] placeholder:text-muted-foreground/70 focus-visible:border-indigo-500/60 focus-visible:bg-white/80 dark:focus-visible:bg-slate-950/90 focus-visible:ring-[3px] focus-visible:ring-indigo-500/20 focus-visible:shadow-[0_0_25px_rgba(99,102,241,0.2)] transition-all duration-200";
    const premiumFieldShellBase = "relative flex items-center w-full h-12 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/60 backdrop-blur-md shadow-sm transition-all duration-200 focus-within:border-indigo-500/60 focus-within:ring-[3px] focus-within:ring-indigo-500/20 focus-within:shadow-[0_0_25px_rgba(99,102,241,0.2)]";
    const premiumPrimaryButtonClass = "w-full h-12 rounded-xl py-0 shadow-[0_12px_28px_-10px_rgba(99,102,241,0.4)] bg-slate-900 dark:bg-indigo-600 text-white hover:-translate-y-0.5 hover:bg-slate-800 dark:hover:bg-indigo-500 hover:shadow-[0_18px_36px_-10px_rgba(99,102,241,0.5)] active:translate-y-0 active:scale-[0.99] font-semibold mt-2 transition-all duration-200 relative overflow-hidden group flex items-center justify-center gap-2";



    return {
        user, setUser, authLoading, quotaLoading, quotaFetched,
        url, setUrl, isValidUrl, setIsValidUrl, shortDomain, setShortDomain, mounted,
        showPasteHint, setShowPasteHint, alias, setAlias, aliasStatus, setAliasStatus,
        shortUrl, setShortUrl, loading, setLoading, loadingText, setLoadingText,
        error, setError, copied, setCopied, guestUsed, setGuestUsed, showUnlockAnimation,
        guestSessionId, guestLoading, showQR, setShowQR, preview, setPreview, faviconError, setFaviconError,
        highlightInput, setHighlightInput, quota, setQuota, guestExpiresAt, setGuestExpiresAt,
        countdown, setCountdown, viewingPastLink, setViewingPastLink, focusTriggered, setFocusTriggered,
        isRateLimited, setIsRateLimited, showDelayedModuleSkeleton, setShowDelayedModuleSkeleton,
        grantNotified, setGrantNotified, selectedQuota, setSelectedQuota, handleGoogleLogin, isLoggingIn,
        checkUrl, handleUrlChange, handleUrlPaste, handleCopy, handleReset, handleShorten, router,
        isStrictlyLoading, heroCardBase, statusPillBase, premiumInputClass, premiumFieldShellBase, premiumPrimaryButtonClass,
        setGuestLoading, isDisabled
    };
}

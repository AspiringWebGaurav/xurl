"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { env } from "@/lib/env";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link2, Loader2, Lock, QrCode, AlertCircle } from "lucide-react";
import QRCode from "react-qr-code";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";

export default function HomePage() {
    const [user, setUser] = useState<User | null>(null);
    const [url, setUrl] = useState("");
    const [isValidUrl, setIsValidUrl] = useState(false);
    const [shortDomain, setShortDomain] = useState("xurl.eu.cc");

    useEffect(() => {
        // Hydrate the actual domain at runtime to avoid Next.js static build inlining bugs
        if (typeof window !== "undefined") {
            const envDomain = env.NEXT_PUBLIC_SHORT_DOMAIN;
            // If the built bundle accidentally baked in "localhost:3000" but we are in production
            if (envDomain.includes("localhost") && window.location.hostname !== "localhost") {
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
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [guestUsed, setGuestUsed] = useState(false);
    const [guestLoading, setGuestLoading] = useState(true);
    const [showQR, setShowQR] = useState(false);
    const [preview, setPreview] = useState<{ title?: string, favicon?: string } | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);
    const [quota, setQuota] = useState<{ created: number, limit: number } | null>(null);
    const [guestExpiresAt, setGuestExpiresAt] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<string>("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) {
                u.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(d => {
                            if (d.limit) setQuota({ created: d.linksCreated, limit: d.limit });
                        })
                        .catch(console.error);
                });
            } else {
                setQuota(null);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (shortUrl && resultRef.current) {
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
        }
    }, [shortUrl]);

    // ── Server-synced guest state (source of truth is Firestore, NOT localStorage) ──
    useEffect(() => {
        if (user) {
            setGuestLoading(false);
            return;
        }

        let cancelled = false;
        setGuestLoading(true);

        const syncGuestState = async () => {
            try {
                const fp = await getDeviceFingerprint();
                const res = await fetch("/api/guest-status", {
                    headers: { "x-device-fingerprint": fp },
                });
                if (cancelled) return;
                const data = await res.json();

                if (data.active && data.slug) {
                    setGuestUsed(true);
                    const expiresAt = Date.now() + (data.expiresIn * 1000);
                    setGuestExpiresAt(expiresAt);

                    // Write-through to localStorage (for HistorySidebar UX only — not trusted)
                    localStorage.setItem("xurl_guest_link_history", JSON.stringify({
                        slug: data.slug,
                        originalUrl: data.originalUrl || "",
                        createdAt: data.createdAt || Date.now(),
                        expiresAt,
                    }));
                } else {
                    setGuestUsed(false);
                    setGuestExpiresAt(null);
                    localStorage.removeItem("xurl_guest_link_history");
                }
            } catch (e) {
                console.error("Failed to sync guest state", e);
            } finally {
                if (!cancelled) setGuestLoading(false);
            }
        };

        syncGuestState();

        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (guestExpiresAt && !user) {
            const updateCountdown = () => {
                const now = Date.now();
                if (guestExpiresAt <= now) {
                    setGuestUsed(false);
                    setGuestExpiresAt(null);
                    localStorage.removeItem("xurl_guest_link_history");
                    setCountdown("");
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
            } catch (e) {
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
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setShortUrl("");
        setUrl("");
        setAlias("");
        setAliasStatus("idle");
        setPreview(null);
        setError("");
    };

    const handleShorten = async () => {
        setError("");
        setShortUrl("");
        setPreview(null);

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

        setLoading(true);

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

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Failed to create link. Please try again.");
                if (data.error === "guest_limit_reached" && data.expiresIn) {
                    setGuestUsed(true);
                    const expiresAt = Date.now() + (data.expiresIn * 1000);
                    setGuestExpiresAt(expiresAt);

                    if (data.slug && data.originalUrl) {
                        localStorage.setItem("xurl_guest_link_history", JSON.stringify({
                            slug: data.slug,
                            originalUrl: data.originalUrl,
                            createdAt: data.createdAt || Date.now(),
                            expiresAt: expiresAt
                        }));
                        const generated = buildShortUrl(data.slug);
                        setShortUrl(generated);
                        // Trigger history update to show the sidebar button
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("linkGenerated"));
                        }
                    } else {
                        localStorage.setItem("xurl_guest_link_history", JSON.stringify({
                            createdAt: Date.now(),
                            expiresAt: expiresAt
                        }));
                    }
                }
                return;
            }

            const generated = buildShortUrl(data.slug);
            setShortUrl(generated);

            // Auto copy
            handleCopy(generated);

            // Dispatch event to instantly sync the History Sidebar
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("linkGenerated"));
            }

            if (!user) {
                const newGuestExpiresAt = Date.now() + (2 * 60 * 60 * 1000);
                localStorage.setItem("xurl_guest_link_history", JSON.stringify({
                    slug: data.slug,
                    originalUrl: url.trim(),
                    createdAt: Date.now(),
                    expiresAt: newGuestExpiresAt
                }));
                setGuestUsed(true);
                setGuestExpiresAt(newGuestExpiresAt);
            } else {
                // Refresh quota automatically
                user.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(d => {
                            if (d.limit) setQuota({ created: d.linksCreated, limit: d.limit });
                        })
                        .catch(console.error);
                });
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
            setError("Failed to create link. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const isDisabled = (!user && guestUsed) && !shortUrl;

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <TopNavbar />

            <main className="flex-1 flex flex-col w-full px-6 md:px-8 py-12 overflow-x-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-xl flex flex-col gap-6 m-auto"
                >
                    <div className="text-center">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Shorten your URL
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            {user
                                ? quota
                                    ? `Links expire after 12 hours. ${quota.created} / ${quota.limit} links created.`
                                    : "Links expire after 12 hours. Create up to 1000 links."
                                : "Guest link expires in 2 hours."}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {(!user && guestLoading) ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm flex flex-col items-center justify-center min-h-[290px]"
                            >
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </motion.div>
                        ) : !shortUrl ? (
                            isDisabled ? (
                                <motion.div
                                    key="limit"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="w-full bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm flex flex-col items-center justify-center gap-3 min-h-[290px] text-center"
                                >
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                                        <Lock className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground tracking-tight">Guest Limit Reached</h3>
                                    <p className="text-sm text-muted-foreground max-w-[280px]">
                                        You have already claimed 1 free link as per our without login policy. Sign in to create more links.
                                    </p>

                                    {countdown && (
                                        <div className="mt-2 py-2 px-4 bg-muted/50 rounded-lg border border-border">
                                            <p className="text-xs text-muted-foreground mb-1">Your temporary link expires in:</p>
                                            <p className="font-mono text-xl font-medium tracking-wider text-foreground">{countdown}</p>
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="w-full bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 min-h-[290px] justify-center relative overflow-hidden"
                                >
                                    <div className="flex flex-col gap-1.5 border border-transparent focus-within:border-ring/20 rounded-lg transition-colors">
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
                                            type="url"
                                            placeholder="https://example.com/very-long-url"
                                            value={url}
                                            onChange={handleUrlChange}
                                            onPaste={handleUrlPaste}
                                            disabled={isDisabled || loading}
                                            onKeyDown={(e) => e.key === "Enter" && isValidUrl && handleShorten()}
                                            className="h-12 bg-background border-border shadow-sm rounded-lg text-sm focus-visible:ring-1 focus-visible:ring-foreground transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5 border border-transparent focus-within:border-ring/20 rounded-lg transition-colors">
                                        <label className="text-xs font-medium text-foreground px-1 flex justify-between items-center">
                                            <span>Custom Alias {!user ? <Lock className="inline w-3 h-3 ml-1 text-muted-foreground" /> : "(Optional)"}</span>
                                        </label>
                                        <div className={`relative flex items-center w-full h-12 bg-background shadow-sm rounded-lg border focus-within:ring-1 transition-all ${aliasStatus === "taken" || aliasStatus === "invalid"
                                            ? "border-red-200 focus-within:ring-red-500"
                                            : "border-border focus-within:ring-foreground"
                                            } ${(isDisabled || loading || !user) ? "opacity-50 cursor-not-allowed bg-muted/50" : ""}`}>
                                            <span className="pl-3 pr-1 text-muted-foreground text-sm select-none pointer-events-none whitespace-nowrap">
                                                {shortDomain} /
                                            </span>
                                            <input
                                                type="text"
                                                placeholder={!user ? "Sign in to use custom alias" : "type-alias"}
                                                value={alias}
                                                onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                                                disabled={isDisabled || loading || !user}
                                                onKeyDown={(e) => e.key === "Enter" && !(!user) && isValidUrl && handleShorten()}
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
                                                <span className="text-amber-600/90 font-medium tracking-tight">Custom aliases are only available for signed-in users.</span>
                                            ) : (
                                                "You can create your own alias or leave it empty — the system will generate one."
                                            )}
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleShorten}
                                        disabled={!isValidUrl || isDisabled || loading || aliasStatus === "taken" || aliasStatus === "invalid"}
                                        className="w-full h-12 rounded-lg py-0 shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium mt-2 transition-all relative overflow-hidden"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Link2 className="h-4 w-4 mr-2" />
                                        )}
                                        {loading ? "Shortening..." : "Shorten"}
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
                                </motion.div>
                            )
                        ) : (
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
                                        <code className="flex-1 text-[15px] font-mono text-foreground bg-muted px-4 py-3.5 rounded-lg truncate border border-border select-all">
                                            {shortUrl}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleCopy(shortUrl)}
                                            className="shrink-0 h-12 w-12 border-border hover:bg-muted rounded-lg shadow-sm"
                                            title="Copy link"
                                        >
                                            {copied ? (
                                                <Check className="h-5 w-5 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>

                                    {preview && (
                                        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/50 mb-4">
                                            {preview.favicon ? (
                                                <img src={preview.favicon} alt="" className="w-6 h-6 rounded-sm bg-background" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-sm bg-border flex items-center justify-center shrink-0">
                                                    <Link2 className="w-3 h-3 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{preview.title || "Unknown Title"}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex justify-between items-center border-t border-border/60">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowQR(!showQR)}
                                            className="text-xs text-muted-foreground hover:text-foreground -ml-2 h-8"
                                        >
                                            <QrCode className="h-3.5 w-3.5 mr-1.5" />
                                            {showQR ? "Hide QR Code" : "Show QR Code"}
                                        </Button>
                                        <Button
                                            onClick={handleReset}
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8 font-medium"
                                        >
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
                        )}
                    </AnimatePresence>
                </motion.div>
            </main>

            <AnimatePresence>
                {copied && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 20, x: "-50%" }}
                        className="fixed bottom-8 left-1/2 z-50 bg-foreground text-background text-sm px-4 py-3 rounded-full shadow-xl flex items-center gap-2 font-medium"
                    >
                        <Check className="h-4 w-4 text-emerald-400" />
                        Link copied to clipboard
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="shrink-0 text-center py-4 text-xs text-muted-foreground border-t border-border bg-background">
                XURL &middot; Minimal URL Shortener
            </footer>
        </div>
    );
}

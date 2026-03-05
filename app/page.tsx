"use client";

import { useState, useEffect } from "react";
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
    const [showQR, setShowQR] = useState(false);
    const [preview, setPreview] = useState<{ title?: string, favicon?: string } | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const used = localStorage.getItem("xurl_guest_used");
            if (used) setGuestUsed(true);
        }
    }, []);

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

    const handleShorten = async () => {
        setError("");
        setShortUrl("");
        setShowQR(false);
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
            const headers: Record<string, string> = { "Content-Type": "application/json" };
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
                return;
            }

            const generated = buildShortUrl(data.slug);
            setShortUrl(generated);

            // Auto copy
            handleCopy(generated);

            if (!user) {
                localStorage.setItem("xurl_guest_used", "true");
                setGuestUsed(true);
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

    const isDisabled = !user && guestUsed;

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
            <TopNavbar />

            <main className="flex-1 flex items-center justify-center px-6 md:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-xl flex flex-col gap-6"
                >
                    <div className="text-center">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Shorten your URL
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            {user
                                ? "Links expire after 12 hours. Create up to 1000 links."
                                : "Guest link expires in 2 hours."}
                        </p>
                    </div>

                    <div className="w-full bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
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
                                <span>Custom Alias (Optional)</span>
                            </label>
                            <div className={`relative flex items-center w-full h-12 bg-background shadow-sm rounded-lg border focus-within:ring-1 transition-all ${aliasStatus === "taken" || aliasStatus === "invalid"
                                ? "border-red-200 focus-within:ring-red-500"
                                : "border-border focus-within:ring-foreground"
                                } ${(isDisabled || loading) ? "opacity-50 cursor-not-allowed bg-muted/50" : ""}`}>
                                <span className="pl-3 pr-1 text-muted-foreground text-sm select-none pointer-events-none whitespace-nowrap">
                                    {shortDomain} /
                                </span>
                                <input
                                    type="text"
                                    placeholder="type-alias"
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                                    disabled={isDisabled || loading}
                                    onKeyDown={(e) => e.key === "Enter" && isValidUrl && handleShorten()}
                                    className={`flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground h-full disabled:cursor-not-allowed ${alias.trim() ? "pr-[130px] sm:pr-[220px]" : "pr-3"
                                        }`}
                                />
                                {alias.trim() && (
                                    <div className={`absolute right-3 flex items-center select-none pointer-events-none pl-1 ${isDisabled || loading ? "bg-transparent" : "bg-background"}`}>
                                        {aliasStatus === "checking" && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> checking...</span>}
                                        {aliasStatus === "available" && <span className="text-xs text-emerald-600 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> available</span>}
                                        {aliasStatus === "taken" && <span className="text-xs text-red-500 flex items-center gap-1.5">already claimed — try another</span>}
                                        {aliasStatus === "invalid" && <span className="text-xs text-red-500 flex items-center gap-1.5">invalid format</span>}
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground px-1 mt-0.5">
                                You can create your own alias or leave it empty — the system will generate one.
                            </p>
                        </div>

                        <Button
                            onClick={handleShorten}
                            disabled={!isValidUrl || isDisabled || loading || aliasStatus === "taken" || aliasStatus === "invalid"}
                            className="w-full h-12 rounded-lg py-0 shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium mt-2 transition-all"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Link2 className="h-4 w-4 mr-2" />
                            )}
                            {loading ? "Shortening..." : "Shorten"}
                        </Button>
                    </div>

                    <AnimatePresence mode="popLayout">
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-lg border border-red-100"
                            >
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="popLayout">
                        {shortUrl && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                className="w-full bg-card border border-border rounded-xl p-5 shadow-sm space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                        Your short link
                                    </p>
                                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Link copied
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm font-mono text-foreground bg-muted px-4 py-3 rounded-lg truncate border border-border select-all">
                                        {shortUrl}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleCopy(shortUrl)}
                                        className="shrink-0 h-11 w-11 border-border hover:bg-muted rounded-lg"
                                        title="Copy link"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>

                                {preview && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50"
                                    >
                                        {preview.favicon ? (
                                            <img src={preview.favicon} alt="" className="w-6 h-6 rounded-sm bg-background" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-sm bg-border flex items-center justify-center">
                                                <Link2 className="w-3 h-3 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{preview.title || "Unknown Title"}</p>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="pt-2 flex justify-between items-center border-t border-border">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQR(!showQR)}
                                        className="text-xs text-muted-foreground hover:text-foreground -ml-2"
                                    >
                                        <QrCode className="h-4 w-4 mr-1.5" />
                                        {showQR ? "Hide QR" : "Show QR"}
                                    </Button>
                                </div>

                                <AnimatePresence>
                                    {showQR && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden flex flex-col items-center gap-3 pt-2"
                                        >
                                            <div className="bg-white p-3 rounded-xl border border-border/50 shadow-sm">
                                                <QRCode value={shortUrl} size={160} />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Scan this QR code or download it.</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Guest Lock Notice */}
                    {isDisabled && !shortUrl && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg"
                        >
                            <Lock className="h-4 w-4" />
                            <span>Sign in to create more links.</span>
                        </motion.div>
                    )}
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

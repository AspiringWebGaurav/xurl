"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { signOut, signInWithGoogle, releasePopupLock } from "@/services/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { History, LogOut, Loader2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { HistorySidebar } from "./HistorySidebar";

interface TopNavbarProps {
    isCreateDisabled?: boolean;
}

export function TopNavbar({ isCreateDisabled = false }: TopNavbarProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");
    const [hasNewHistory, setHasNewHistory] = useState(false);
    const [hasGuestHistory, setHasGuestHistory] = useState(false);
    const [linkCount, setLinkCount] = useState<number | null>(null);
    const [pulseBadge, setPulseBadge] = useState(false);

    useEffect(() => {
        const checkGuestHistory = () => {
            const h = localStorage.getItem("xurl_guest_link_history");
            if (h) {
                try {
                    const parsed = JSON.parse(h);
                    if (parsed.expiresAt > Date.now()) {
                        setHasGuestHistory(true);
                        setLinkCount(prev => prev === null ? 1 : prev);
                    } else {
                        setHasGuestHistory(false);
                        setLinkCount(prev => prev === null ? 0 : prev);
                    }
                } catch {
                    setHasGuestHistory(false);
                    setLinkCount(prev => prev === null ? 0 : prev);
                }
            } else {
                setHasGuestHistory(false);
                setLinkCount(prev => prev === null ? 0 : prev);
            }
        };

        checkGuestHistory(); // Initial check

        const handleLinkGenerated = () => {
            setHasNewHistory(true);
            checkGuestHistory(); // Recheck when a link is generated
            setLinkCount(prev => prev !== null ? prev + 1 : 1);
            setPulseBadge(true);
            setTimeout(() => setPulseBadge(false), 200);
        };

        window.addEventListener("linkGenerated", handleLinkGenerated);
        return () => window.removeEventListener("linkGenerated", handleLinkGenerated);
    }, []);

    const resetLoginState = () => {
        setIsLoggingIn(false);
        setShowOverlay(false);
        releasePopupLock();
    };

    const handleGoogleLogin = async () => {
        if (isLoggingIn) return;

        setIsLoggingIn(true);
        setOverlayMessage("Connecting to Google...");

        let handled = false;

        const timeoutId = setTimeout(() => {
            if (!handled) setShowOverlay(true);
        }, 150);

        const blockedTimeout = setTimeout(() => {
            if (!handled) {
                handled = true;
                releasePopupLock();
                cleanup();
                setOverlayMessage(
                    <>
                        Popup blocked — click to retry login
                        <br />
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                resetLoginState();
                                setTimeout(() => handleGoogleLogin(), 50);
                            }}
                            className="underline cursor-pointer hover:text-foreground transition-colors"
                        >
                            Open login
                        </span>
                    </>
                );
            }
        }, 10000);

        let focusPollInterval: ReturnType<typeof setInterval>;
        const startPollingTimeout = setTimeout(() => {
            focusPollInterval = setInterval(() => {
                if (document.hasFocus() && !handled) {
                    handled = true;
                    releasePopupLock();
                    cleanup();
                    setOverlayMessage("Login cancelled — returning to dashboard...");
                    setTimeout(() => resetLoginState(), 700);
                }
            }, 50);
        }, 500);

        const cleanup = () => {
            clearTimeout(timeoutId);
            clearTimeout(blockedTimeout);
            clearTimeout(startPollingTimeout);
            if (focusPollInterval) clearInterval(focusPollInterval);
        };

        const { user: loggedInUser, error } = await signInWithGoogle();

        if (handled) return;
        handled = true;
        cleanup();

        if (error) {
            setOverlayMessage("Login cancelled — returning to dashboard...");
            setTimeout(() => resetLoginState(), 700);
        } else if (loggedInUser) {
            setOverlayMessage("Signing in...");
            setTimeout(() => resetLoginState(), 600);
        } else {
            resetLoginState();
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            if (u) {
                u.getIdToken().then(token => {
                    fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(d => {
                            if (d.linksCreated !== undefined) {
                                setLinkCount(d.linksCreated);
                            }
                        })
                        .catch(console.error);
                });
            } else {
                // If not logged in, we rely on the localStorage check to set linkCount for guest
                const h = localStorage.getItem("xurl_guest_link_history");
                setLinkCount(h ? 1 : 0);
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
            <div className="flex items-center gap-6">
                <Logo size="md" />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center">
                    <button
                        onClick={() => window.dispatchEvent(new Event("focusUrlInput"))}
                        disabled={isCreateDisabled}
                        className={`text-[13px] font-medium transition-colors flex items-center gap-1.5 ${isCreateDisabled ? "text-slate-400/50 cursor-not-allowed" : "text-slate-600 hover:text-slate-900"}`}
                    >
                        Create link
                    </button>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-200 mx-1" />
                {!loading && (
                    user ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                className={`relative text-[13px] font-medium h-8 px-2.5 rounded-md border transition-all ${linkCount !== null && linkCount > 0 ? "border-emerald-200/80 shadow-sm text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 hover:border-emerald-300" : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 hover:border-slate-200"
                                    } transition-transform duration-150`}
                            >
                                <History className="h-3.5 w-3.5 mr-1.5" />
                                History
                                <AnimatePresence>
                                    {linkCount !== null && linkCount > 0 && (
                                        <motion.div
                                            key={linkCount}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: pulseBadge ? 1.2 : 1, opacity: 1 }}
                                            transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 15 }}
                                            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-background shadow-sm"
                                        >
                                            {linkCount > 99 ? '99+' : linkCount}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {hasNewHistory && (
                                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    await signOut();
                                }}
                                className="h-8 px-2.5 rounded-md text-[13px] font-medium bg-transparent text-red-500 hover:text-red-600 hover:bg-red-50/60 transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                                Sign out
                            </Button>
                        </>
                    ) : (
                        <>
                            {hasGuestHistory && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                    className={`relative text-[13px] font-medium h-8 px-2.5 rounded-md border transition-all ${linkCount !== null && linkCount > 0 ? "border-emerald-200/80 shadow-sm text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 hover:border-emerald-300" : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 hover:border-slate-200"
                                        } transition-transform duration-150`}
                                >
                                    <History className="h-3.5 w-3.5 mr-1.5" />
                                    History
                                    <AnimatePresence>
                                        {linkCount !== null && linkCount > 0 && (
                                            <motion.div
                                                key={linkCount}
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: pulseBadge ? 1.2 : 1, opacity: 1 }}
                                                transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 15 }}
                                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-background shadow-sm"
                                            >
                                                {linkCount > 99 ? '99+' : linkCount}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {hasNewHistory && (
                                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleGoogleLogin}
                                disabled={isLoggingIn}
                                className="h-8 px-3.5 rounded-md text-[13px] font-medium shadow-sm bg-slate-900 text-slate-50 hover:bg-slate-800 disabled:opacity-80 transition-colors"
                            >
                                {isLoggingIn ? "Connecting..." : "Login"}
                            </Button>
                        </>
                    )
                )}
            </div>
            <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} userId={user?.uid || ""} />

            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-md"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground tracking-tight text-center">
                                {overlayMessage}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}

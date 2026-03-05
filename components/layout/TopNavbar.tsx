"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { signOut, signInWithGoogle, releasePopupLock } from "@/services/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { History, LogOut, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { HistorySidebar } from "./HistorySidebar";

export function TopNavbar() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");

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
        });
        return () => unsubscribe();
    }, []);

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
            <Link href="/" className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background font-bold text-sm">
                    X
                </div>
                <span className="font-semibold tracking-tight text-[15px] text-foreground">XURL</span>
            </Link>
            <div className="flex items-center gap-3">
                {!loading && (
                    user ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(true)} className="text-sm font-medium h-9 px-3 text-muted-foreground hover:text-foreground">
                                <History className="h-4 w-4 mr-2" />
                                History
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    await signOut();
                                }}
                                className="h-9 px-3 text-xs bg-background"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Sign out
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="sm"
                            onClick={handleGoogleLogin}
                            disabled={isLoggingIn}
                            className="h-9 px-4 text-xs font-medium rounded-lg shadow-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-80"
                        >
                            {isLoggingIn ? "Connecting..." : "Login"}
                        </Button>
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


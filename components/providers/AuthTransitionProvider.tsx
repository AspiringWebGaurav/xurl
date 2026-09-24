"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-config";
import { AuthTransitionOverlay, AuthTransitionState } from "@/components/auth/AuthTransitionOverlay";

interface UserLike {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    uid?: string | null;
    metadata?: {
        creationTime?: string;
        lastSignInTime?: string;
    };
}

interface AuthTransitionContextType {
    isTransitioning: boolean;
    triggerLoginTransition: (user: UserLike | null, targetUrl?: string) => Promise<void>;
    triggerLogoutTransition: (onComplete?: () => Promise<void> | void) => Promise<void>;
}

const AuthTransitionContext = createContext<AuthTransitionContextType | null>(null);

export function useAuthTransition() {
    const context = useContext(AuthTransitionContext);
    if (!context) {
        // Fallback stub if used outside provider
        return {
            isTransitioning: false,
            triggerLoginTransition: async () => {},
            triggerLogoutTransition: async () => {},
        };
    }
    return context;
}

export function AuthTransitionProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [transition, setTransition] = useState<AuthTransitionState>({ type: null });
    const isTransitioningRef = useRef(false);

    const triggerLoginTransition = useCallback(
        async (user: UserLike | null, targetUrl?: string): Promise<void> => {
            if (isTransitioningRef.current) return;
            isTransitioningRef.current = true;

            const isAdmin = isAdminEmail(user?.email);
            const transitionType = isAdmin ? "admin_login" : "user_login";

            // Determine whether this is 1st time login vs 2nd time onwards (returning user)
            const userKey = user?.email?.toLowerCase().trim() || user?.uid || "current_user";
            let isFirstLogin = false;

            if (typeof window !== "undefined" && userKey) {
                const storageKey = `xurl_seen_login_${userKey}`;
                const hasBeenSeen = localStorage.getItem(storageKey) === "true";
                if (!hasBeenSeen) {
                    isFirstLogin = true;
                    try {
                        localStorage.setItem(storageKey, "true");
                    } catch {
                        // ignore storage errors
                    }
                }
            } else if (user?.metadata?.creationTime && user?.metadata?.lastSignInTime) {
                const diff = Math.abs(
                    new Date(user.metadata.lastSignInTime).getTime() -
                    new Date(user.metadata.creationTime).getTime()
                );
                if (diff < 15000) {
                    isFirstLogin = true;
                }
            }

            setTransition({
                type: transitionType,
                userName: user?.displayName || undefined,
                userEmail: user?.email || undefined,
                photoURL: user?.photoURL || null,
                isFirstLogin,
                statusText: isAdmin
                    ? (isFirstLogin
                        ? "Initializing master administrator workspace..."
                        : "Verifying administrative identity & security clearance...")
                    : (isFirstLogin
                        ? "Setting up your personalized link dashboard..."
                        : "Synchronizing your dashboard, banked links, and workspace..."),
            });

            // Allow the high-end animation to display at an enjoyable, readable pace
            const displayDuration = isAdmin ? 3000 : 2500;

            await new Promise((resolve) => setTimeout(resolve, displayDuration));

            if (targetUrl) {
                router.push(targetUrl);
                // Hold overlay during router push so no white/black flash is visible
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            setTransition({ type: null });
            isTransitioningRef.current = false;
        },
        [router]
    );

    const triggerLogoutTransition = useCallback(
        async (onComplete?: () => Promise<void> | void): Promise<void> => {
            if (isTransitioningRef.current) return;
            isTransitioningRef.current = true;

            setTransition({
                type: "logout",
                statusText: "Terminating secure credentials and flushing temporary session...",
            });

            // Execute the actual sign-out logic and navigation
            try {
                if (onComplete) {
                    await onComplete();
                }
            } catch (err) {
                console.error("Error during logout transition:", err);
            }

            // Keep overlay for silky smooth exit at readable pace
            await new Promise((resolve) => setTimeout(resolve, 2000));

            setTransition({ type: null });
            isTransitioningRef.current = false;
        },
        []
    );

    // Also support global DOM custom events so deep or legacy components can trigger seamlessly
    useEffect(() => {
        const handleCustomTransition = (e: Event) => {
            const customEvent = e as CustomEvent<{
                type: "login" | "logout";
                user?: UserLike;
                targetUrl?: string;
            }>;
            if (!customEvent.detail) return;

            if (customEvent.detail.type === "login") {
                void triggerLoginTransition(customEvent.detail.user || null, customEvent.detail.targetUrl);
            } else if (customEvent.detail.type === "logout") {
                void triggerLogoutTransition();
            }
        };

        window.addEventListener("xurl:auth-transition", handleCustomTransition);
        return () => window.removeEventListener("xurl:auth-transition", handleCustomTransition);
    }, [triggerLoginTransition, triggerLogoutTransition]);

    return (
        <AuthTransitionContext.Provider
            value={{
                isTransitioning: transition.type !== null,
                triggerLoginTransition,
                triggerLogoutTransition,
            }}
        >
            {children}
            <AuthTransitionOverlay transition={transition} />
        </AuthTransitionContext.Provider>
    );
}

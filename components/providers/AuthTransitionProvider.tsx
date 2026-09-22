"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-config";
import { AuthTransitionOverlay, AuthTransitionState } from "@/components/auth/AuthTransitionOverlay";

interface UserLike {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
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

            setTransition({
                type: transitionType,
                userName: user?.displayName || undefined,
                userEmail: user?.email || undefined,
                photoURL: user?.photoURL || null,
                statusText: isAdmin
                    ? "Initializing administrative command telemetry & security controls..."
                    : "Synchronizing your dashboard, banked links, and workspace...",
            });

            // Allow the high-end animation and sound to play smoothly without page flash
            const displayDuration = isAdmin ? 1400 : 1000;

            await new Promise((resolve) => setTimeout(resolve, displayDuration));

            if (targetUrl) {
                router.push(targetUrl);
                // Hold overlay during router push so no white/black flash is visible
                await new Promise((resolve) => setTimeout(resolve, 350));
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

            // Keep overlay for silky smooth exit
            await new Promise((resolve) => setTimeout(resolve, 850));

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

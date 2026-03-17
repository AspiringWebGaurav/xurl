"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { BannedScreen } from "@/components/layout/BannedScreen";
import type { SubjectAccess, PublicGuestAccess } from "@/types";

type GateState = "booting" | "active" | "locked";

interface AccessInfo {
    status: "active" | "banned";
    reason: string | null;
    expiresAt: number | null;
    version: number;
}

function isAccessBanned(access: AccessInfo | null): boolean {
    if (!access) return false;
    if (access.status !== "banned") return false;
    if (access.expiresAt && access.expiresAt <= Date.now()) return false;
    return true;
}

const FAIL_CLOSED_TIMEOUT_MS = 8000;

export function AccessGate({ children }: { children: React.ReactNode }) {
    const [gate, setGate] = useState<GateState>("booting");
    const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
    const [variant, setVariant] = useState<"banned" | "unknown_locked">("unknown_locked");
    const highestVersion = useRef(0);
    const failClosedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unsubFirestore = useRef<(() => void) | null>(null);

    const clearFailTimer = useCallback(() => {
        if (failClosedTimer.current) {
            clearTimeout(failClosedTimer.current);
            failClosedTimer.current = null;
        }
    }, []);

    const cleanupFirestore = useCallback(() => {
        if (unsubFirestore.current) {
            unsubFirestore.current();
            unsubFirestore.current = null;
        }
    }, []);

    const applyAccessInfo = useCallback((info: AccessInfo) => {
        setAccessInfo(info);
        if (isAccessBanned(info)) {
            setVariant("banned");
            setGate("locked");
        } else {
            setGate("active");
        }
    }, []);

    const subscribeToGuestAccess = useCallback((publicAccessKey: string) => {
        cleanupFirestore();
        highestVersion.current = 0;

        const guestDocRef = doc(db, "public_guest_access", publicAccessKey);
        unsubFirestore.current = onSnapshot(
            guestDocRef,
            (snap) => {
                if (!snap.exists()) {
                    setGate("active");
                    return;
                }

                const data = snap.data() as PublicGuestAccess;

                if (data.version < highestVersion.current) {
                    return;
                }
                highestVersion.current = data.version;

                applyAccessInfo({
                    status: data.status,
                    reason: data.reason,
                    expiresAt: data.expiresAt,
                    version: data.version,
                });
            },
            () => {
                // Snapshot error — guest projection unreadable, allow through
                // (guest enforcement is best-effort; server-side is authoritative)
                setGate("active");
            }
        );
    }, [cleanupFirestore, applyAccessInfo]);

    const bootstrapGuest = useCallback(async () => {
        try {
            const res = await fetch("/api/guest-status");
            if (!res.ok) {
                setGate("active");
                return;
            }
            const data = await res.json();

            if (data.banned) {
                setVariant("banned");
                setGate("locked");
                if (data.publicAccessKey) {
                    subscribeToGuestAccess(data.publicAccessKey);
                }
                return;
            }

            if (data.publicAccessKey) {
                subscribeToGuestAccess(data.publicAccessKey);
            } else {
                setGate("active");
            }
        } catch {
            // Guest bootstrap failed — allow through (best-effort)
            setGate("active");
        }
    }, [subscribeToGuestAccess]);

    useEffect(() => {
        failClosedTimer.current = setTimeout(() => {
            setGate((prev) => {
                if (prev === "booting") {
                    setVariant("unknown_locked");
                    return "locked";
                }
                return prev;
            });
        }, FAIL_CLOSED_TIMEOUT_MS);

        const unsubAuth = onAuthStateChanged(auth, (user: User | null) => {
            clearFailTimer();
            cleanupFirestore();

            if (!user) {
                highestVersion.current = 0;
                setAccessInfo(null);
                bootstrapGuest();
                return;
            }

            const userDocRef = doc(db, "users", user.uid);
            unsubFirestore.current = onSnapshot(
                userDocRef,
                (snap) => {
                    if (!snap.exists()) {
                        setGate("active");
                        return;
                    }

                    const data = snap.data();
                    const access = data?.access as SubjectAccess | undefined;

                    if (!access) {
                        setGate("active");
                        return;
                    }

                    if (access.version < highestVersion.current) {
                        return;
                    }
                    highestVersion.current = access.version;

                    applyAccessInfo({
                        status: access.status,
                        reason: access.reason,
                        expiresAt: access.expiresAt,
                        version: access.version,
                    });
                },
                () => {
                    setVariant("unknown_locked");
                    setGate("locked");
                }
            );
        });

        return () => {
            unsubAuth();
            cleanupFirestore();
            clearFailTimer();
        };
    }, [clearFailTimer, cleanupFirestore, applyAccessInfo, bootstrapGuest]);

    if (gate === "booting") {
        return <div className="min-h-screen bg-background" />;
    }

    if (gate === "locked") {
        return (
            <BannedScreen
                variant={variant}
                reason={accessInfo?.reason}
                expiresAt={accessInfo?.expiresAt}
            />
        );
    }

    return <>{children}</>;
}

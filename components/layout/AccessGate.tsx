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

const BOOT_STYLES = `
    @keyframes xurl-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes xurl-scan {
        0%   { left: -40%; width: 40%; }
        100% { left: 140%; width: 40%; }
    }
    @keyframes xurl-dot {
        0%,80%,100% { opacity: .2; transform: scale(.75); }
        40%         { opacity: 1;  transform: scale(1); }
    }
`;

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
                if (data.version < highestVersion.current) return;
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
                if (data.publicAccessKey) subscribeToGuestAccess(data.publicAccessKey);
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
                    if (access.version < highestVersion.current) return;
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
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "#f4f4f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
            >
                <style>{BOOT_STYLES}</style>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "xurl-fadein .4s ease both" }}>

                    {/* Logo — matches navbar */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            background: "#18181b",
                            borderRadius: "7px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>X</span>
                        </div>
                        <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.3px" }}>
                            URL
                        </span>
                    </div>

                    {/* Scanning bar */}
                    <div style={{
                        width: "140px",
                        height: "2px",
                        background: "#e4e4e7",
                        borderRadius: "99px",
                        overflow: "hidden",
                        position: "relative",
                        animation: "xurl-fadein .4s .1s ease both",
                        opacity: 0,
                    }}>
                        <div style={{
                            position: "absolute",
                            top: 0,
                            height: "100%",
                            background: "linear-gradient(90deg, transparent, #18181b, transparent)",
                            borderRadius: "99px",
                            animation: "xurl-scan 1.4s cubic-bezier(.4,0,.6,1) infinite",
                        }} />
                    </div>

                    {/* Dots */}
                    <div style={{ display: "flex", gap: "5px", marginTop: "16px", animation: "xurl-fadein .4s .2s ease both", opacity: 0 }}>
                        {([0, 0.15, 0.3] as const).map((delay, i) => (
                            <div key={i} style={{
                                width: "4px",
                                height: "4px",
                                borderRadius: "50%",
                                background: "#a1a1aa",
                                animation: `xurl-dot 1.2s ${delay}s ease-in-out infinite`,
                            }} />
                        ))}
                    </div>

                </div>
            </div>
        );
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
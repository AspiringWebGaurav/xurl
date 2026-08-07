"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
    ensureUserDocument,
    PROFILE_UPDATED_EVENT,
    type ProfileUpdatedDetail,
} from "@/lib/firebase/user-profile";
import { signOut } from "@/services/auth";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrCreateGuestSessionId } from "@/lib/utils/fingerprint";
import { cn } from "@/lib/utils";
import { History, LogOut, Loader2, ArrowLeft, BarChart3, User as UserIcon, KeyRound, CreditCard, Download, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

import { HistorySidebar } from "./HistorySidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { isAdminEmail } from "@/lib/admin-config";
import { DeveloperModeToggle } from "@/components/dev/DeveloperModeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import type { NotificationRecord } from "@/components/notifications/NotificationItem";
import { UserAvatar } from "@/components/shared/UserAvatar";

interface TopNavbarProps {
    isCreateDisabled?: boolean;
}

export function TopNavbar({ isCreateDisabled = false }: TopNavbarProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");
    const [hasNewHistory, setHasNewHistory] = useState(false);
    const [hasGuestHistory, setHasGuestHistory] = useState(false);
    const [linkCount, setLinkCount] = useState<number | null>(null);
    const [forceSync, setForceSync] = useState(0);
    const [pulseBadge, setPulseBadge] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [isBellShaking, setIsBellShaking] = useState(false);
    const [autoPopupMessage, setAutoPopupMessage] = useState<string | null>(null);
    const [autoOpenActive, setAutoOpenActive] = useState(false);
    const [isNotifHovered, setIsNotifHovered] = useState(false);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const sessionInitializedRef = useRef(false);
    const prevUnreadCountRef = useRef(0);
    const lastHandledCountRef = useRef(0);
    const popupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null); // offline first-load open
    const liveOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // burst collapse timer
    const pendingDeltaRef = useRef(0);
    const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notificationOpenRef = useRef(false);
    const [plan, setPlan] = useState<string>("free");
    const [quota, setQuota] = useState<{ limit: number, currentActive: number, ttlHours: number | "Unlimited" } | null>(null);
    const [pricingLabelIndex, setPricingLabelIndex] = useState(0);
    const [isPricingHovered, setIsPricingHovered] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const isAdminPage = pathname?.startsWith("/admin");
    const pricingLabels = ["Pricing", "Plans"] as const;
    const isDevEnv = process.env.NODE_ENV === "development";
    const isDeveloper = isAdminEmail(user?.email);

    // Auto-close history sidebar when navigating to admin pages
    useEffect(() => {
        if (isAdminPage) {
            setIsHistoryOpen(false);
        }
    }, [isAdminPage]);

    const syncUserHistoryState = useCallback(async (currentUser: User) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            
            setPlan(data.plan || "free");
            
            const currentActive = (data.freeLinksCreated || 0) + (data.paidLinksCreated || 0);
            if (typeof data.limit === "number") {
                setQuota({
                    limit: data.limit,
                    currentActive,
                    ttlHours: data.planTtlHours,
                });
            } else {
                setQuota(null);
            }
        } catch (error) {
            console.error(error);
            setPlan("free");
            setQuota(null);
        }
    }, []);

    useEffect(() => {
        let unsub = () => {};

        const setupLiveSync = async () => {
            try {
                const currentUser = auth.currentUser;
                const { collection, query, where, onSnapshot, getFirestore } = await import("firebase/firestore");
                const db = getFirestore();

                if (currentUser) {
                    const q = query(collection(db, "links"), where("userId", "==", currentUser.uid));
                    unsub = onSnapshot(q, (snapshot) => {
                        let activeCount = 0;
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (!data.expiresAt || data.expiresAt > Date.now()) {
                                activeCount++;
                            }
                        });
                        setLinkCount(snapshot.size);
                        setHasGuestHistory(false);
                        setQuota(prev => prev ? { ...prev, currentActive: activeCount } : null);
                    }, (error) => {
                        console.debug("TopNavbar links listener error (expected on logout):", error);
                    });
                    
                    void syncUserHistoryState(currentUser);
                } else {
                    const sessionId = await getOrCreateGuestSessionId();
                    if (sessionId) {
                        const q = query(collection(db, "links"), where("guestSessionId", "==", sessionId), where("userId", "==", "anonymous"));
                        unsub = onSnapshot(q, (snapshot) => {
                            let activeCount = 0;
                            snapshot.forEach(doc => {
                                const data = doc.data();
                                if (!data.expiresAt || data.expiresAt > Date.now()) {
                                    activeCount++;
                                }
                            });
                            setLinkCount(activeCount);
                            setHasGuestHistory(activeCount > 0);
                        }, (error) => {
                            console.debug("TopNavbar guest links listener error:", error);
                        });
                    } else {
                        setLinkCount(0);
                        setHasGuestHistory(false);
                    }
                }
            } catch (e) {
                console.error("TopNavbar sync error", e);
            }
        };

        // Initialize sync
        void setupLiveSync();

        return () => unsub();
    }, [user, syncUserHistoryState, forceSync]);

    useEffect(() => {
        const handleLinkGenerated = () => {
            setHasNewHistory(true);
            setPulseBadge(true);
            setTimeout(() => setPulseBadge(false), 200);
            if (!auth.currentUser) {
                setForceSync(f => f + 1);
            }
        };

        const handleOpenHistory = () => setIsHistoryOpen(true);

        window.addEventListener("linkGenerated", handleLinkGenerated);
        window.addEventListener("openHistory", handleOpenHistory);
        return () => {
            window.removeEventListener("linkGenerated", handleLinkGenerated);
            window.removeEventListener("openHistory", handleOpenHistory);
        };
    }, []);

    // Unified Google login hook with instant cancel detection
    const { login: handleGoogleLogin, isLoggingIn } = useGoogleLogin({
        showToasts: false, // Use custom overlay instead
        onPopupOpen: () => {
            setOverlayMessage("Connecting to Google...");
            setShowOverlay(true);
        },
        onCancel: () => {
            // Instant cancel - UI resets immediately
            setOverlayMessage("Login cancelled — returning to dashboard...");
            setTimeout(() => setShowOverlay(false), 500);
        },
        onSuccess: () => {
            setOverlayMessage("Signing in...");
            setTimeout(() => setShowOverlay(false), 600);
        },
        onError: (error) => {
            if (error === "auth/popup-blocked") {
                setOverlayMessage(
                    <>
                        Popup blocked — click to retry login
                        <br />
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowOverlay(false);
                                setTimeout(() => handleGoogleLogin(), 50);
                            }}
                            className="underline cursor-pointer hover:text-foreground transition-colors mt-2 inline-block"
                        >
                            Open login
                        </span>
                    </>
                );
            } else {
                setOverlayMessage("Unable to sign in. Please try again.");
                setTimeout(() => setShowOverlay(false), 700);
            }
        }
    });

    useEffect(() => {
        let snapshotUnsub: (() => void) | null = null;
        
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            setHasNewHistory(false);
            setNotifications([]);
            setNotificationCount(0);
            setNotificationOpen(false);
            setAutoPopupMessage(null);
            setAutoOpenActive(false);
            setIsBellShaking(false);
            prevUnreadCountRef.current = 0;
            lastHandledCountRef.current = 0;
            sessionInitializedRef.current = false;
            if (popupDebounceRef.current) {
                clearTimeout(popupDebounceRef.current);
                popupDebounceRef.current = null;
            }
            if (liveOpenTimerRef.current) {
                clearTimeout(liveOpenTimerRef.current);
                liveOpenTimerRef.current = null;
            }
            pendingDeltaRef.current = 0;
            
            if (snapshotUnsub) {
                snapshotUnsub();
                snapshotUnsub = null;
            }

            if (u) {
                void ensureUserDocument(u);
                void syncUserHistoryState(u);
                
                // Realtime Sync Listener - Updates UI instantly on Admin Revoke/Grant or profile change
                snapshotUnsub = onSnapshot(doc(db, "users", u.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        if (userData.plan) {
                            setPlan(String(userData.plan).toLowerCase());
                        }
                        void syncUserHistoryState(u);
                        window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: userData }));
                        window.dispatchEvent(new Event("linkGenerated"));
                    }
                }, (error) => {
                    console.debug("TopNavbar users listener error (expected on logout):", error);
                });
            } else {
                setForceSync(f => f + 1);
                setPlan("free");
                setQuota(null);
            }
        });
        return () => {
            unsubscribe();
            if (snapshotUnsub) snapshotUnsub();
        };
    }, [syncUserHistoryState]);

    const triggerBellShake = useCallback(() => {
        if (shakeTimerRef.current) {
            clearTimeout(shakeTimerRef.current);
        }
        setIsBellShaking(true);
        shakeTimerRef.current = setTimeout(() => {
            setIsBellShaking(false);
        }, 600);
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!user) {
            return;
        }
        setNotificationLoading(true);
        try {
            const itemsRef = collection(db, "notifications", user.uid, "items");
            const notificationsQuery = query(itemsRef, orderBy("createdAt", "desc"), limit(40));
            const snapshot = await getDocs(notificationsQuery);
            const items = snapshot.docs.map((docSnap) => {
                const data = docSnap.data() as NotificationRecord;
                return {
                    ...data,
                    id: data.id ?? docSnap.id,
                };
            });
            setNotifications(items);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setNotificationLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            return;
        }

        const metaRef = doc(db, "users", user.uid, "meta", "notifications");
        const unsubscribe = onSnapshot(metaRef, (snap) => {
            const unreadCount = snap.exists() ? Number(snap.data()?.unreadCount ?? 0) : 0;
            setNotificationCount(unreadCount);

            if (notificationOpenRef.current && unreadCount > prevUnreadCountRef.current) {
                void fetchNotifications();
            }

            if (!sessionInitializedRef.current) {
                sessionInitializedRef.current = true;
                prevUnreadCountRef.current = unreadCount;
                if (unreadCount > 0 && lastHandledCountRef.current < unreadCount) {
                    lastHandledCountRef.current = unreadCount;
                    if (popupDebounceRef.current) {
                        clearTimeout(popupDebounceRef.current);
                    }
                    popupDebounceRef.current = setTimeout(() => {
                        if (notificationOpenRef.current) {
                            return;
                        }
                        setAutoPopupMessage(unreadCount > 1 ? `You received ${unreadCount} new notifications` : null);
                        triggerBellShake();
                        setAutoOpenActive(true);
                        setNotificationOpen(true);
                    }, 1000);
                }
                return;
            }

            if (unreadCount > prevUnreadCountRef.current && lastHandledCountRef.current < unreadCount) {
                const delta = unreadCount - prevUnreadCountRef.current;
                lastHandledCountRef.current = unreadCount;
                if (notificationOpenRef.current) {
                    prevUnreadCountRef.current = unreadCount;
                    return;
                }
                pendingDeltaRef.current += delta;
                if (liveOpenTimerRef.current) {
                    clearTimeout(liveOpenTimerRef.current);
                }
                liveOpenTimerRef.current = setTimeout(() => {
                    const burstDelta = pendingDeltaRef.current;
                    pendingDeltaRef.current = 0;
                    setAutoPopupMessage(burstDelta > 1 ? `You received ${burstDelta} new notifications` : null);
                    triggerBellShake();
                    setAutoOpenActive(true);
                    setNotificationOpen(true);
                    liveOpenTimerRef.current = null;
                }, 120);
            }

            prevUnreadCountRef.current = unreadCount;
        });

        return () => unsubscribe();
        }, [user, fetchNotifications, triggerBellShake]);

    useEffect(() => {
        return () => {
            if (popupDebounceRef.current) {
                clearTimeout(popupDebounceRef.current);
            }
            if (liveOpenTimerRef.current) {
                clearTimeout(liveOpenTimerRef.current);
            }
            if (autoCloseRef.current) {
                clearTimeout(autoCloseRef.current);
            }
            if (shakeTimerRef.current) {
                clearTimeout(shakeTimerRef.current);
            }
            pendingDeltaRef.current = 0;
        };
    }, []);


    useEffect(() => {
        notificationOpenRef.current = notificationOpen;
        if (notificationOpen) {
            void fetchNotifications();
        }
    }, [notificationOpen, fetchNotifications]);

    useEffect(() => {
        if (!notificationOpen || !autoOpenActive) {
            return;
        }

        if (autoCloseRef.current) {
            clearTimeout(autoCloseRef.current);
        }

        if (isNotifHovered) {
            return;
        }

        autoCloseRef.current = setTimeout(() => {
            setNotificationOpen(false);
            setAutoOpenActive(false);
            setAutoPopupMessage(null);
        }, 3000);
    }, [notificationOpen, autoOpenActive, isNotifHovered]);

    const markNotificationRead = useCallback(async (notification: NotificationRecord) => {
        if (!user || notification.read) {
            return;
        }

        try {
            const notificationRef = doc(db, "notifications", user.uid, "items", notification.id);
            const metaRef = doc(db, "users", user.uid, "meta", "notifications");
            await runTransaction(db, async (tx) => {
                const notifSnap = await tx.get(notificationRef);
                if (!notifSnap.exists()) {
                    return;
                }
                const notifData = notifSnap.data() as NotificationRecord;
                if (notifData.read) {
                    return;
                }
                const metaSnap = await tx.get(metaRef);
                const currentUnread = metaSnap.exists() ? Number(metaSnap.data()?.unreadCount ?? 0) : 0;
                const nextUnread = Math.max(currentUnread - 1, 0);
                tx.update(notificationRef, { read: true, updatedAt: Date.now() });
                tx.set(metaRef, { unreadCount: nextUnread, lastUpdated: Date.now() }, { merge: true });
            });
        } catch (error) {
            console.error("Failed to mark notification as read", error);
        }
    }, [user]);

    const markLocalNotificationRead = useCallback((id: string) => {
        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    }, []);

    const handleNotificationAction = useCallback(
        async (notification: NotificationRecord) => {
            if (!notification.read) {
                markLocalNotificationRead(notification.id);
                void markNotificationRead(notification);
            }

            if (notification.action?.url) {
                setNotificationOpen(false);
                setAutoOpenActive(false);
                setAutoPopupMessage(null);
                setNotificationModalOpen(false);
                router.push(notification.action.url);
            }
        },
        [markLocalNotificationRead, markNotificationRead, router]
    );

    const handleViewAllNotifications = useCallback(() => {
        setNotificationOpen(false);
        setAutoOpenActive(false);
        setAutoPopupMessage(null);
        setNotificationModalOpen(true);
    }, []);

    const handleMarkAllAsRead = useCallback(async () => {
        const unreadItems = notifications.filter((item) => !item.read);
        for (const item of unreadItems) {
            await markNotificationRead(item);
        }
    }, [markNotificationRead, notifications]);

    useEffect(() => {
        const handleProfileUpdated = (event: Event) => {
            const { detail } = event as CustomEvent<ProfileUpdatedDetail>;
            if (!detail?.displayName) {
                return;
            }

            setUser((currentUser) => {
                if (!currentUser) {
                    return currentUser;
                }

                return {
                    ...currentUser,
                    displayName: detail.displayName,
                    email: detail.email ?? currentUser.email,
                    photoURL: detail.photoURL ?? currentUser.photoURL,
                } as User;
            });
        };

        window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener);
        return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener);
    }, []);

    useEffect(() => {
        if (pathname === "/pricing" || isPricingHovered) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setPricingLabelIndex((current) => (current + 1) % pricingLabels.length);
        }, 5000);

        return () => window.clearInterval(intervalId);
    }, [isPricingHovered, pathname, pricingLabels.length]);

    const handleHistoryLinksChange = useCallback((count: number) => {
        setLinkCount(count);
        if (auth.currentUser) {
            setHasGuestHistory(false);
            return;
        }

        setHasGuestHistory(count > 0);
    }, []);

    const getPlanBadgeStyle = (p: string) => {
        switch (p.toLowerCase()) {
            case 'starter': return "bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 border-amber-300/50";
            case 'pro': return "bg-gradient-to-r from-sky-200 to-blue-400 text-blue-900 border-blue-300/50";
            case 'business': return "bg-gradient-to-r from-fuchsia-200 to-pink-400 text-fuchsia-900 border-fuchsia-300/50";
            case 'enterprise': return "bg-gradient-to-r from-emerald-200 to-teal-400 text-emerald-900 border-emerald-300/50";
            case 'bigenterprise': return "bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-slate-700";
            default: return "bg-slate-100 text-slate-600 border-slate-200";
        }
    };

    const navActionBase =
        "inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-all duration-200 ease-out active:scale-[0.98]";
    
    const isLanding = pathname === "/";
    const primaryAction =
        "bg-slate-900 text-slate-50 shadow-sm hover:bg-slate-800 hover:shadow-md";
    const secondaryAction =
        "border border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900";
    
    const apiEnabledForPlan = Boolean(PLAN_CONFIGS[resolvePlanType(plan)].apiAccess);
    const canAccessAdmin = isAdminEmail(user?.email);

    return (
        <header className={cn(
            "flex h-14 shrink-0 items-center px-2 sm:px-6 transition-all duration-300 relative z-[100]",
            isLanding 
                ? "bg-transparent border-transparent" 
                : "border-b border-border/40 bg-background/40 backdrop-blur-xl dark:bg-slate-950/40 dark:border-white/10"
        )}>
            <div className="flex flex-1 items-center gap-3">
                <div className="transition-all duration-300">
                    <Logo 
                        size="md" 
                        href="/" 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = "/";
                        }}
                    />
                </div>
                {user && canAccessAdmin && (
                    <span
                        className="relative inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)] ring-1 ring-emerald-100/80 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_32px_-12px_rgba(16,185,129,0.55)] hover:ring-2 hover:ring-emerald-200/90 hover:bg-gradient-to-r hover:from-emerald-50 hover:via-emerald-100/70 hover:to-white"
                    >
                        <span className="relative h-2.5 w-2.5 flex items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.25)]" />
                        </span>
                        Admin
                    </span>
                )}
                {plan && plan !== "free" && (
                    <div className="relative group flex items-center">
                        <Link href={`/pricing?plan=${plan}`} className={`hidden sm:flex items-center px-2 py-0.5 rounded border shadow-sm text-[10px] font-bold tracking-widest uppercase transition-all duration-300 hover:brightness-105 hover:scale-105 cursor-pointer ${getPlanBadgeStyle(plan)}`}>
                            {plan}
                        </Link>

                        {/* Hover Tooltip Card */}
                        {quota && (
                            <div className="absolute top-full left-0 mt-3.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] translate-y-2 group-hover:translate-y-0">
                                <div className="bg-white border border-slate-200/60 shadow-xl rounded-xl p-3.5 w-[220px] text-xs font-medium relative top-1">
                                    {/* Triangle pointer */}
                                    <div className="absolute -top-1.5 left-5 w-3 h-3 bg-white border-l border-t border-slate-200/60 transform rotate-45"></div>

                                    <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-2 mb-2 relative z-10 bg-white">
                                        <span className="font-bold text-[13px] capitalize tracking-tight">{plan} Plan</span>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${quota.ttlHours === "Unlimited" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"}`}>
                                            {quota.ttlHours === "Unlimited" ? "No Expiry" : (quota.ttlHours < 1 ? `${Math.round(quota.ttlHours * 60)}m TTL` : `${quota.ttlHours}h TTL`)}
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 relative z-10 bg-white">
                                        <div className="flex justify-between items-center px-0.5">
                                            <span className="text-slate-500 font-medium">Links Used</span>
                                            <span className={`font-bold tabular-nums ${quota.currentActive >= quota.limit ? 'text-red-500' : 'text-slate-900'}`}>{quota.currentActive} <span className="text-slate-400 font-medium">/ {quota.limit}</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${quota.currentActive >= quota.limit ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min((quota.currentActive / quota.limit) * 100, 100)}%` }}
                                            />
                                        </div>
                                        {quota.currentActive >= quota.limit && (
                                            <p className="text-[10px] text-red-500/90 leading-tight pt-0.5 font-medium tracking-tight">Limit reached. Upgrade to create more.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-1 items-center justify-center">
                {isDevEnv && isDeveloper && (
                    <DeveloperModeToggle visible={true} />
                )}
            </div>

            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2.5">
                {pathname === "/" || pathname === "/app" ? (
                    <Link
                        href="/pricing"
                        className={cn(
                            navActionBase,
                            secondaryAction
                        )}
                        onMouseEnter={() => setIsPricingHovered(true)}
                        onMouseLeave={() => setIsPricingHovered(false)}
                    >
                        <span className="relative inline-flex h-5 w-[44px] items-center justify-center overflow-hidden">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={pricingLabels[pricingLabelIndex]}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                    className="absolute inset-0 inline-flex items-center justify-center"
                                >
                                    {pricingLabels[pricingLabelIndex]}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                    </Link>
                ) : (
                    <>
                        {pathname === "/pricing" && (
                            <button
                                onClick={() => window.dispatchEvent(new Event('replay-pricing-tour'))}
                                className={cn(
                                    navActionBase,
                                    "hidden sm:flex gap-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 shadow-[0_0_12px_rgba(99,102,241,0.25)] whitespace-nowrap transition-all active:scale-95"
                                )}
                            >
                                <span className="font-bold">▶ Play Tour</span>
                            </button>
                        )}
                        <Link
                            href="/app"
                            className={cn(
                                navActionBase,
                                "gap-1.5 border border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 shadow-[0_0_12px_rgba(16,185,129,0.35)] whitespace-nowrap transition-all active:scale-95"
                            )}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline font-medium">Back to shortener</span>
                            <span className="sm:hidden font-semibold">Home</span>
                        </Link>
                    </>
                )}

                {/* Mobile Analytics Link */}
                {pathname !== "/mobile/analytics" && pathname !== "/analytics" && (
                    <Link
                        href="/mobile/analytics"
                        className={cn(
                            navActionBase,
                            secondaryAction,
                            "sm:hidden gap-1.5 px-2"
                        )}
                    >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="text-[13px] font-medium hidden min-[360px]:inline">Stats</span>
                    </Link>
                )}

                <div className="hidden sm:flex items-center gap-2">
                    {/* Desktop Analytics Link (Visible to all) */}
                    <Link
                        href="/analytics"
                        className={cn(
                            navActionBase,
                            secondaryAction,
                            "gap-1.5"
                        )}
                    >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Analytics
                    </Link>
                    {user && apiEnabledForPlan && (
                        <Link
                            href="/dashboard/api"
                            className={cn(
                                navActionBase,
                                secondaryAction,
                                "gap-1.5"
                            )}
                        >
                            API
                        </Link>
                    )}
                    {user && canAccessAdmin && (
                        <Link
                            href="/admin"
                            className={cn(
                                navActionBase,
                                secondaryAction,
                                "gap-1.5"
                            )}
                        >
                            Admin
                        </Link>
                    )}
                    <button
                        onClick={() => {
                            if (pathname !== "/app") {
                                router.push("/app?focus=true");
                            } else {
                                window.dispatchEvent(new Event("focusUrlInput"));
                            }
                        }}
                        disabled={isCreateDisabled}
                        className={cn(
                            navActionBase,
                            secondaryAction,
                            "min-w-[118px] px-4 whitespace-nowrap shrink-0", // keep width consistent across auth states
                            isCreateDisabled && "cursor-not-allowed opacity-50"
                        )}
                    >
                        Create link
                    </button>
                </div>
                {loading ? (
                    <>
                        <Skeleton className="hidden h-8 w-[88px] rounded-md bg-slate-100 sm:block" />
                        <Skeleton className="h-8 w-8 rounded-full bg-slate-100" />
                    </>
                ) : (
                    user ? (
                        <>
                                {/* Desktop History Button (Hidden on Admin routes) */}
                                {!isAdminPage && (
                                    <button
                                        onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                        className={cn(
                                            navActionBase,
                                            secondaryAction,
                                            "hidden sm:flex relative"
                                        )}
                                    >
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
                                    </button>
                                )}

                                <DropdownMenu open={notificationOpen} onOpenChange={(open) => {
                                    setNotificationOpen(open);
                                    if (!open) {
                                        setAutoOpenActive(false);
                                        setAutoPopupMessage(null);
                                    }
                                }}>
                                    <DropdownMenuTrigger asChild>
                                        <div className="flex items-center">
                                            <NotificationBell
                                                unreadCount={notificationCount}
                                                isShaking={isBellShaking}
                                                isOpen={notificationOpen}
                                                onClick={() => {
                                                    setNotificationOpen((prev) => !prev);
                                                    setAutoOpenActive(false);
                                                    setAutoPopupMessage(null);
                                                }}
                                            />
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        sideOffset={8}
                                        className="mt-2 w-max min-w-[280px] max-w-[360px] rounded-2xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100/80"
                                    >
                                        <div
                                            onMouseEnter={() => setIsNotifHovered(true)}
                                            onMouseLeave={() => setIsNotifHovered(false)}
                                            className="max-h-[360px] overflow-y-auto pr-1"
                                        >
                                            {autoPopupMessage && (
                                                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                                    {autoPopupMessage}
                                                </div>
                                            )}
                                            <NotificationDropdown
                                                notifications={notifications}
                                                loading={notificationLoading}
                                                onAction={handleNotificationAction}
                                                onMarkRead={(notification: NotificationRecord) => {
                                                    if (!notification.read) {
                                                        markLocalNotificationRead(notification.id);
                                                        void markNotificationRead(notification);
                                                    }
                                                }}
                                                onViewAll={handleViewAllNotifications}
                                            />
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Dialog open={notificationModalOpen} onOpenChange={setNotificationModalOpen}>
                                    <DialogContent aria-describedby={undefined} className="max-w-[640px] gap-0 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl" showCloseButton={false}>
                                        <DialogHeader className="flex-row items-center justify-between border-b border-slate-100 px-6 py-4">
                                            <DialogTitle className="text-base font-semibold text-slate-900">Notifications</DialogTitle>
                                            <DialogClose className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                                                ✕
                                            </DialogClose>
                                        </DialogHeader>
                                        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
                                            <NotificationDropdown
                                                notifications={notifications}
                                                loading={notificationLoading}
                                                onAction={handleNotificationAction}
                                                onMarkRead={(notification: NotificationRecord) => {
                                                    if (!notification.read) {
                                                        markLocalNotificationRead(notification.id);
                                                        void markNotificationRead(notification);
                                                    }
                                                }}
                                                showHeader={false}
                                                showFooter={false}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={handleMarkAllAsRead}
                                                className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                                            >
                                                Mark all as read
                                            </button>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="relative h-9 w-9 rounded-full overflow-hidden border border-border/80 shadow-sm hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-all cursor-pointer">
                                            <UserAvatar user={user} className="h-full w-full object-cover text-xs" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 mt-2 p-1.5 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl space-y-1" sideOffset={6}>
                                        {/* User Header Profile Card */}
                                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                                            <UserAvatar user={user} className="h-9 w-9 rounded-full shrink-0 border border-border" />
                                            <div className="flex flex-col min-w-0 flex-1 leading-tight">
                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="font-bold text-xs text-foreground truncate">{user.displayName || "User Account"}</p>
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0 font-mono ${
                                                        plan === "enterprise" || plan === "business"
                                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                            : plan === "pro" || plan === "starter"
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                            : "bg-primary/10 text-primary border-primary/20"
                                                    }`}>
                                                        {plan}
                                                    </span>
                                                </div>
                                                <p className="truncate text-[11px] text-muted-foreground mt-0.5 font-mono">{user.email}</p>
                                            </div>
                                        </div>

                                        <DropdownMenuSeparator className="bg-border/60 my-1" />

                                        {/* Profile */}
                                        <DropdownMenuItem asChild>
                                            <Link href="/profile" className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-muted cursor-pointer transition">
                                                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                                    <UserIcon className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col leading-tight flex-1">
                                                    <span className="font-bold text-foreground">Profile & Account</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">Account preferences & name</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>

                                        {/* API Keys */}
                                        <DropdownMenuItem asChild>
                                            <Link href="/dashboard/api" className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-muted cursor-pointer transition">
                                                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                                    <KeyRound className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col leading-tight flex-1">
                                                    <span className="font-bold text-foreground">API Keys</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">Access keys & developer logs</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>

                                        {/* Billing */}
                                        <DropdownMenuItem asChild>
                                            <Link href="/purchase-history" className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-muted cursor-pointer transition">
                                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                                    <CreditCard className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col leading-tight flex-1">
                                                    <span className="font-bold text-foreground">Billing & Plans</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">Invoices, plans & receipts</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>

                                        {/* Data Export */}
                                        <DropdownMenuItem asChild>
                                            <Link href="/data-export" className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-muted cursor-pointer transition">
                                                <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
                                                    <Download className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col leading-tight flex-1">
                                                    <span className="font-bold text-foreground">Download My Data</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">GDPR / CCPA data export</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>

                                        {/* Admin Panel */}
                                        {canAccessAdmin && (
                                            <DropdownMenuItem asChild>
                                                <Link href="/admin" className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer transition border border-amber-500/20 bg-amber-500/5">
                                                    <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                                                        <ShieldCheck className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div className="flex flex-col leading-tight flex-1">
                                                        <span className="font-bold">Admin Console</span>
                                                        <span className="text-[10px] opacity-80 font-normal">System control panel</span>
                                                    </div>
                                                </Link>
                                            </DropdownMenuItem>
                                        )}

                                        {!isAdminPage && (
                                            <DropdownMenuItem className="sm:hidden flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold hover:bg-muted cursor-pointer transition" onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}>
                                                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                                    <History className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col leading-tight flex-1">
                                                    <span className="font-bold text-foreground">Link History</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">View your short links</span>
                                                </div>
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuSeparator className="bg-border/60 my-1" />

                                        {/* Sign Out */}
                                        <DropdownMenuItem
                                            className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 cursor-pointer transition"
                                            onClick={async () => {
                                                await signOut();
                                                router.push("/");
                                            }}
                                        >
                                            <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/20">
                                                <LogOut className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex flex-col leading-tight flex-1">
                                                <span className="font-bold">Sign Out</span>
                                                <span className="text-[10px] text-rose-400 font-normal">End active session safely</span>
                                            </div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                        </>
                    ) : (
                        <>
                            {hasGuestHistory && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setIsHistoryOpen(true); setHasNewHistory(false); }}
                                    className={`relative text-[13px] font-medium h-8 px-2.5 rounded-md border transition-all duration-150 ${linkCount !== null && linkCount > 0 ? "border-emerald-200/80 shadow-sm text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 hover:border-emerald-300" : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 hover:border-slate-200"}`}
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
                                className={cn(
                                    navActionBase,
                                    primaryAction,
                                    "min-w-[96px] px-4 disabled:opacity-80 disabled:hover:shadow-sm"
                                )}
                            >
                                {isLoggingIn ? "Connecting..." : "Login"}
                            </Button>
                        </>
                    )
                )}
            </div>
            <HistorySidebar
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                userId={user?.uid || ""}
                onLinksChange={handleHistoryLinksChange}
            />

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

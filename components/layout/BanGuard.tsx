"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import { ShieldAlert, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/ui/Logo";

export function BanGuard({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const [isBanned, setIsBanned] = useState(false);
    const [banReason, setBanReason] = useState<string>("");
    
    // Appeal State
    const [appealText, setAppealText] = useState("");
    const [appealLoading, setAppealLoading] = useState(false);
    const [hasPendingAppeal, setHasPendingAppeal] = useState(false);

    const checkBanStatus = async (currentUser: User) => {
        try {
            const token = await currentUser.getIdToken(true);
            const res = await fetch("/api/user/profile", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                let effectivelyBanned = false;

                if (data.banStatus === "banned") {
                    effectivelyBanned = true;
                    if (data.unbanScheduledAt && Date.now() >= data.unbanScheduledAt) {
                        effectivelyBanned = false;
                    }
                }
                
                if (data.banScheduledAt && Date.now() >= data.banScheduledAt) {
                    effectivelyBanned = true;
                    if (data.unbanScheduledAt && data.unbanScheduledAt > data.banScheduledAt && Date.now() >= data.unbanScheduledAt) {
                        effectivelyBanned = false;
                    }
                }

                if (effectivelyBanned) {
                    setIsBanned(true);
                    setBanReason(data.banReason || "Violated terms of service");
                    setHasPendingAppeal(!!data.hasPendingAppeal);
                } else {
                    setIsBanned(false);
                }
            }
        } catch (e) {
            console.error("Failed to check ban status");
        }
    };

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;
        
        const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            
            if (u) {
                setIsChecking(true);
                await checkBanStatus(u); // Initial fetch to hydrate complex state (appeals, email bans)
                setIsChecking(false);
                
                // Ignite the Real-Time Event Engine
                unsubscribeSnapshot = onSnapshot(doc(db, "users", u.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        let effectivelyBanned = false;

                        if (data.banStatus === "banned") {
                            effectivelyBanned = true;
                            if (data.unbanScheduledAt && Date.now() >= data.unbanScheduledAt) {
                                effectivelyBanned = false;
                            }
                        }
                        
                        if (data.banScheduledAt && Date.now() >= data.banScheduledAt) {
                            effectivelyBanned = true;
                            if (data.unbanScheduledAt && data.unbanScheduledAt > data.banScheduledAt && Date.now() >= data.unbanScheduledAt) {
                                effectivelyBanned = false;
                            }
                        }

                        if (effectivelyBanned) {
                            setIsBanned(true);
                            if (data.banReason) setBanReason(data.banReason);
                        } else {
                            setIsBanned(false);
                        }
                    }
                });
            } else {
                setIsBanned(false);
                setIsChecking(false);
            }
        });
        
        const handleFocus = () => {
            if (auth.currentUser && document.visibilityState === "visible") {
                checkBanStatus(auth.currentUser);
            }
        };
        
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleFocus);
        
        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleFocus);
        };
    }, []);

    const submitAppeal = async () => {
        if (!user || appealText.trim().length < 10) return;
        setAppealLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/appeal", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ message: appealText })
            });
            if (res.ok) {
                setHasPendingAppeal(true);
                toast.success("Appeal submitted successfully.");
            } else {
                toast.error("Failed to submit appeal. Please try again.");
            }
        } catch (e) {
            toast.error("Error submitting appeal.");
        } finally {
            setAppealLoading(false);
        }
    };

    if (isChecking) {
        return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background">
                <div className="animate-pulse">
                    <Logo size="lg" href={null} />
                </div>
            </div>
        );
    }

    if (isBanned) {
        return (
            <div className="fixed inset-0 z-[99999] flex flex-col lg:flex-row bg-rose-950 overflow-hidden">
                {/* Left Column: Information */}
                <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24 bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950 relative">
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                    
                    <div className="max-w-xl relative z-10">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 shadow-inner border border-rose-500/20 mb-8">
                            <ShieldAlert className="h-8 w-8 text-rose-500" />
                        </div>
                        
                        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
                            Account Suspended
                        </h1>
                        <p className="text-lg text-rose-200/90 leading-relaxed mb-10">
                            Your access to XURL has been strictly restricted by an administrator due to violations of our policies.
                        </p>
                        
                        {banReason && (
                            <div className="mb-10 rounded-2xl border border-rose-800/60 bg-rose-950/60 p-6 backdrop-blur-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400 mb-2">Reason for Suspension</p>
                                <p className="text-base font-medium text-rose-50">{banReason}</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-300 mb-2">Terms & Conditions of Ban</h3>
                                <p className="text-sm text-rose-200/70 leading-relaxed">
                                    XURL maintains a zero-tolerance policy for abuse, malicious links, and violations of our Terms of Service. When an account is suspended, all associated active links may be immediately deactivated to protect our users and network integrity.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Appeal Form */}
                <div className="w-full lg:w-[480px] xl:w-[560px] bg-black/40 backdrop-blur-3xl border-l border-white/5 flex flex-col justify-center px-6 py-12 lg:px-12 relative">
                    <div className="max-w-md w-full mx-auto">
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-white mb-3">Submit an Appeal</h2>
                            <p className="text-sm text-rose-200/60 leading-relaxed">
                                If you believe your account was suspended in error, you may submit a formal appeal. Our trust and safety team reviews appeals manually. Submitting an appeal does not guarantee your account will be reinstated.
                            </p>
                            <p className="text-xs text-rose-400/80 mt-3 font-medium">Expected review time: 24-48 hours.</p>
                        </div>

                        {hasPendingAppeal ? (
                            <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-6 shadow-inner">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <p className="text-base font-medium text-emerald-400">Appeal Under Review</p>
                                </div>
                                <p className="text-sm text-emerald-500/90 leading-relaxed">
                                    Your appeal has been successfully submitted and is currently pending manual review by our team. Please check back later.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <textarea
                                        value={appealText}
                                        onChange={(e) => setAppealText(e.target.value)}
                                        placeholder="Explain in detail why your account should be reinstated..."
                                        className={`w-full rounded-xl border bg-black/50 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 transition-all resize-none shadow-inner ${
                                            (() => {
                                                const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;
                                                const hasAbuse = abusePattern.test(appealText);
                                                if (hasAbuse) return 'border-red-500 focus:border-red-500 focus:ring-red-500';
                                                return 'border-white/10 focus:border-rose-500 focus:ring-rose-500';
                                            })()
                                        }`}
                                        rows={5}
                                    />
                                    <div className="mt-2 flex justify-between items-center text-xs px-1">
                                        {(() => {
                                            const minLength = 20;
                                            const currentLength = appealText.trim().length;
                                            const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;
                                            const hasAbuse = abusePattern.test(appealText);
                                            
                                            if (hasAbuse) {
                                                return <span className="text-red-400 font-medium">Inappropriate language detected. Please maintain a professional tone.</span>;
                                            } else if (currentLength > 0 && currentLength < minLength) {
                                                return <span className="text-amber-400/80">Minimum {minLength} characters required to submit ({currentLength}/{minLength}).</span>;
                                            } else {
                                                return <span className="text-rose-200/40">Be detailed and specific.</span>;
                                            }
                                        })()}
                                    </div>
                                </div>
                                <button
                                    onClick={submitAppeal}
                                    disabled={
                                        appealLoading || 
                                        appealText.trim().length < 20 || 
                                        /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i.test(appealText)
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-rose-950 transition hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {appealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Submit Appeal</>}
                                </button>
                            </div>
                        )}

                        <div className="mt-12 pt-8 border-t border-white/10">
                            <button 
                                onClick={async () => {
                                    await signOut(auth);
                                    window.location.href = "/";
                                }}
                                className="w-full rounded-xl border border-rose-800/50 bg-transparent px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/50 hover:border-rose-700/50 hover:text-white"
                            >
                                Sign out of this account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Home, BarChart2, Settings, Plus, Loader2, Lock } from 'lucide-react';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";

export default function MobileDashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const { login, isLoggingIn } = useGoogleLogin({ toastId: "mobile-dashboard-login" });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                try {
                    const token = await u.getIdToken();
                    const res = await fetch("/api/analytics/dashboard", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const json = await res.json();
                        setData(json);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col flex-1 w-full bg-background">
                <TopNavbar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
                <MobileBottomNav />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 w-full bg-background overflow-hidden">
                <TopNavbar />
                
                <div className="flex-1 px-6 py-6 pb-32 relative bg-background">
                    <div className="pointer-events-none select-none blur-[5px] opacity-40">
                        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 mb-8 relative overflow-hidden">
                            <h2 className="text-sm font-semibold text-primary mb-1 uppercase tracking-wider">Total Clicks</h2>
                            <p className="text-4xl font-black text-foreground tracking-tight">12,482</p>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Your Links</h3>
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col overflow-hidden pr-4">
                                        <span className="font-semibold text-foreground truncate text-base">xurl.co/promo{i}</span>
                                        <span className="text-muted-foreground text-sm truncate mt-1">https://example.com/very-long-url-that-needs-shortening</span>
                                    </div>
                                    <div className="flex flex-col items-end text-muted-foreground">
                                        <span className="font-bold text-foreground">2.4k</span>
                                        <span className="text-xs">clicks</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/50 backdrop-blur-md z-10">
                        <div className="w-full max-w-sm text-center flex flex-col items-center">
                            <div className="mb-3">
                                <Lock className="h-7 w-7 text-primary drop-shadow-sm" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-foreground mb-2 tracking-tight drop-shadow-sm">
                                Sign in Required
                            </h2>
                            <p className="text-muted-foreground mb-6 text-[14px] leading-relaxed font-medium px-4">
                                Create an account to access your personal dashboard, track all your links, and see real-time performance.
                            </p>
                            
                            <div className="w-full space-y-2.5">
                                <button 
                                    onClick={login}
                                    disabled={isLoggingIn}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-bold rounded-full shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoggingIn ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        "Sign In with Google"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <MobileBottomNav />
            </div>
        );
    }

    const totalClicks = data?.summary?.totalClicks || 0;
    const topLinks = data?.summary?.topLinks || [];

    return (
        <div className="flex flex-col flex-1 w-full bg-background">
            <TopNavbar />

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
                <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <h2 className="text-sm font-semibold text-primary mb-1 uppercase tracking-wider">Total Clicks</h2>
                    <p className="text-4xl font-black text-foreground tracking-tight">{totalClicks.toLocaleString()}</p>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-4">Your Links</h3>
                <div className="flex flex-col gap-4">
                    {topLinks.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border border-dashed rounded-xl bg-slate-50/50">
                            No links created yet.
                        </div>
                    ) : (
                        topLinks.map((link: any, i: number) => (
                            <div key={i} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center active:scale-[0.98] transition-transform touch-manipulation shadow-sm">
                                <div className="flex flex-col overflow-hidden pr-4">
                                    <span className="font-semibold text-foreground truncate text-base">{link.slug}</span>
                                    <span className="text-muted-foreground text-sm truncate mt-1">{link.title || link.slug}</span>
                                </div>
                                <div className="flex flex-col items-end text-muted-foreground">
                                    <span className="font-bold text-foreground">{link.clicks?.toLocaleString() || 0}</span>
                                    <span className="text-xs">clicks</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <MobileBottomNav />
        </div>
    );
}

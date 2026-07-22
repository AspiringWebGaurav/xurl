"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Loader2, Lock, Code2, Webhook, Zap, FileJson } from "lucide-react";
import Link from "next/link";
import { isPaidPlan } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { useRouter } from "next/navigation";

export default function MobileSettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                setDataLoading(true);
                try {
                    await ensureUserDocument(u);
                    const { getDoc, doc } = await import("firebase/firestore");
                    const { db } = await import("@/lib/firebase/config");
                    const userDoc = await getDoc(doc(db, "users", u.uid));
                    const plan = userDoc.data()?.plan || "free";
                    const hasPaid = isPaidPlan(plan as PlanType);
                    setIsPaid(hasPaid);
                    if (hasPaid) {
                        // If they are a paid user, just redirect them to the actual profile settings
                        router.push("/profile");
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setDataLoading(false);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    if (loading || dataLoading || (user && isPaid)) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    // Both guest and free users see the locked tease!
    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
            <TopNavbar />
            
            <main className="flex-1 flex flex-col overflow-hidden px-4 pt-4 bg-background">
                <div className="mb-4">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Unlock API access and webhooks.</p>
                </div>

                <div className="relative flex-1 overflow-hidden">
                    <div className="pointer-events-none select-none blur-[5px] opacity-40">
                        {/* Dummy API Key UI in light mode */}
                        <div className="space-y-2 px-2">
                            <div className="bg-card border border-border p-3 rounded-xl shadow-sm">
                                <h3 className="text-xs font-semibold text-foreground mb-1">Production API Key</h3>
                                <div className="bg-muted font-mono text-[10px] text-muted-foreground p-2 rounded-md break-all">
                                    xurl_live_pk_9a8b7c6d5e4f3g2h1i0j...
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lock Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/50 backdrop-blur-md z-10">
                        <div className="w-full max-w-sm text-center flex flex-col items-center pb-24">
                            <div className="mb-3">
                                <Lock className="h-7 w-7 text-primary drop-shadow-sm" />
                            </div>
                            <h2 className="text-xl font-extrabold text-foreground mb-2 tracking-tight drop-shadow-sm">
                                API & Webhooks Locked
                            </h2>
                            <p className="text-muted-foreground mb-5 text-xs leading-relaxed font-medium px-4">
                                Upgrade to automate your link generation, track events via webhooks, and integrate deeply into your apps.
                            </p>
                            
                            <div className="flex gap-4 w-full justify-center mb-6">
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="bg-emerald-100 p-2 rounded-xl border border-emerald-200 text-emerald-600">
                                        <Code2 className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">REST API</span>
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="bg-blue-100 p-2 rounded-xl border border-blue-200 text-blue-600">
                                        <Webhook className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Webhooks</span>
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="bg-purple-100 p-2 rounded-xl border border-purple-200 text-purple-600">
                                        <FileJson className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">JSON Export</span>
                                </div>
                            </div>

                            <div className="w-full space-y-2.5">
                                <Link href="/pricing" className="block w-full">
                                    <div className="w-full py-3 bg-primary text-primary-foreground text-[13px] font-bold rounded-full shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                                        Unlock API Access
                                    </div>
                                </Link>
                                <Link href="/documentation/api" className="block w-full">
                                    <div className="w-full py-3 bg-transparent border-2 border-primary text-primary hover:bg-primary/5 text-[13px] font-bold rounded-full active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        <FileJson className="w-3.5 h-3.5" />
                                        Read API Docs
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <MobileBottomNav hidePlus={true} />
        </div>
    );
}

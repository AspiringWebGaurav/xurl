"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Loader2, CreditCard, ArrowLeft, Receipt, Gift, ChevronRight, Download, FileText, Clock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { formatTransactionAmount } from "@/lib/currency";
import { XurlInvoiceModal } from "@/components/payments/XurlInvoiceModal";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

type Transaction = {
    id: string;
    userId?: string;
    action: string;
    planType: string;
    linksAllocated: number;
    createdAt: number;
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
    overrideExpiryMs?: number | null;
    expiresAt?: number | null;
    paymentId?: string;
    orderId?: string;
    source?: string;
    amount?: number;
    currency?: string;
    recipientEmail?: string;
    adminEmail?: string;
};

function PurchaseHistoryContent() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [userPlan, setUserPlan] = useState("free");
    const [isCurated, setIsCurated] = useState(false);
    const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<Transaction | null>(null);
    const searchParams = useSearchParams();
    const highlightId = useMemo(() => searchParams.get("highlight"), [searchParams]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await ensureUserDocument(u);
                try {
                    const token = await u.getIdToken();
                    const res = await fetch("/api/user/transactions", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.transactions) {
                        setTransactions(data.transactions);
                        setHasMore(data.transactions.length === 20);
                    }
                    if (data.plan) {
                        setUserPlan(data.plan);
                    }
                    if (data.isCurated) {
                        setIsCurated(true);
                    }
                } catch (e) {
                    console.error("Failed to fetch transactions", e);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleProfileUpdated = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.plan) {
                setUserPlan(customEvent.detail.plan);
            }
            if (customEvent.detail?.isCurated !== undefined) {
                setIsCurated(Boolean(customEvent.detail.isCurated));
            }
            if (user) {
                user.getIdToken()
                    .then(token => fetch("/api/user/transactions", { headers: { "Authorization": `Bearer ${token}` } }))
                    .then(res => res.json())
                    .then(data => {
                        if (data.transactions) setTransactions(data.transactions);
                    })
                    .catch(console.error);
            }
        };

        window.addEventListener("userProfileUpdated", handleProfileUpdated);
        return () => {
            window.removeEventListener("userProfileUpdated", handleProfileUpdated);
        };
    }, [user]);

    const handleLoadMore = async () => {
        if (!user || transactions.length === 0) return;
        setLoadingMore(true);
        try {
            const lastCursor = transactions[transactions.length - 1].createdAt;
            const token = await user.getIdToken();
            const res = await fetch(`/api/user/transactions?cursor=${lastCursor}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.transactions) {
                setTransactions(prev => [...prev, ...data.transactions]);
                setHasMore(data.transactions.length === 20);
            }
        } catch (e) {
            console.error("Failed to load more transactions", e);
        } finally {
            setLoadingMore(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const formatActionBadge = (action: string) => {
        switch (action) {
            case "upgrade": return { label: "Upgrade", class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
            case "renew": return { label: "Renewal", class: "bg-primary/10 text-primary border-primary/20" };
            case "curated_deal":
            case "admin_curated": return { label: "Curated Plan", class: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
            case "admin_grant": return { label: "Admin Gift", class: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
            case "downgrade": return { label: "Downgrade", class: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
            default: return { label: action, class: "bg-muted text-muted-foreground border-border" };
        }
    };

    const formatIST = (timestamp: number) => {
        const d = new Date(timestamp);
        const dateFormatted = d.toLocaleDateString("en-US", {
            timeZone: "Asia/Kolkata",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        const timeFormatted = d.toLocaleTimeString("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        return { date: dateFormatted, time: timeFormatted };
    };

    return (
        <div className="h-[100dvh] flex flex-col justify-between bg-background overflow-hidden select-none">
            {/* Header Navbar */}
            <div className="shrink-0">
                <TopNavbar />
            </div>

            {/* Main Single-Screen Content View (Broad Responsive Enlarge) */}
            <main className="flex-1 min-h-0 w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col justify-center items-center overflow-hidden">
                {!user ? (
                    <div className="w-full max-w-xl text-center p-8 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl space-y-4">
                        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
                        <h1 className="text-xl font-bold text-foreground">Sign in Required</h1>
                        <p className="text-sm text-muted-foreground">Please sign in to view your billing and purchase history.</p>
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="w-full space-y-3 sm:space-y-5"
                    >
                        {/* Header Banner */}
                        <div className="flex items-center justify-between gap-2 px-1">
                            <Link href="/" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition">
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to shortener</span>
                            </Link>

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] sm:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                                    Billing & Receipts
                                </span>
                                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline">
                                    <span>Explore Plans</span>
                                </Link>
                            </div>
                        </div>

                        {/* Active Plan Overview Card */}
                        <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    <Receipt className="h-6 w-6 sm:h-7 sm:w-7" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-base sm:text-xl font-black text-foreground tracking-tight">Active Subscription</h2>
                                        {isCurated || userPlan === "vip" ? (
                                            <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] font-mono flex items-center gap-1">
                                                ADMIN-CURATED Tier
                                            </span>
                                        ) : (
                                            <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                                                {userPlan} Tier
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Managed via secure platform billing integration.</p>
                                </div>
                            </div>

                            <Link href="/pricing">
                                <Button size="sm" className="h-11 sm:h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-sm px-5 shadow-lg w-full sm:w-auto">
                                    <span>Manage Plan</span>
                                    <ChevronRight className="h-4 w-4 ml-1.5" />
                                </Button>
                            </Link>
                        </div>

                        {/* Transactions Table Card */}
                        <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-2xl space-y-3">
                            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-foreground px-1">
                                <span>Billing Transaction Records ({transactions.length})</span>
                                <span className="text-xs text-muted-foreground font-mono">Real-time ledger</span>
                            </div>

                            {transactions.length === 0 ? (
                                <div className="text-center py-10 space-y-3">
                                    <Gift className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                                    <p className="text-sm font-bold text-foreground">No purchase transactions found</p>
                                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                        You are currently operating on the default Free plan tier. Upgrade to unlock bulk short links and API access.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-1">
                                    {transactions.map((tx) => {
                                        const badge = formatActionBadge(tx.action);
                                        const ist = formatIST(tx.createdAt);
                                        const isHighlighted = highlightId === tx.id;

                                        return (
                                            <div 
                                                key={tx.id} 
                                                className={`py-3 px-3 flex items-center justify-between text-xs sm:text-sm transition rounded-2xl ${
                                                    isHighlighted ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase border shrink-0 font-mono ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                    <div className="flex flex-col min-w-0 leading-tight">
                                                        <span className="font-bold text-foreground capitalize truncate">
                                                            {tx.planType === "vip" ? "Admin-Curated Plan" : `${tx.planType} Plan`} ({tx.linksAllocated ? `${tx.linksAllocated.toLocaleString()} links` : "Standard"})
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground font-mono">
                                                                <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                                                <span>{ist.date}</span>
                                                                <span className="text-muted-foreground/40">•</span>
                                                                <span className="font-semibold text-foreground/80">{ist.time}</span>
                                                            </span>
                                                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 tracking-wider">
                                                                IST
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 font-mono text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-foreground text-sm sm:text-base">
                                                            {formatTransactionAmount(tx.amount, tx.currency)}
                                                        </span>
                                                        <span className="text-[10px] text-emerald-500 font-bold hidden sm:inline">
                                                            COMPLETED
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1 sm:gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => downloadInvoicePdf(tx, user)}
                                                            className="h-8 sm:h-8.5 px-3 sm:px-3.5 text-xs font-bold rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition shadow-sm cursor-pointer shrink-0"
                                                            title="Direct Download Official PDF Invoice"
                                                        >
                                                            <Download className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                            <span className="font-sans font-semibold">Download Invoice</span>
                                                        </Button>

                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => setSelectedInvoiceTx(tx)}
                                                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer hidden sm:flex"
                                                            title="Preview Invoice on Screen"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {hasMore && transactions.length > 0 && (
                                <div className="pt-2 text-center">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={handleLoadMore} 
                                        disabled={loadingMore}
                                        className="h-9 sm:h-10 text-xs font-bold px-5 rounded-xl border-border"
                                    >
                                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        <span>Load Older Transactions</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Invoice Preview Modal */}
            {selectedInvoiceTx && (
                <XurlInvoiceModal
                    transaction={selectedInvoiceTx}
                    user={user}
                    onClose={() => setSelectedInvoiceTx(null)}
                />
            )}

            {/* Footer */}
            <div className="shrink-0 hidden md:block">
                <HomeFooter />
            </div>
            <div className="shrink-0 block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}

export default function PurchaseHistoryPage() {
    return (
        <Suspense fallback={
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <PurchaseHistoryContent />
        </Suspense>
    );
}

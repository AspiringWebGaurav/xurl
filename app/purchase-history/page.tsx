"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

type Transaction = {
    id: string;
    action: string;
    planType: string;
    linksAllocated: number;
    createdAt: number;
    paymentId?: string;
    orderId?: string;
};

export default function PurchaseHistoryPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

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
                } catch (e) {
                    console.error("Failed to fetch transactions", e);
                    setError("Failed to load your transaction history.");
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <TopNavbar />
                <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full px-6 py-12">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in Required</h1>
                    <p className="text-slate-500">Please sign in to view your purchase history.</p>
                </main>
            </div>
        );
    }

    const formatAction = (action: string) => {
        switch (action) {
            case "guest_use": return "Guest Usage";
            case "free_use": return "Free Usage";
            case "upgrade": return "Upgrade";
            case "renew": return "Renewal";
            case "downgrade": return "Downgrade";
            case "expire": return "Expired";
            default: return action;
        }
    };

    const formatPlan = (plan: string) => {
        const names: Record<string, string> = {
            free: "Free",
            starter: "Starter",
            pro: "Pro",
            business: "Business",
            enterprise: "Enterprise",
            bigenterprise: "Big Enterprise",
            guest: "Guest"
        };
        return names[plan.toLowerCase()] || plan;
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <TopNavbar />
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Purchase History</h1>
                    <p className="text-slate-500 mt-2">View your past transactions and plan usage over time.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">Date</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Action</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Plan</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Links Granted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                            No transaction history found.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">
                                                {format(t.createdAt, "MMM d, yyyy h:mm a")}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider
                                                    ${t.action === 'upgrade' || t.action === 'renew' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                                                      t.action === 'downgrade' || t.action === 'expire' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                                                      'bg-slate-100 text-slate-600 border border-slate-200'}
                                                `}>
                                                    {formatAction(t.action)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                {formatPlan(t.planType)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                {t.linksAllocated > 0 ? `+${t.linksAllocated}` : t.linksAllocated}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {transactions.length > 0 && hasMore && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : 'Load More'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

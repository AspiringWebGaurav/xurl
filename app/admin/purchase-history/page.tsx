"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";

type Transaction = {
    id: string;
    action: string;
    planType: string;
    linksAllocated: number;
    createdAt: number;
    paymentId?: string;
    orderId?: string;
    source?: string;
    amount?: number;
};

export default function AdminPurchaseHistoryPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);

            if (nextUser) {
                await ensureUserDocument(nextUser);
                try {
                    const token = await nextUser.getIdToken();
                    const res = await fetch("/api/user/transactions", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    if (data.transactions) {
                        setTransactions(data.transactions);
                        setHasMore(data.transactions.length === 20);
                    }
                } catch (loadError) {
                    console.error("Failed to fetch transactions", loadError);
                    setError("Failed to load your transaction history.");
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const canAccess = isAdminEmail(user?.email);

    const handleLoadMore = async () => {
        if (!user || transactions.length === 0) return;
        setLoadingMore(true);
        try {
            const lastCursor = transactions[transactions.length - 1].createdAt;
            const token = await user.getIdToken();
            const res = await fetch(`/api/user/transactions?cursor=${lastCursor}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.transactions) {
                setTransactions((prev) => [...prev, ...data.transactions]);
                setHasMore(data.transactions.length === 20);
            }
        } catch (loadError) {
            console.error("Failed to load more transactions", loadError);
        } finally {
            setLoadingMore(false);
        }
    };

    const formatAction = (action: string) => {
        switch (action) {
            case "guest_use": return "Guest Usage";
            case "free_use": return "Free Usage";
            case "upgrade": return "Upgrade";
            case "renew": return "Renewal";
            case "downgrade": return "Downgrade";
            case "expire": return "Expired";
            case "admin_grant": return "Admin Grant";
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
            guest: "Guest",
        };
        return names[plan.toLowerCase()] || plan;
    };

    if (loading) {
        return (
            <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user || !canAccess) {
        return (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
                <h1 className="text-3xl font-bold text-slate-900">Admin access required</h1>
                <p className="mt-2 text-slate-500">This section is only available to administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchase History</h1>
                <p className="mt-2 text-slate-500">Review transaction history, plan changes, and billing sources without leaving the admin workspace.</p>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap font-medium">Date</th>
                                <th className="px-6 py-4 whitespace-nowrap font-medium">Action</th>
                                <th className="px-6 py-4 whitespace-nowrap font-medium">Plan</th>
                                <th className="px-6 py-4 whitespace-nowrap font-medium">Links Granted</th>
                                <th className="px-6 py-4 whitespace-nowrap font-medium">Source</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        No transaction history found.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <tr key={transaction.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                                            {format(transaction.createdAt, "MMM d, yyyy h:mm a")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${transaction.action === "upgrade" || transaction.action === "renew" || transaction.action === "admin_grant"
                                                ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
                                                : transaction.action === "downgrade" || transaction.action === "expire"
                                                    ? "border border-amber-200/60 bg-amber-50 text-amber-700"
                                                    : "border border-slate-200 bg-slate-100 text-slate-600"
                                                }`}>
                                                {formatAction(transaction.action)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatPlan(transaction.planType)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                            {transaction.linksAllocated > 0 ? `+${transaction.linksAllocated}` : transaction.linksAllocated}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap capitalize text-slate-500">{transaction.source || "-"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500">
                                            {transaction.amount !== undefined ? (transaction.amount === 0 ? "₹0" : `₹${transaction.amount / 100}`) : "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {transactions.length > 0 && hasMore && (
                <div className="flex justify-center">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                            </>
                        ) : "Load More"}
                    </button>
                </div>
            )}
        </div>
    );
}

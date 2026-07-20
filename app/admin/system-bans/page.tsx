"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, RefreshCw, UserCheck, Gift } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type SystemBannedUser = {
    id: string;
    email: string;
    plan: string;
    banReason: string;
    updatedAt: number;
};

export default function AdminSystemBansPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [bannedUsers, setBannedUsers] = useState<SystemBannedUser[]>([]);
    const [fetching, setFetching] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) await ensureUserDocument(u);
            setUser(u);
            setLoading(false);
            if (u && isAdminEmail(u.email)) {
                loadSystemBans(u);
            }
        });
        return () => unsub();
    }, []);

    const loadSystemBans = async (currentUser: User = user!) => {
        if (!currentUser) return;
        setFetching(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/admin/bans/system", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.items) setBannedUsers(data.items);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load system bans.");
        } finally {
            setFetching(false);
        }
    };

    const handleAction = async (uid: string, actionType: "unban_instant", actionName: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/bans/action", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ uid, action: actionType })
            });
            if (res.ok) {
                toast.success(`Successfully applied: ${actionName}`);
                loadSystemBans(user);
            } else {
                const data = await res.json();
                toast.error(`Error: ${data.message}`);
            }
        } catch (e) {
            toast.error("Network error.");
        }
    };

    const handleUnbanAndGift = async (uid: string, email: string) => {
        await handleAction(uid, "unban_instant", "Unban");
        // Navigate to grant plan page with pre-filled email
        router.push(`/admin/grant-plan?email=${encodeURIComponent(email)}`);
    };

    if (loading) return null;
    if (!user || !isAdminEmail(user.email)) return null;

    return (
        <div className="mx-auto w-full px-4 py-4 pb-24 lg:px-8 lg:py-6">
            <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Admin Console</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">System Bans</h1>
                <p className="mt-2 text-base text-slate-600">Review users automatically suspended by the abuse detection system.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50/30 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-rose-500" /> Automated Suspensions
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Users banned for repeated policy violations.</p>
                    </div>
                    <Button 
                        variant="outline"
                        size="icon"
                        onClick={() => user && loadSystemBans(user)}
                        disabled={fetching}
                        className="h-8 w-8 rounded-lg border-slate-200 bg-white text-slate-500 hover:text-slate-900 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4">User Details</th>
                                <th scope="col" className="px-6 py-4">Violation Reason</th>
                                <th scope="col" className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {bannedUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{u.email}</div>
                                        <div className="mt-1 text-xs text-slate-400 font-mono">ID: {u.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-semibold">
                                            {u.banReason}
                                        </div>
                                        <div className="mt-1.5 text-xs text-slate-400">
                                            At: {new Date(u.updatedAt).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 border-emerald-200 h-8 font-medium" onClick={() => handleAction(u.id, "unban_instant", "Unban")}>
                                                <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Unban
                                            </Button>
                                            <Button size="sm" variant="default" className="bg-amber-500 hover:bg-amber-600 text-white h-8 font-medium shadow-sm" onClick={() => handleUnbanAndGift(u.id, u.email)}>
                                                <Gift className="h-3.5 w-3.5 mr-1.5" /> Unban & Gift
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {bannedUsers.length === 0 && !fetching && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        No automated system bans found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

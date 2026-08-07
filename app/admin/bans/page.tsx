"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, CheckCircle, AlertTriangle, Search, RefreshCw, Mail, CalendarClock, UserX, Ghost } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { emitAdminRefresh, useAdminLiveRefresh } from "@/lib/admin/admin-events";

type SearchUser = {
    id: string;
    email: string;
    plan?: string | null;
    banStatus: "none" | "banned";
    banScheduledAt: number | null;
    unbanScheduledAt: number | null;
};

type BanAppeal = {
    id: string;
    userId?: string;
    guestSessionId?: string;
    email: string;
    message: string;
    createdAt: number;
    status: "pending" | "approved" | "rejected";
};

type BannedGuest = {
    guestSessionId: string;
    bannedAt: number;
    bannedBy: string;
};

export default function AdminBansPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // User Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Targeted Email Ban State
    const [targetEmail, setTargetEmail] = useState("");
    const [targetReason, setTargetReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Appeals State
    const [appeals, setAppeals] = useState<BanAppeal[]>([]);
    const [appealsLoading, setAppealsLoading] = useState(false);

    // Banned Guests State
    const [bannedGuests, setBannedGuests] = useState<BannedGuest[]>([]);
    const [guestsLoading, setGuestsLoading] = useState(false);
    const router = useRouter();

    useAdminLiveRefresh(() => {
        if (user && isAdminEmail(user.email)) {
            loadLatestUsers(user);
            loadAppeals(user);
            loadBannedGuests(user);
        }
    });

    useEffect(() => {
        let mounted = true;
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!mounted) return;
            if (u) await ensureUserDocument(u);
            setUser(u);
            setLoading(false);
            if (u && isAdminEmail(u.email)) {
                loadLatestUsers(u);
                loadAppeals(u);
                loadBannedGuests(u);
            }
        });
        
        const handleFocus = () => {
            if (auth.currentUser && isAdminEmail(auth.currentUser.email)) {
                loadLatestUsers(auth.currentUser);
                loadAppeals(auth.currentUser);
                loadBannedGuests(auth.currentUser);
            }
        };
        
        window.addEventListener("focus", handleFocus);
        
        return () => {
            mounted = false;
            unsub();
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    const loadLatestUsers = async (currentUser: User) => {
        setIsSearching(true);
        try {
            const token = await currentUser.getIdToken();
            const [res] = await Promise.all([
                fetch("/api/admin/users/list", {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            const data = await res.json();
            if (data.items) setSearchResults(data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const loadAppeals = async (currentUser: User = user!) => {
        if (!currentUser) return;
        setAppealsLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const [res] = await Promise.all([
                fetch("/api/admin/bans/appeals", {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            const data = await res.json();
            if (data.items) setAppeals(data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setAppealsLoading(false);
        }
    };

    const loadBannedGuests = async (currentUser: User = user!) => {
        if (!currentUser) return;
        setGuestsLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/admin/bans/guest/list", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.items) setBannedGuests(data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setGuestsLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !user) {
            if (user) loadLatestUsers(user);
            return;
        }
        setIsSearching(true);
        try {
            const token = await user.getIdToken();
            const [res] = await Promise.all([
                fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            const data = await res.json();
            if (data.items) setSearchResults(data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const applyAction = async (payload: any) => {
        if (!user) return;
        setActionLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/bans/action", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success("Action applied successfully.");
                if (payload.email === targetEmail) {
                    setTargetEmail("");
                    setTargetReason("");
                }
                loadLatestUsers(user);
                emitAdminRefresh(router);
            } else {
                const data = await res.json();
                toast.error(`Error: ${data.message}`);
            }
        } catch (e) {
            toast.error("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const resolveAppeal = async (appealId: string, action: "approve" | "reject", userId: string, email: string, guestSessionId?: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/bans/appeals", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ appealId, action, userId, email, guestSessionId })
            });
            if (res.ok) {
                toast.success(`Appeal ${action}d successfully.`);
                loadAppeals(user);
                loadLatestUsers(user);
                emitAdminRefresh(router);
            } else {
                toast.error("Failed to process appeal.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred.");
        }
    };

    const handleUnbanGuest = async (guestSessionId: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/bans/guest", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ guestSessionId, action: "unban" })
            });
            if (res.ok) {
                toast.success("Guest device has been unbanned.");
                loadBannedGuests(user);
                emitAdminRefresh(router);
            } else {
                toast.error("Failed to unban guest.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred.");
        }
    };

    if (loading) return null;
    if (!user || !isAdminEmail(user.email)) return null;

    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl p-6 rounded-[28px] border border-slate-200/80 shadow-sm">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Bans & Appeals</h1>
                    <p className="text-sm font-medium text-slate-500">Strictly enforce platform rules across the entire userbase.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                {/* Left Column: Bans & Search (Takes 2 columns on XL screens) */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Target Ban (Enterprise Form) */}
                    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-sm p-6 sm:p-8 mb-8 transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                                <ShieldAlert className="h-5 w-5 text-rose-600 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Target Ban / Instant Suspend</h2>
                                <p className="text-xs font-medium text-slate-500">Manually enforce a platform ban by email address.</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 items-end max-w-4xl">
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Target Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="violator@example.com" 
                                        value={targetEmail}
                                        onChange={(e) => setTargetEmail(e.target.value)}
                                        className="pl-10 h-11 border-slate-200 bg-slate-50 focus:bg-white transition-colors rounded-xl shadow-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Reason for Suspension</label>
                                <Input 
                                    placeholder="Violation of ToS" 
                                    value={targetReason}
                                    onChange={(e) => setTargetReason(e.target.value)}
                                    className="h-11 border-slate-200 bg-slate-50 focus:bg-white transition-colors rounded-xl shadow-sm"
                                />
                            </div>
                            <Button 
                                variant="destructive" 
                                size="lg"
                                disabled={actionLoading || !targetEmail || isAdminEmail(targetEmail)}
                                onClick={() => applyAction({ email: targetEmail, reason: targetReason, action: "ban_instant" })}
                                className="h-11 rounded-xl shadow-md font-semibold tracking-wide w-full sm:w-auto bg-rose-600 hover:bg-rose-700"
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isAdminEmail(targetEmail) ? "Cannot Ban Admin" : "Enforce Ban"}
                            </Button>
                        </div>
                    </div>

                    {/* Live User Search & Directory */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50/30">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                                    <div>
                                        <h2 className="text-lg font-semibold tracking-tight text-slate-900">User Directory</h2>
                                        <p className="text-sm text-slate-500 mt-1">Manage current users and ban statuses.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 max-w-sm w-full relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="Search users by email..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="pl-10 h-10 border-slate-200 rounded-xl bg-white shadow-sm"
                                    />
                                    <Button variant="secondary" onClick={handleSearch} disabled={isSearching} className="h-10 shrink-0 rounded-xl shadow-sm">
                                        Search
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th scope="col" className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                User & Status
                                                <Button 
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => { 
                                                        setSearchQuery("");
                                                        if(user) loadLatestUsers(user); 
                                                    }}
                                                    disabled={isSearching}
                                                    title="Refresh List"
                                                    className="h-7 w-7 rounded-lg border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 shadow-sm transition-all"
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${isSearching ? "animate-spin" : ""}`} />
                                                </Button>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-4 text-right">Administrative Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {searchResults.map(u => {
                                        const isEffectivelyBanned = u.banStatus === "banned" || (u.banScheduledAt && Date.now() >= u.banScheduledAt);
                                        return (
                                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-medium text-slate-900">{u.email}</span>
                                                        {isEffectivelyBanned ? (
                                                            <span className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 tracking-wide">BANNED</span>
                                                        ) : u.banScheduledAt ? (
                                                            <span className="rounded-md bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700 tracking-wide">PENDING BAN</span>
                                                        ) : u.unbanScheduledAt ? (
                                                            <span className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 tracking-wide">MONITORED</span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-400 font-mono">ID: {u.id}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {isAdminEmail(u.email) ? (
                                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-md tracking-wider">SUPER ADMIN</span>
                                                        ) : !isEffectivelyBanned ? (
                                                            <>
                                                                <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shadow-none font-medium h-8" onClick={() => applyAction({ uid: u.id, action: "ban_instant" })}>
                                                                    <UserX className="h-3.5 w-3.5 mr-1.5" /> Instant Ban
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 shadow-none font-medium h-8" onClick={() => applyAction({ uid: u.id, action: "ban_scheduled", scheduledAt: Date.now() + 2 * 60 * 60 * 1000 })}>
                                                                    <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Ban 2h
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 shadow-none font-medium h-8" onClick={() => applyAction({ uid: u.id, action: "unban_instant" })}>
                                                                    Unban
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 shadow-none font-medium h-8" onClick={() => applyAction({ uid: u.id, action: "unban_caution" })}>
                                                                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Unban (Caution)
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {searchResults.length === 0 && !isSearching && (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                                                No users found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Banned Guest Devices */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50/30 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                                    <Ghost className="h-5 w-5 text-slate-400" /> Banned Guest Devices
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Manage suspended anonymous fingerprints.</p>
                            </div>
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={() => user && loadBannedGuests(user)}
                                disabled={guestsLoading}
                                title="Refresh Guests"
                                className="h-8 w-8 rounded-lg border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 shadow-sm transition-all"
                            >
                                <RefreshCw className={`h-4 w-4 ${guestsLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th scope="col" className="px-6 py-4">Guest Device / Fingerprint</th>
                                        <th scope="col" className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {bannedGuests.map(g => (
                                        <tr key={g.guestSessionId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded text-xs">
                                                        {g.guestSessionId.substring(0, 16)}...
                                                    </span>
                                                    <span className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 tracking-wide">BANNED</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400">
                                                    Banned: {new Date(g.bannedAt).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 shadow-none font-medium h-8" onClick={() => handleUnbanGuest(g.guestSessionId)}>
                                                    Unban Device
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {bannedGuests.length === 0 && !guestsLoading && (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                                                No banned guest devices found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Appeals Inbox */}
                <div className="xl:col-span-1">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                        <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">Appeals Inbox</h2>
                                    <p className="text-sm text-slate-500 mt-1">Review suspended user requests.</p>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => { if(user) loadAppeals(user); }}
                                    disabled={appealsLoading}
                                    className="h-10 w-10 border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl shadow-sm bg-white"
                                >
                                    <RefreshCw className={`h-4 w-4 ${appealsLoading ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                        </div>
                        
                        <div className="p-6 flex-1 bg-slate-50/50">
                            {appealsLoading ? (
                                <div className="flex h-40 items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                </div>
                            ) : appeals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[300px]">
                                    <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 shadow-inner">
                                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">Inbox Zero</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-[200px] mx-auto">You're all caught up! No pending appeals to review right now.</p>
                                </div>
                            ) : (
                            <div className="space-y-4">
                                {appeals.map(appeal => (
                                    <div key={appeal.id} className="group bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="rounded bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                                                Pending Review
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">ID: {(appeal.userId || appeal.guestSessionId || "").substring(0,8)}...</span>
                                        </div>
                                        <p className="font-medium text-slate-900 mb-4">{appeal.email}</p>
                                        
                                        <div className="relative">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 rounded-full" />
                                            <p className="pl-4 text-sm text-slate-600 italic whitespace-pre-wrap leading-relaxed">
                                                "{appeal.message}"
                                            </p>
                                        </div>
                                        
                                        <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                                            <Button size="sm" onClick={() => resolveAppeal(appeal.id, "approve", appeal.userId || "", appeal.email, appeal.guestSessionId)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none font-medium">
                                                Lift Ban
                                            </Button>
                                            <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 shadow-none font-medium" onClick={() => resolveAppeal(appeal.id, "reject", appeal.userId || "", appeal.email, appeal.guestSessionId)}>
                                                Keep Ban
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

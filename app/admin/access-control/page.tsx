"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail, isOwnerEmail } from "@/lib/admin-config";
import { Loader2, ShieldCheck, ShieldBan, ShieldOff, Search, ChevronLeft, ChevronRight, Users, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface UserRow {
    id: string;
    email: string;
    plan: string;
    createdAt: number | null;
    activeLinks: number | null;
    access: { status: string; mode?: string; reason?: string; expiresAt?: number | null; version?: number } | null;
}

interface GuestRow {
    id: string;
    guestId: string;
    fingerprintHash: string | null;
    ipHash: string | null;
    firstSeenAt: number | null;
    lastSeenAt: number | null;
    canonicalIdentityStrength: string;
    access: { status: string; mode?: string; reason?: string; expiresAt?: number | null; version?: number } | null;
}

type BanTarget = {
    subjectType: "user" | "guest";
    subjectId: string;
    subjectEmail?: string;
    label: string;
};

const DURATION_OPTIONS = [
    { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
    { value: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
    { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
    { value: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
    { value: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
    { value: "permanent", label: "Permanent", ms: 0 },
] as const;

export default function AccessControlPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Users state
    const [users, setUsers] = useState<UserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [userPage, setUserPage] = useState(0);
    const [userPages, setUserPages] = useState<{ items: UserRow[]; nextCursor: number | null }[]>([]);

    // Guests state
    const [guests, setGuests] = useState<GuestRow[]>([]);
    const [guestsLoading, setGuestsLoading] = useState(false);

    // Ban modal state
    const [banTarget, setBanTarget] = useState<BanTarget | null>(null);
    const [banOpen, setBanOpen] = useState(false);
    const [banReason, setBanReason] = useState("");
    const [banDuration, setBanDuration] = useState("permanent");
    const [banLoading, setBanLoading] = useState(false);
    const [banError, setBanError] = useState("");

    // Unban state
    const [unbanLoading, setUnbanLoading] = useState<string | null>(null);

    // Status message
    const [statusMsg, setStatusMsg] = useState("");

    const canAccess = isAdminEmail(user?.email);
    const isOwner = isOwnerEmail(user?.email);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u) await ensureUserDocument(u);
        });
        return () => unsub();
    }, []);

    const fetchUsers = useCallback(async (cursor?: number | null) => {
        if (!user) return null;
        setUsersLoading(true);
        try {
            const token = await user.getIdToken();
            const cursorParam = cursor ? `&cursor=${cursor}` : "";
            const searchParam = userSearch ? `&q=${encodeURIComponent(userSearch)}` : "";
            const endpoint = userSearch
                ? `/api/admin/users/search?q=${encodeURIComponent(userSearch)}`
                : `/api/admin/users/list?limit=20${cursorParam}`;
            const res = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !Array.isArray(data.items)) return null;
            return { items: data.items as UserRow[], nextCursor: data.nextCursor ?? null };
        } catch {
            return null;
        } finally {
            setUsersLoading(false);
        }
    }, [user, userSearch]);

    const loadUsers = useCallback(async () => {
        const page = await fetchUsers(null);
        if (page) {
            setUserPages([page]);
            setUserPage(0);
            setUsers(page.items);
        }
    }, [fetchUsers]);

    const fetchGuests = useCallback(async () => {
        if (!user) return;
        setGuestsLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/access-control/guests", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.items)) {
                setGuests(data.items as GuestRow[]);
            }
        } catch {
            // ignore
        } finally {
            setGuestsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && canAccess) {
            loadUsers();
            fetchGuests();
        }
    }, [user, canAccess, loadUsers, fetchGuests]);

    useEffect(() => {
        if (!user || !canAccess) return;
        const timer = setTimeout(() => {
            loadUsers();
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch]);

    const handleNextUserPage = async () => {
        const current = userPages[userPage];
        if (!current?.nextCursor) return;
        const nextIdx = userPage + 1;
        if (userPages[nextIdx]) {
            setUserPage(nextIdx);
            setUsers(userPages[nextIdx].items);
            return;
        }
        const page = await fetchUsers(current.nextCursor);
        if (page) {
            setUserPages((prev) => [...prev, page]);
            setUserPage(nextIdx);
            setUsers(page.items);
        }
    };

    const handlePrevUserPage = () => {
        if (userPage === 0) return;
        const prev = userPage - 1;
        setUserPage(prev);
        setUsers(userPages[prev].items);
    };

    const openBanModal = (target: BanTarget) => {
        setBanTarget(target);
        setBanReason("");
        setBanDuration("permanent");
        setBanError("");
        setBanOpen(true);
    };

    const handleBan = async () => {
        if (!user || !banTarget) return;
        setBanLoading(true);
        setBanError("");
        try {
            const token = await user.getIdToken();
            const durationOpt = DURATION_OPTIONS.find((d) => d.value === banDuration);
            const isPermanent = banDuration === "permanent";
            const expiresAt = !isPermanent && durationOpt ? Date.now() + durationOpt.ms : null;

            const res = await fetch("/api/admin/access-control/ban", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    subjectType: banTarget.subjectType,
                    subjectId: banTarget.subjectId,
                    subjectEmail: banTarget.subjectEmail,
                    reason: banReason || null,
                    mode: isPermanent ? "permanent" : "temporary",
                    expiresAt,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setBanError(data.message || "Ban failed");
                return;
            }
            setBanOpen(false);
            setStatusMsg(`Banned ${banTarget.label}`);
            setTimeout(() => setStatusMsg(""), 3000);
            loadUsers();
            fetchGuests();
        } catch (err) {
            setBanError(err instanceof Error ? err.message : "Ban failed");
        } finally {
            setBanLoading(false);
        }
    };

    const handleUnban = async (subjectType: "user" | "guest", subjectId: string) => {
        if (!user) return;
        setUnbanLoading(subjectId);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/access-control/unban", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ subjectType, subjectId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatusMsg(data.message || "Unban failed");
                setTimeout(() => setStatusMsg(""), 3000);
                return;
            }
            setStatusMsg(`Unbanned ${subjectId}`);
            setTimeout(() => setStatusMsg(""), 3000);
            loadUsers();
            fetchGuests();
        } catch {
            // ignore
        } finally {
            setUnbanLoading(null);
        }
    };

    const userBannedCount = useMemo(() => users.filter((u) => u.access?.status === "banned").length, [users]);
    const guestBannedCount = useMemo(() => guests.filter((g) => g.access?.status === "banned").length, [guests]);

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
                <ShieldCheck className="h-10 w-10 text-slate-400" />
                <h1 className="mt-5 text-3xl font-bold text-slate-900">Admin access required</h1>
                <p className="mt-2 text-slate-500">This area is only available to administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Access Control</h1>
                <p className="text-slate-500">Ban or unban users and guests. Actions take effect immediately across all sessions.</p>
            </div>

            {statusMsg && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {statusMsg}
                </div>
            )}

            {/* ── Users Section ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-slate-500" />
                        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
                        {userBannedCount > 0 && (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                {userBannedCount} banned
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by email..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {usersLoading && users.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400">No users found.</div>
                    ) : (
                        users.map((u) => {
                            const isBanned = u.access?.status === "banned";
                            const isSelf = u.email?.toLowerCase() === user?.email?.toLowerCase();
                            return (
                                <div key={u.id} className="flex items-center justify-between px-5 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900">{u.email || u.id}</span>
                                            {isBanned && (
                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Banned</span>
                                            )}
                                            {!isBanned && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                                            )}
                                            {isSelf && (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">You</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            Plan: {u.plan || "free"} · Links: {u.activeLinks ?? "—"}
                                            {isBanned && u.access?.reason && ` · Reason: ${u.access.reason}`}
                                        </span>
                                    </div>
                                    <div>
                                        {isOwner && !isSelf && (
                                            isBanned ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleUnban("user", u.id)}
                                                    disabled={unbanLoading === u.id}
                                                    className="h-8 text-xs"
                                                >
                                                    {unbanLoading === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="mr-1 h-3 w-3" />}
                                                    Unban
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openBanModal({ subjectType: "user", subjectId: u.id, subjectEmail: u.email, label: u.email || u.id })}
                                                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                >
                                                    <ShieldBan className="mr-1 h-3 w-3" />
                                                    Ban
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {!userSearch && userPages.length > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                        <Button size="sm" variant="ghost" onClick={handlePrevUserPage} disabled={userPage === 0} className="h-8 text-xs">
                            <ChevronLeft className="mr-1 h-3 w-3" /> Previous
                        </Button>
                        <span className="text-xs text-slate-400">Page {userPage + 1}</span>
                        <Button size="sm" variant="ghost" onClick={handleNextUserPage} disabled={!userPages[userPage]?.nextCursor} className="h-8 text-xs">
                            Next <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Guests Section ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Ghost className="h-5 w-5 text-slate-500" />
                        <h2 className="text-lg font-semibold text-slate-900">Guests</h2>
                        {guestBannedCount > 0 && (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                {guestBannedCount} banned
                            </span>
                        )}
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchGuests} disabled={guestsLoading} className="h-8 text-xs">
                        {guestsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                    </Button>
                </div>

                <div className="divide-y divide-slate-100">
                    {guestsLoading && guests.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : guests.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400">No guest entities yet.</div>
                    ) : (
                        guests.map((g) => {
                            const isBanned = g.access?.status === "banned";
                            const idLabel = g.guestId.length > 16 ? `${g.guestId.slice(0, 8)}…${g.guestId.slice(-8)}` : g.guestId;
                            return (
                                <div key={g.id} className="flex items-center justify-between px-5 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 font-mono">{idLabel}</span>
                                            {isBanned && (
                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Banned</span>
                                            )}
                                            {!isBanned && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                                            )}
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{g.canonicalIdentityStrength}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            Last seen: {g.lastSeenAt ? new Date(g.lastSeenAt).toLocaleString() : "—"}
                                            {isBanned && g.access?.reason && ` · Reason: ${g.access.reason}`}
                                        </span>
                                    </div>
                                    <div>
                                        {isOwner && (
                                            isBanned ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleUnban("guest", g.guestId)}
                                                    disabled={unbanLoading === g.guestId}
                                                    className="h-8 text-xs"
                                                >
                                                    {unbanLoading === g.guestId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="mr-1 h-3 w-3" />}
                                                    Unban
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openBanModal({ subjectType: "guest", subjectId: g.guestId, label: idLabel })}
                                                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                >
                                                    <ShieldBan className="mr-1 h-3 w-3" />
                                                    Ban
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Ban Modal ── */}
            <Dialog open={banOpen} onOpenChange={setBanOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldBan className="h-5 w-5 text-red-500" />
                            Ban {banTarget?.label}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason (optional)</label>
                            <input
                                type="text"
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                placeholder="e.g. Abuse, spam, etc."
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Duration</label>
                            <div className="grid grid-cols-3 gap-2">
                                {DURATION_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setBanDuration(opt.value)}
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                            banDuration === opt.value
                                                ? "border-red-300 bg-red-50 text-red-700"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {banError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                                {banError}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBanOpen(false)} disabled={banLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBan}
                            disabled={banLoading}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {banLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldBan className="mr-2 h-4 w-4" />}
                            Confirm Ban
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

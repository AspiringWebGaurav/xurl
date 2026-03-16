"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";

const PLAN_OPTIONS = ["starter", "pro", "business", "enterprise", "bigenterprise"] as const;
const DURATION_PRESETS = [
    { id: "1d", label: "1 day" },
    { id: "5d", label: "5 days" },
    { id: "10d", label: "10 days" },
    { id: "30d", label: "30 days" },
    { id: "permanent", label: "Permanent" },
    { id: "custom", label: "Custom" },
];

const GIFT_EXPIRY_PRESETS = [
    { id: "1d", label: "+1 day" },
    { id: "5d", label: "+5 days" },
    { id: "10d", label: "+10 days" },
    { id: "30d", label: "+30 days" },
    { id: "no_expiry", label: "No expiry" },
    { id: "custom", label: "Custom" },
];

type GrantFormState = {
    email: string;
    type: "plan" | "link_gift";
    plan: string;
    durationOption: string;
    customValue: string;
    customUnit: "minutes" | "hours" | "days" | "months";
    quantity: string;
    expiresOption: string;
    reason: string;
};

type SearchUser = {
    id: string;
    email: string;
    plan?: string | null;
    planExpiry?: number | null;
    createdAt?: number | null;
    activeLinks?: number | null;
    linksCreated?: number | null;
    cumulativeQuota?: number | null;
};

type UserPage = {
    items: SearchUser[];
    nextCursor: number | null;
};

type GrantHistoryItem = {
    id: string;
    action: string;
    planType: string;
    linksAllocated: number;
    amount: number;
    source: string;
    recipientEmail: string | null;
    adminEmail: string | null;
    grantType: string | null;
    durationOption: string | null;
    customValue: number | null;
    customUnit: string | null;
    overrideExpiryMs: number | null;
    expiresAt: number | null;
    previousPlan: string | null;
    restoredPlan: string | null;
    createdAt: number;
};

const initialForm: GrantFormState = {
    email: "",
    type: "plan",
    plan: "pro",
    durationOption: "30d",
    customValue: "",
    customUnit: "days",
    quantity: "10",
    expiresOption: "5d",
    reason: "admin_grant",
};

export default function AdminGrantPlanPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [granting, setGranting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [form, setForm] = useState<GrantFormState>(initialForm);
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [userPages, setUserPages] = useState<UserPage[]>([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [hasFetchedLatest, setHasFetchedLatest] = useState(false);
    const [grantHistory, setGrantHistory] = useState<GrantHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [revokeTarget, setRevokeTarget] = useState<GrantHistoryItem | null>(null);
    const [revokeOpen, setRevokeOpen] = useState(false);
    const [revokeLoading, setRevokeLoading] = useState(false);
    const [revokeError, setRevokeError] = useState("");

    const canAccess = isAdminEmail(user?.email);
    const normalizedQuery = form.email.trim().toLowerCase();
    const selectedIsAdmin = selectedUser ? isAdminEmail(selectedUser.email) : false;
    const panelRows = useMemo(() => {
        if (!selectedUser) return [] as { label: string; value: string }[];
        const rows: { label: string; value: string }[] = [];
        rows.push({ label: "Email", value: selectedUser.email });
        rows.push({ label: "Current plan", value: selectedUser.plan || "free" });
        if (selectedUser.planExpiry) {
            rows.push({ label: "Plan expiry", value: new Date(selectedUser.planExpiry).toLocaleDateString() });
        }
        if (selectedUser.createdAt) {
            rows.push({ label: "Account created", value: new Date(selectedUser.createdAt).toLocaleDateString() });
        }
        if (selectedUser.activeLinks !== null && selectedUser.activeLinks !== undefined) {
            rows.push({ label: "Active links", value: selectedUser.activeLinks.toLocaleString() });
        }
        if (selectedUser.linksCreated !== null && selectedUser.linksCreated !== undefined) {
            rows.push({ label: "Links created", value: selectedUser.linksCreated.toLocaleString() });
        }
        if (selectedUser.cumulativeQuota !== null && selectedUser.cumulativeQuota !== undefined) {
            rows.push({ label: "Link quota", value: selectedUser.cumulativeQuota.toLocaleString() });
        }
        return rows;
    }, [selectedUser]);

    const currentPage = userPages[pageIndex];
    const totalPages = currentPage?.nextCursor ? null : userPages.length ? pageIndex + 1 : null;
    const pageLabel = totalPages ? `Page ${pageIndex + 1} of ${totalPages}` : `Page ${pageIndex + 1}`;
    const formatPlan = (plan: string | null | undefined) => {
        if (!plan) return "—";
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

    const formatDuration = (item: GrantHistoryItem) => {
        if (item.overrideExpiryMs === null || item.durationOption === "permanent") {
            return "PERMANENT";
        }
        if (item.durationOption && item.durationOption !== "custom") {
            const map: Record<string, string> = {
                "1d": "1 day",
                "5d": "5 days",
                "10d": "10 days",
                "30d": "30 days",
                "1d_gift": "1 day",
            };
            return map[item.durationOption] || item.durationOption;
        }
        if (item.durationOption === "custom" && item.customValue && item.customUnit) {
            return `${item.customValue} ${item.customUnit}`;
        }
        return "—";
    };

    const loadGrantHistory = async () => {
        if (!user) return;
        setHistoryLoading(true);
        setHistoryError("");
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/grants/history?limit=50", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data.items)) {
                setGrantHistory(data.items as GrantHistoryItem[]);
            } else {
                setGrantHistory([]);
            }
        } catch {
            setHistoryError("Failed to load grant history.");
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u) {
                await ensureUserDocument(u);
                await loadGrantHistory();
            }
        });
        return () => unsub();
    }, []);

    const handleOpenRevoke = (item: GrantHistoryItem) => {
        setRevokeTarget(item);
        setRevokeError("");
        setRevokeOpen(true);
    };

    const handleConfirmRevoke = async () => {
        if (!user || !revokeTarget) return;
        setRevokeLoading(true);
        setRevokeError("");
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/grants/revoke", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ transactionId: revokeTarget.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || "Failed to revoke grant");
            }
            setRevokeOpen(false);
            setRevokeTarget(null);
            await loadGrantHistory();
        } catch (error) {
            setRevokeError(error instanceof Error ? error.message : "Failed to revoke grant");
        } finally {
            setRevokeLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedUser) {
            return;
        }
        if (normalizedQuery !== selectedUser.email.toLowerCase()) {
            setSelectedUser(null);
        }
    }, [normalizedQuery, selectedUser]);

    useEffect(() => {
        if (!user) return;
        if (normalizedQuery.length < 2) {
            setSearchResults([]);
            setSearchOpen(false);
            setSearchLoading(false);
            setHighlightedIndex(-1);
            return;
        }

        let active = true;
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setSearchLoading(true);
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(normalizedQuery)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                const data = await res.json().catch(() => ({}));
                if (!active) return;
                if (res.ok && Array.isArray(data.items)) {
                    setSearchResults(data.items as SearchUser[]);
                } else {
                    setSearchResults([]);
                }
            } catch (err) {
                if (!active) return;
                if (err instanceof Error && err.name === "AbortError") return;
                setSearchResults([]);
            } finally {
                if (!active) return;
                setSearchLoading(false);
                setSearchOpen(true);
                setHighlightedIndex(-1);
            }
        }, 260);

        return () => {
            active = false;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [normalizedQuery, user]);

    const showNoResults = !searchLoading && normalizedQuery.length >= 2 && searchResults.length === 0;

    async function submitGrant() {
        if (!user) return;
        setGranting(true);
        setError("");
        setSuccess("");
        try {
            const token = await user.getIdToken();
            const payload: Record<string, unknown> = {
                email: form.email.trim().toLowerCase(),
                type: form.type,
                reason: form.reason || "admin_grant",
            };

            if (form.type === "plan") {
                payload.plan = form.plan;
                payload.durationOption = form.durationOption;
                if (form.durationOption === "custom") {
                    payload.customValue = form.customValue ? Number(form.customValue) : undefined;
                    payload.customUnit = form.customUnit;
                }
            } else {
                payload.quantity = form.quantity ? Number(form.quantity) : 0;
                payload.expiresOption = form.expiresOption;
                if (form.expiresOption === "custom") {
                    payload.customValue = form.customValue ? Number(form.customValue) : undefined;
                    payload.customUnit = form.customUnit;
                }
            }

            const res = await fetch("/api/admin/grant-plan", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to grant");

            const appliedText = data.applied ? "applied immediately" : "stored as pending";
            if (form.type === "plan") {
                setSuccess(`Granted ${form.plan} (${form.durationOption}) to ${form.email} (${appliedText})`);
            } else {
                setSuccess(`Gifted ${form.quantity} links to ${form.email} (${appliedText})`);
            }
            setForm((prev) => ({ ...prev, email: "" }));
            setSelectedUser(null);
            setSearchOpen(false);
            setSearchResults([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Grant failed");
        } finally {
            setGranting(false);
        }
    }

    const handleSelectUser = (candidate: SearchUser) => {
        setForm((prev) => ({ ...prev, email: candidate.email }));
        setSelectedUser(candidate);
        setSearchOpen(false);
        setSearchResults([]);
        setHighlightedIndex(-1);
    };

    const fetchUserPage = async (cursor: number | null) => {
        if (!user) return null;
        setListLoading(true);
        try {
            const token = await user.getIdToken();
            const cursorParam = cursor ? `&cursor=${cursor}` : "";
            const res = await fetch(`/api/admin/users/list?limit=20${cursorParam}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !Array.isArray(data.items)) {
                return { items: [] as SearchUser[], nextCursor: null };
            }
            return {
                items: data.items as SearchUser[],
                nextCursor: typeof data.nextCursor === "number" ? data.nextCursor : null,
            } as UserPage;
        } catch {
            return { items: [] as SearchUser[], nextCursor: null };
        } finally {
            setListLoading(false);
        }
    };

    const handleToggleList = () => {
        setListOpen((prev) => !prev);
    };

    const handleFetchLatest = async () => {
        if (hasFetchedLatest) {
            setPageIndex(0);
            return;
        }
        const page = await fetchUserPage(null);
        if (!page) return;
        setUserPages([page]);
        setPageIndex(0);
        setHasFetchedLatest(true);
    };

    const handleNextPage = async () => {
        if (!currentPage?.nextCursor) return;
        const nextIndex = pageIndex + 1;
        if (userPages[nextIndex]) {
            setPageIndex(nextIndex);
            return;
        }
        const page = await fetchUserPage(currentPage.nextCursor);
        if (!page) return;
        setUserPages((prev) => [...prev, page]);
        setPageIndex(nextIndex);
    };

    const handlePrevPage = () => {
        if (pageIndex === 0) return;
        setPageIndex((prev) => Math.max(prev - 1, 0));
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Grant Plan</h1>
                    <p className="text-slate-500">Search users by email, select a plan and duration, and grant access with zero billing.</p>
                </div>

                {(error || success) && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        {error || success}
                    </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-800">Recipient email</label>
                            <div className="relative">
                                <Input
                                    value={form.email}
                                    onChange={(e) => {
                                        setForm((f) => ({ ...f, email: e.target.value }));
                                    }}
                                    onFocus={() => {
                                        if (normalizedQuery.length >= 2) {
                                            setSearchOpen(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        window.setTimeout(() => setSearchOpen(false), 140);
                                    }}
                                    onKeyDown={(e) => {
                                        if (!searchOpen && (e.key === "ArrowDown" || e.key === "ArrowUp") && searchResults.length > 0) {
                                            setSearchOpen(true);
                                            setHighlightedIndex(0);
                                            e.preventDefault();
                                            return;
                                        }
                                        if (!searchOpen) return;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setHighlightedIndex((prev) => {
                                                if (searchResults.length === 0) return -1;
                                                const next = prev + 1;
                                                return next >= searchResults.length ? 0 : next;
                                            });
                                        }
                                        if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setHighlightedIndex((prev) => {
                                                if (searchResults.length === 0) return -1;
                                                const next = prev - 1;
                                                return next < 0 ? searchResults.length - 1 : next;
                                            });
                                        }
                                        if (e.key === "Enter") {
                                            if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
                                                e.preventDefault();
                                                handleSelectUser(searchResults[highlightedIndex]);
                                            }
                                        }
                                        if (e.key === "Escape") {
                                            setSearchOpen(false);
                                            setHighlightedIndex(-1);
                                        }
                                    }}
                                    placeholder="user@example.com"
                                />
                                {searchOpen && (searchLoading || searchResults.length > 0 || showNoResults) && (
                                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                        {searchLoading && (
                                            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Searching users…
                                            </div>
                                        )}
                                        {!searchLoading && searchResults.length > 0 && (
                                            <div className="max-h-56 overflow-y-auto py-1">
                                                {searchResults.map((item, index) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => handleSelectUser(item)}
                                                        className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition ${index === highlightedIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                                                    >
                                                        <span className="font-medium text-slate-700">{item.email}</span>
                                                        {isAdminEmail(item.email) && (
                                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                                ADMIN
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {showNoResults && (
                                            <div className="px-4 py-3 text-xs text-slate-500">No users found.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-800">Grant type</label>
                            <select
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                value={form.type}
                                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GrantFormState["type"] }))}
                            >
                                <option value="plan">Plan access</option>
                                <option value="link_gift">Link gift</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-800">Reason</label>
                            <Input
                                value={form.reason}
                                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                                placeholder="Giveaway / Bug fix / Beta access"
                            />
                        </div>
                    </div>

                    {selectedUser && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected user</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">Account summary</p>
                                        {selectedIsAdmin && (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">ADMIN</span>
                                        )}
                                    </div>
                                </div>
                                {selectedIsAdmin && (
                                    <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                                        This account has administrative access.
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {panelRows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                        <span className="font-semibold text-slate-500">{row.label}</span>
                                        <span className="font-medium text-slate-800">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {form.type === "plan" ? (
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-800">Plan</label>
                                <select
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                    value={form.plan}
                                    onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                                >
                                    {PLAN_OPTIONS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-800">Duration</label>
                                <select
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                    value={form.durationOption}
                                    onChange={(e) => setForm((f) => ({ ...f, durationOption: e.target.value }))}
                                >
                                    {DURATION_PRESETS.map((d) => (
                                        <option key={d.id} value={d.id}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                            {form.durationOption === "custom" && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-slate-800">Custom duration</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            value={form.customValue}
                                            onChange={(e) => setForm((f) => ({ ...f, customValue: e.target.value }))}
                                            placeholder="Value"
                                        />
                                        <select
                                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                            value={form.customUnit}
                                            onChange={(e) => setForm((f) => ({ ...f, customUnit: e.target.value as GrantFormState["customUnit"] }))}
                                        >
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                            <option value="months">Months</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-800">Link quantity</label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={form.quantity}
                                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                                    placeholder="10"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-800">Gift expiry</label>
                                <select
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                    value={form.expiresOption}
                                    onChange={(e) => setForm((f) => ({ ...f, expiresOption: e.target.value }))}
                                >
                                    {GIFT_EXPIRY_PRESETS.map((d) => (
                                        <option key={d.id} value={d.id}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                            {form.expiresOption === "custom" && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-slate-800">Custom expiry</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            value={form.customValue}
                                            onChange={(e) => setForm((f) => ({ ...f, customValue: e.target.value }))}
                                            placeholder="Value"
                                        />
                                        <select
                                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                            value={form.customUnit}
                                            onChange={(e) => setForm((f) => ({ ...f, customUnit: e.target.value as GrantFormState["customUnit"] }))}
                                        >
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                            <option value="months">Months</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                            <p className="font-semibold text-slate-800">Safety notes</p>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>Admin-only. Uses Firebase token and server-side admin check.</li>
                                <li>No Razorpay calls. Amount recorded as ₹0 and source is admin_grant.</li>
                                <li>Supports pending grants for unregistered emails; auto-applies on login.</li>
                            </ul>
                        </div>
                        <Button type="button" onClick={() => void submitGrant()} disabled={granting || !form.email.trim()}>
                            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => void handleToggleList()}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Browse Users</p>
                            <p className="text-sm font-semibold text-slate-900">Select an account to grant access</p>
                            <p className="mt-1 text-xs text-slate-500">Click to browse existing users.</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${listOpen ? "rotate-180" : ""}`} />
                    </button>
                    {listOpen && (
                        <div className="border-t border-slate-200 px-5 py-4 transition-all duration-200">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">User explorer</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleFetchLatest()}
                                    disabled={listLoading}
                                >
                                    {hasFetchedLatest ? "Latest loaded" : "Fetch latest users"}
                                </Button>
                            </div>
                            {listLoading && userPages.length === 0 ? (
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Loading users…
                                </div>
                            ) : currentPage && currentPage.items.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        {currentPage.items.map((candidate) => {
                                            const email = candidate.email?.trim();
                                            const isGuest = !email;
                                            const isAdmin = !isGuest && isAdminEmail(email);
                                            const isActivePlan = candidate.plan && candidate.plan !== "free";
                                            const isSelected = !!email && selectedUser?.email?.toLowerCase() === email.toLowerCase();
                                            return (
                                                <button
                                                    key={candidate.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (!isGuest) {
                                                            handleSelectUser({ ...candidate, email });
                                                        }
                                                    }}
                                                    className={`flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left text-sm transition ${isSelected ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"} ${isGuest ? "cursor-default" : ""}`}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <span className="font-medium text-slate-800">{isGuest ? "Guest user" : email}</span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {isGuest && (
                                                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                                    GUEST
                                                                </span>
                                                            )}
                                                            {isAdmin && (
                                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                                    ADMIN
                                                                </span>
                                                            )}
                                                            {isActivePlan && (
                                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                                    {candidate.plan}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                                        {candidate.planExpiry ? (
                                                            <span>Plan expiry: {new Date(candidate.planExpiry).toLocaleDateString()}</span>
                                                        ) : null}
                                                        {candidate.activeLinks !== null && candidate.activeLinks !== undefined ? (
                                                            <span>Active links: {candidate.activeLinks.toLocaleString()}</span>
                                                        ) : null}
                                                        {candidate.linksCreated !== null && candidate.linksCreated !== undefined ? (
                                                            <span>Links created: {candidate.linksCreated.toLocaleString()}</span>
                                                        ) : null}
                                                        {candidate.cumulativeQuota !== null && candidate.cumulativeQuota !== undefined ? (
                                                            <span>Link quota: {candidate.cumulativeQuota.toLocaleString()}</span>
                                                        ) : null}
                                                        {candidate.createdAt ? (
                                                            <span>Created: {new Date(candidate.createdAt).toLocaleDateString()}</span>
                                                        ) : null}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                                        <p className="text-xs text-slate-500">{pageLabel}</p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handlePrevPage}
                                                disabled={pageIndex === 0}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => void handleNextPage()}
                                                disabled={!currentPage?.nextCursor}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                    No users available yet.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Grant History</p>
                            <h2 className="text-lg font-semibold text-slate-900">Recent admin grants</h2>
                            <p className="text-xs text-slate-500">Review recent grants and revoke mistakes if needed.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={loadGrantHistory} disabled={historyLoading}>
                            {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                        </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                        {historyError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                                {historyError}
                            </div>
                        )}
                        {historyLoading ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading grant history…</div>
                        ) : grantHistory.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No grants recorded yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        <tr>
                                            <th className="py-2 pr-4">Date</th>
                                            <th className="py-2 pr-4">Action</th>
                                            <th className="py-2 pr-4">Recipient</th>
                                            <th className="py-2 pr-4">Plan</th>
                                            <th className="py-2 pr-4">Duration</th>
                                            <th className="py-2 pr-4">Links</th>
                                            <th className="py-2 pr-4">Source</th>
                                            <th className="py-2 pr-4">Amount</th>
                                            <th className="py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {grantHistory.map((item) => {
                                            const duration = formatDuration(item);
                                            const canRevoke = item.action === "admin_grant";
                                            return (
                                                <tr key={item.id} className="text-slate-700">
                                                    <td className="py-3 pr-4 text-xs text-slate-500">
                                                        {new Date(item.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 pr-4 font-semibold text-slate-800">
                                                        {item.action?.replace("_", " ") || "admin_grant"}
                                                    </td>
                                                    <td className="py-3 pr-4 text-xs">
                                                        {item.recipientEmail || "—"}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        {formatPlan(item.planType)}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        {duration === "PERMANENT" ? (
                                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                                                PERMANENT
                                                            </span>
                                                        ) : (
                                                            duration
                                                        )}
                                                    </td>
                                                    <td className="py-3 pr-4">{item.linksAllocated ?? 0}</td>
                                                    <td className="py-3 pr-4 text-xs">{item.source || "admin_grant"}</td>
                                                    <td className="py-3 pr-4 text-xs">₹{item.amount ?? 0}</td>
                                                    <td className="py-3">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={!canRevoke}
                                                            onClick={() => canRevoke && handleOpenRevoke(item)}
                                                        >
                                                            Revoke
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke admin grant</DialogTitle>
                        <DialogDescription>
                            This will revert the user to the previous plan and restore their previous quota snapshot.
                        </DialogDescription>
                    </DialogHeader>
                    {revokeError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {revokeError}
                        </div>
                    )}
                    <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Recipient</span>
                            <span>{revokeTarget?.recipientEmail || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Plan</span>
                            <span>{formatPlan(revokeTarget?.planType)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Duration</span>
                            <span>{revokeTarget ? formatDuration(revokeTarget) : "—"}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setRevokeOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleConfirmRevoke()} disabled={revokeLoading}>
                            {revokeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm revoke"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

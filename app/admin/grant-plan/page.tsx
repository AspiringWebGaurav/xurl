"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ShieldCheck } from "lucide-react";

const PLAN_OPTIONS = ["starter", "pro", "business", "enterprise", "bigenterprise"] as const;
const DURATION_PRESETS = [
    { id: "1d", label: "1 day" },
    { id: "5d", label: "5 days" },
    { id: "10d", label: "10 days" },
    { id: "30d", label: "30 days" },
    { id: "custom", label: "Custom" },
];

type UserRow = {
    id: string;
    email: string;
    plan: string;
    planExpiry: number | null;
    planStatus: string;
};

type GrantFormState = {
    userId: string | null;
    email: string;
    plan: string;
    durationOption: string;
    customValue: string;
    customUnit: "minutes" | "hours" | "days" | "months";
    reason: string;
};

const initialForm: GrantFormState = {
    userId: null,
    email: "",
    plan: "pro",
    durationOption: "30d",
    customValue: "",
    customUnit: "days",
    reason: "admin_grant",
};

function formatExpiry(value: number | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
}

export default function AdminGrantPlanPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [granting, setGranting] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserRow[]>([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [form, setForm] = useState<GrantFormState>(initialForm);

    const canAccess = isAdminEmail(user?.email);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u) {
                await ensureUserDocument(u);
            }
        });
        return () => unsub();
    }, []);

    const filteredResults = useMemo(() => results, [results]);

    async function searchUsers() {
        if (!user || !query.trim()) return;
        setSearching(true);
        setError("");
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to search users");
            setResults(data.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
            setResults([]);
        } finally {
            setSearching(false);
        }
    }

    async function grantPlan(target: UserRow) {
        if (!user) return;
        setGranting(true);
        setError("");
        setSuccess("");
        try {
            const token = await user.getIdToken();
            const payload = {
                userId: target.id,
                email: target.email,
                plan: form.plan,
                durationOption: form.durationOption,
                customValue: form.customValue ? Number(form.customValue) : undefined,
                customUnit: form.customUnit,
                reason: form.reason || "admin_grant",
            };
            const res = await fetch("/api/admin/grant-plan", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to grant plan");
            setSuccess(`Granted ${form.plan} to ${target.email}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Grant failed");
        } finally {
            setGranting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user || !canAccess) {
        return (
            <div className="min-h-screen bg-slate-50">
                <TopNavbar />
                <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
                    <ShieldCheck className="h-10 w-10 text-slate-400" />
                    <h1 className="mt-5 text-3xl font-bold text-slate-900">Admin access required</h1>
                    <p className="mt-2 text-slate-500">This area is only available to administrators.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <TopNavbar />
            <main className="mx-auto max-w-6xl px-6 py-12 space-y-8">
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

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="flex-1">
                            <label className="text-sm font-semibold text-slate-800">Search by email</label>
                            <div className="mt-1 flex items-center gap-2">
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="user@example.com"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            void searchUsers();
                                        }
                                    }}
                                />
                                <Button type="button" onClick={() => void searchUsers()} disabled={searching}>
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    <span className="ml-2">Search</span>
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 md:w-60">
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
                        <div className="flex flex-col gap-2 md:w-48">
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
                            <div className="flex flex-col gap-2 md:w-56">
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
                        <div className="flex flex-col gap-2 md:w-64">
                            <label className="text-sm font-semibold text-slate-800">Reason</label>
                            <Input
                                value={form.reason}
                                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                                placeholder="Giveaway / Bug fix / Beta access"
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">Safety notes</p>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                            <li>Admin-only. Uses Firebase token and server-side admin check.</li>
                            <li>No Razorpay calls. Amount recorded as ₹0 and source is "admin_grant".</li>
                            <li>Plan applied via transactional `applyPlanUpgrade` with custom expiry.</li>
                        </ul>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Plan</th>
                                    <th className="px-4 py-3">Expiry</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No users found. Search by email.</td>
                                    </tr>
                                ) : (
                                    filteredResults.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3 font-medium">{u.email}</td>
                                            <td className="px-4 py-3 capitalize">{u.plan}</td>
                                            <td className="px-4 py-3 text-slate-500">{formatExpiry(u.planExpiry)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    type="button"
                                                    onClick={() => void grantPlan(u)}
                                                    disabled={granting}
                                                >
                                                    {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant Plan"}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

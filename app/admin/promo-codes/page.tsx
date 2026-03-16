"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Plus, TicketPercent, Trash2, Eye, PauseCircle, PlayCircle, AlertTriangle } from "lucide-react";
import { isAdminEmail } from "@/lib/admin-config";
import { PLAN_CONFIGS } from "@/lib/plans";

type PromoCodeItem = {
    id: string;
    code: string;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
    status?: "ACTIVE" | "PAUSED" | "DISABLED";
    startsAt?: number | null;
    expiresAt: number | null;
    usageLimit: number | null;
    usageCount: number;
    planRestriction: string | null;
    planRestrictions?: string[] | null;
    isActive: boolean;
    perUserLimit: number | null;
    firstTimeOnly?: boolean;
    redemptionCount?: number;
    updatedAt: number;
};

function formatDate(value: number) {
    return new Date(value).toLocaleString();
}

type RedemptionItem = {
    id: string;
    promoCode: string;
    userId: string;
    userEmail?: string | null;
    planId: string;
    orderId?: string | null;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
    redeemedAt: number;
};

type PromoFormState = {
    code: string;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: string;
    startsAt: string;
    expiresAt: string;
    usageLimit: string;
    perUserLimit: string;
    planRestrictions: string[];
    status: "ACTIVE" | "PAUSED" | "DISABLED";
    firstTimeOnly: boolean;
};

const initialForm: PromoFormState = {
    code: "",
    discountType: "percentage",
    discountValue: "10",
    startsAt: "",
    expiresAt: "",
    usageLimit: "",
    perUserLimit: "",
    planRestrictions: [],
    status: "ACTIVE",
    firstTimeOnly: false,
};

function formatExpiry(value: number | null): string {
    if (!value) return "No expiry";
    return new Date(value).toLocaleString();
}

function resolvePromoStatus(item: PromoCodeItem): "ACTIVE" | "PAUSED" | "DISABLED" | "EXPIRED" {
    if (item.status) {
        if (item.status === "ACTIVE" && item.expiresAt && item.expiresAt <= Date.now()) {
            return "EXPIRED";
        }
        return item.status;
    }
    if (!item.isActive) return "DISABLED";
    if (item.expiresAt && item.expiresAt <= Date.now()) return "EXPIRED";
    return "ACTIVE";
}

const planOptions = ["starter", "pro", "business", "enterprise", "bigenterprise"] as const;

function formatPlanName(planId: string) {
    const config = PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS];
    return config?.label ?? planId;
}

export default function AdminPromoCodesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<PromoCodeItem[]>([]);
    const [redemptions, setRedemptions] = useState<Record<string, RedemptionItem[]>>({});
    const [showRedemptionsFor, setShowRedemptionsFor] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PromoFormState>(initialForm);

    const canAccess = isAdminEmail(user?.email);
    const analyticsSummary = useMemo(() => {
        const totalRedemptions = items.reduce((sum, item) => sum + item.usageCount, 0);
        const activeCodes = items.filter((item) => resolvePromoStatus(item) === "ACTIVE").length;
        const exhaustedCodes = items.filter(
            (item) => item.usageLimit !== null && item.usageCount >= item.usageLimit
        ).length;

        return {
            totalRedemptions,
            activeCodes,
            exhaustedCodes,
        };
    }, [items]);

    const loadItems = useCallback(async (currentUser: User) => {
        setPageLoading(true);
        setError("");
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch("/api/admin/promo-codes", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to load promo codes.");
            }
            setItems(data.items || []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load promo codes.");
        } finally {
            setPageLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setLoading(false);

            if (!nextUser) {
                setItems([]);
                return;
            }

            await ensureUserDocument(nextUser);
            if (isAdminEmail(nextUser.email)) {
                await loadItems(nextUser);
            }
        });

        return () => unsubscribe();
    }, [loadItems]);

    const submitLabel = useMemo(() => (editingId ? "Save changes" : "Create promo code"), [editingId]);

    function resetForm() {
        setForm(initialForm);
        setEditingId(null);
    }

    function startEditing(item: PromoCodeItem) {
        setEditingId(item.id);
        const planRestrictions = item.planRestrictions?.length
            ? item.planRestrictions
            : item.planRestriction
                ? [item.planRestriction]
                : [];
        setForm({
            code: item.code,
            discountType: item.discountType,
            discountValue: String(item.discountValue),
            startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : "",
            expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
            usageLimit: item.usageLimit ? String(item.usageLimit) : "",
            perUserLimit: item.perUserLimit ? String(item.perUserLimit) : "",
            planRestrictions,
            status: item.status ?? (item.isActive ? "ACTIVE" : "DISABLED"),
            firstTimeOnly: Boolean(item.firstTimeOnly),
        });
        setSuccess("");
        setError("");
    }

    async function submitForm() {
        if (!user) return;

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const token = await user.getIdToken();
            const planRestriction = form.planRestrictions.length === 1 ? form.planRestrictions[0] : null;
            const payload = {
                code: form.code || undefined,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : null,
                usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
                perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
                planRestriction,
                planRestrictions: form.planRestrictions.length ? form.planRestrictions : null,
                status: form.status,
                isActive: form.status === "ACTIVE",
                firstTimeOnly: form.firstTimeOnly,
            };

            const response = await fetch(editingId ? `/api/admin/promo-codes/${editingId}` : "/api/admin/promo-codes", {
                method: editingId ? "PATCH" : "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to save promo code.");
            }

            setSuccess(editingId ? "Promo code updated." : "Promo code created.");
            resetForm();
            await loadItems(user);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save promo code.");
        } finally {
            setSaving(false);
        }
    }

    async function disablePromoNow(id: string) {
        if (!user) return;

        setError("");
        setSuccess("");
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/promo-codes/${id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: "DISABLED", isActive: false }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to disable promo code.");
            }
            setSuccess("Promo code disabled.");
            await loadItems(user);
        } catch (disableError) {
            setError(disableError instanceof Error ? disableError.message : "Failed to disable promo code.");
        }
    }

    async function loadRedemptions(promoId: string) {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/promo-codes/${promoId}/redemptions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to load redemptions");
            setRedemptions((prev) => ({ ...prev, [promoId]: data.items || [] }));
        } catch (err) {
            console.error(err);
            setRedemptions((prev) => ({ ...prev, [promoId]: [] }));
        }
    }

    function randomCode() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const result = Array.from({ length: 10 })
            .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
            .join("");
        setForm((f) => ({ ...f, code: result }));
    }

    async function togglePromo(item: PromoCodeItem) {
        if (!user) return;

        setError("");
        setSuccess("");
        try {
            const token = await user.getIdToken();
            const nextStatus = resolvePromoStatus(item) === "ACTIVE" ? "PAUSED" : "ACTIVE";
            const response = await fetch(`/api/admin/promo-codes/${item.id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: nextStatus, isActive: nextStatus === "ACTIVE" }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to update promo status.");
            }
            await loadItems(user);
        } catch (toggleError) {
            setError(toggleError instanceof Error ? toggleError.message : "Failed to update promo status.");
        }
    }

    async function removePromo(id: string) {
        if (!user) return;

        setError("");
        setSuccess("");
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/promo-codes/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to delete promo code.");
            }
            if (editingId === id) {
                resetForm();
            }
            await loadItems(user);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete promo code.");
        }
    }

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
                <TicketPercent className="h-10 w-10 text-slate-400" />
                <h1 className="mt-5 text-3xl font-bold text-slate-900">Admin access required</h1>
                <p className="mt-2 text-slate-500">This area is only available to the configured XURL administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
                <div className="mb-8 flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Promo Codes</h1>
                    <p className="text-slate-500">Create, edit, enable, disable, and delete purchase coupons without changing the payment flow.</p>
                </div>

                {(error || success) && (
                    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        {error || success}
                    </div>
                )}

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Total Redemptions</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{analyticsSummary.totalRedemptions}</p>
                        <p className="mt-1 text-xs text-slate-400">Successful promo uses across all codes</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Active Codes</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{analyticsSummary.activeCodes}</p>
                        <p className="mt-1 text-xs text-slate-400">Currently available for checkout</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Exhausted Codes</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{analyticsSummary.exhaustedCodes}</p>
                        <p className="mt-1 text-xs text-slate-400">Usage-limited codes with no remaining redemptions</p>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-slate-400" />
                            <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit promo code" : "Create promo code"}</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Code</label>
                                <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Leave blank to auto-generate" className="rounded-xl" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Discount type</label>
                                    <select value={form.discountType} onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as "percentage" | "fixed" }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none">
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed (INR)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Discount value</label>
                                    <Input value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} type="number" min="1" className="rounded-xl" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Usage limit</label>
                                    <Input value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} type="number" min="1" placeholder="Unlimited" className="rounded-xl" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Per-user limit</label>
                                    <Input value={form.perUserLimit} onChange={(event) => setForm((current) => ({ ...current, perUserLimit: event.target.value }))} type="number" min="1" placeholder="Unlimited" className="rounded-xl" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Starts at</label>
                                    <Input value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} type="datetime-local" className="rounded-xl" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Expires at</label>
                                    <Input value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} type="datetime-local" className="rounded-xl" />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PromoFormState["status"] }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none">
                                    <option value="ACTIVE">Active</option>
                                    <option value="PAUSED">Paused</option>
                                    <option value="DISABLED">Disabled</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Plan restriction</label>
                                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    {planOptions.map((plan) => {
                                        const checked = form.planRestrictions.includes(plan);
                                        return (
                                            <label key={plan} className="flex items-center justify-between text-sm text-slate-700">
                                                <span>{formatPlanName(plan)}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        const next = event.target.checked
                                                            ? [...form.planRestrictions, plan]
                                                            : form.planRestrictions.filter((value) => value !== plan);
                                                        setForm((current) => ({ ...current, planRestrictions: next }));
                                                    }}
                                                />
                                            </label>
                                        );
                                    })}
                                    {!form.planRestrictions.length && (
                                        <p className="text-xs text-slate-400">Applies to all paid plans.</p>
                                    )}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.firstTimeOnly} onChange={(event) => setForm((current) => ({ ...current, firstTimeOnly: event.target.checked }))} />
                                First-time customers only
                            </label>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={submitForm} disabled={saving} className="h-10 flex-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {submitLabel}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="outline" onClick={resetForm} className="h-10 rounded-xl border-slate-200">
                                        Cancel
                                    </Button>
                                )}
                            </div>

                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                                <div className="flex items-center gap-2 text-rose-700">
                                    <AlertTriangle className="h-4 w-4" />
                                    <p className="text-sm font-semibold">Danger Zone</p>
                                </div>
                                <p className="mt-2 text-xs text-rose-600">
                                    Immediately disables the selected promo without removing redemption history. Select an existing promo to enable this action.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-3 w-full border-rose-200 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                                    onClick={() => editingId && disablePromoNow(editingId)}
                                    disabled={!editingId}
                                >
                                    Disable promo now
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-5">
                            <h2 className="text-lg font-semibold text-slate-900">Existing promo codes</h2>
                            <p className="mt-1 text-sm text-slate-500">Monitor discounts, limits, and availability across all plans.</p>
                        </div>

                        {pageLoading ? (
                            <div className="flex items-center justify-center px-6 py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="px-6 py-16 text-center text-slate-500">No promo codes created yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[860px] text-left text-sm">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Code</th>
                                            <th className="px-6 py-4 font-medium">Status</th>
                                            <th className="px-6 py-4 font-medium">Discount</th>
                                            <th className="px-6 py-4 font-medium">Usage</th>
                                            <th className="px-6 py-4 font-medium">Expiry</th>
                                            <th className="px-6 py-4 font-medium">Plans</th>
                                            <th className="px-6 py-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {items.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-500">{item.code}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {(() => {
                                                        const status = resolvePromoStatus(item);
                                                        const styles =
                                                            status === "ACTIVE"
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : status === "PAUSED"
                                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                    : status === "EXPIRED"
                                                                        ? "bg-slate-100 text-slate-500 border border-slate-200"
                                                                        : "bg-rose-50 text-rose-700 border border-rose-200";
                                                        return (
                                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles}`}>
                                                                {status}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {item.discountType === "percentage"
                                                        ? `${item.discountValue}%`
                                                        : item.discountType === "free_plan"
                                                            ? "Free plan"
                                                            : `₹${item.discountValue}`}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="text-slate-900">
                                                        {item.usageCount}{item.usageLimit ? ` / ${item.usageLimit}` : " / ∞"}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        Remaining: {item.usageLimit ? Math.max(item.usageLimit - item.usageCount, 0) : "∞"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">{formatExpiry(item.expiresAt)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap capitalize">
                                                    {item.planRestrictions?.length
                                                        ? item.planRestrictions.map(formatPlanName).join(", ")
                                                        : item.planRestriction
                                                            ? formatPlanName(item.planRestriction)
                                                            : "All paid"}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            title="View redemptions"
                                                            onClick={() => {
                                                                setShowRedemptionsFor((prev) => (prev === item.id ? null : item.id));
                                                                if (showRedemptionsFor !== item.id) void loadRedemptions(item.id);
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            title={resolvePromoStatus(item) === "ACTIVE" ? "Pause promo" : "Activate promo"}
                                                            onClick={() => togglePromo(item)}
                                                        >
                                                            {resolvePromoStatus(item) === "ACTIVE" ? (
                                                                <PauseCircle className="h-4 w-4" />
                                                            ) : (
                                                                <PlayCircle className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => startEditing(item)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removePromo(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {showRedemptionsFor && redemptions[showRedemptionsFor] && (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-semibold text-slate-900">Redemptions for {items.find((item) => item.id === showRedemptionsFor)?.code}</h3>
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-4 font-medium">User</th>
                                                    <th className="px-6 py-4 font-medium">Plan</th>
                                                    <th className="px-6 py-4 font-medium">Discount</th>
                                                    <th className="px-6 py-4 font-medium">Order</th>
                                                    <th className="px-6 py-4 font-medium">Redeemed at</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {(redemptions[showRedemptionsFor] || []).map((redemption) => (
                                                    <tr key={redemption.id} className="hover:bg-slate-50/70">
                                                        <td className="px-6 py-4 text-xs">
                                                            <div className="font-medium text-slate-900">{redemption.userEmail || redemption.userId}</div>
                                                            <div className="font-mono text-[11px] text-slate-400">{redemption.userId}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs">{formatPlanName(redemption.planId)}</td>
                                                        <td className="px-6 py-4 text-xs">
                                                            {redemption.discountType === "percentage"
                                                                ? `${redemption.discountValue}%`
                                                                : redemption.discountType === "free_plan"
                                                                    ? "Free plan"
                                                                    : `₹${redemption.discountValue}`}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{redemption.orderId || "—"}</td>
                                                        <td className="px-6 py-4 text-xs">{formatDate(redemption.redeemedAt)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
        </div>
    );
}

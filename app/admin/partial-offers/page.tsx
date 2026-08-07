"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { PLAN_CONFIGS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Loader2,
    Search,
    RefreshCw,
    Mail,
    Sparkles,
    CheckCircle2,
    XCircle,
    Percent,
    IndianRupee,
    Tag,
    Trash2,
    Plus,
    UserCheck,
    Clock,
    AlertCircle,
    Eye,
    Sliders,
    RotateCcw,
    ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { emitAdminRefresh } from "@/lib/admin/admin-events";
import { PartialOffer, PartialOfferDiscountType } from "@/services/partial-offers";

type SearchUser = {
    id: string;
    email: string;
    plan?: string | null;
    planExpiry?: number | null;
    createdAt?: number | null;
    activeLinks?: number | null;
};

type OfferFormState = {
    targetEmail: string;
    title: string;
    description: string;
    discountType: PartialOfferDiscountType;
    discountValue: string;
    plans: string[];
    billingCycle: "all" | "monthly" | "annual";
    isUnlimitedDuration: boolean;
    startsAt: string;
    expiresAt: string;
    isUnlimitedUsage: boolean;
    usageLimit: string;
    priority: string;
    isActive: boolean;
    notes: string;
};

const initialFormState: OfferFormState = {
    targetEmail: "",
    title: "Special VIP Promotional Upgrade",
    description: "Exclusive custom discount configured specially for your account.",
    discountType: "percentage",
    discountValue: "50",
    plans: ["pro", "business"],
    billingCycle: "all",
    isUnlimitedDuration: true,
    startsAt: "",
    expiresAt: "",
    isUnlimitedUsage: false,
    usageLimit: "1",
    priority: "10",
    isActive: true,
    notes: "Requested by customer via support",
};

const ALL_PLANS = ["starter", "pro", "business", "enterprise", "bigenterprise"];

export default function AdminPartialOffersPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Left Panel Tabs: "users" | "manual" | "existing"
    const [leftTab, setLeftTab] = useState<"users" | "manual" | "existing">("users");

    // Users directory state
    const [users, setUsers] = useState<SearchUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userSearch, setUserSearch] = useState("");

    // Existing offers list state
    const [existingOffers, setExistingOffers] = useState<PartialOffer[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);

    // Offer Builder Form state
    const [form, setForm] = useState<OfferFormState>(initialFormState);
    const [isUnregisteredTarget, setIsUnregisteredTarget] = useState(false);

    const router = useRouter();

    const canAccess = isAdminEmail(user?.email);

    // Load registered users directory
    const loadUsers = useCallback(async (currentUser: User) => {
        setUsersLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/admin/users/list?limit=50", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
                const data = await res.json();
                if (Array.isArray(data.items)) {
                    setUsers(data.items);
                }
            }
        } catch {
            toast.error("Failed to load users directory");
        } finally {
            setUsersLoading(false);
        }
    }, []);

    // Load existing partial offers
    const loadOffers = useCallback(async (currentUser: User) => {
        setOffersLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch("/api/admin/partial-offers", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
                const data = await res.json();
                if (Array.isArray(data.items)) {
                    setExistingOffers(data.items);
                }
            }
        } catch {
            toast.error("Failed to load existing partial offers");
        } finally {
            setOffersLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u && isAdminEmail(u.email)) {
                await ensureUserDocument(u);
                loadUsers(u);
                loadOffers(u);
            }
        });
        return () => unsub();
    }, [loadUsers, loadOffers]);

    // Filtered users for left column search
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const q = userSearch.toLowerCase();
        return users.filter((u) => u.email.toLowerCase().includes(q) || (u.plan || "").toLowerCase().includes(q));
    }, [users, userSearch]);

    // Handle select target user from directory
    const handleSelectTargetUser = (targetUser: SearchUser) => {
        setForm((prev) => ({
            ...prev,
            targetEmail: targetUser.email,
        }));
        setIsUnregisteredTarget(false);
        toast.info(`Targeting ${targetUser.email}`);
    };

    // Toggle plan selection in builder
    const togglePlan = (planKey: string) => {
        setForm((prev) => {
            const exists = prev.plans.includes(planKey);
            let nextPlans: string[];
            if (exists) {
                nextPlans = prev.plans.filter((p) => p !== planKey);
            } else {
                nextPlans = [...prev.plans, planKey];
            }
            return { ...prev, plans: nextPlans };
        });
    };

    const selectAllPlans = () => {
        setForm((prev) => ({
            ...prev,
            plans: prev.plans.length === ALL_PLANS.length ? [] : [...ALL_PLANS],
        }));
    };

    // Calculate live preview prices
    const previewCalculations = useMemo(() => {
        const sampleBasePriceINR = 999; // Pro plan sample base
        const val = Number(form.discountValue) || 0;
        let finalPriceINR = sampleBasePriceINR;

        if (form.discountType === "percentage") {
            finalPriceINR = Math.max(0, sampleBasePriceINR * (1 - Math.min(100, val) / 100));
        } else if (form.discountType === "flat") {
            finalPriceINR = Math.max(0, sampleBasePriceINR - val);
        } else if (form.discountType === "custom_price") {
            finalPriceINR = Math.max(0, val);
        }

        finalPriceINR = Math.round(finalPriceINR * 100) / 100;
        const savingsINR = Math.max(0, Math.round((sampleBasePriceINR - finalPriceINR) * 100) / 100);

        return { sampleBasePriceINR, finalPriceINR, savingsINR };
    }, [form.discountType, form.discountValue]);

    // Save/Publish Partial Offer
    const handlePublish = async () => {
        if (!user) return;
        const targetEmail = form.targetEmail.trim().toLowerCase();

        if (!targetEmail || !targetEmail.includes("@")) {
            toast.error("Please enter a valid target email address.");
            return;
        }

        if (form.plans.length === 0) {
            toast.error("Please select at least one plan for this offer.");
            return;
        }

        setPublishing(true);
        try {
            const token = await user.getIdToken();
            const payload = {
                targetEmail,
                title: form.title || "Special Promotional Offer",
                description: form.description || "",
                discountType: form.discountType,
                discountValue: Number(form.discountValue) || 0,
                plans: form.plans,
                billingCycle: form.billingCycle,
                startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null,
                expiresAt: form.isUnlimitedDuration ? null : form.expiresAt ? new Date(form.expiresAt).getTime() : null,
                usageLimit: form.isUnlimitedUsage ? null : form.usageLimit ? Number(form.usageLimit) : 1,
                priority: Number(form.priority) || 10,
                isActive: form.isActive,
                notes: form.notes,
            };

            const endpoint = editingId ? `/api/admin/partial-offers/${editingId}` : "/api/admin/partial-offers";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(endpoint, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            let data: any = {};
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(!res.ok ? `Server error (${res.status}): ${res.statusText || "Failed to process request"}` : "Unexpected response format");
            }

            if (!res.ok) throw new Error(data.message || "Failed to publish offer");

            toast.success(editingId ? "Partial offer updated!" : `Custom offer published for ${targetEmail}!`);
            setForm(initialFormState);
            setEditingId(null);
            loadOffers(user);
            emitAdminRefresh(router);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setPublishing(false);
        }
    };

    // Toggle active status of existing offer
    const handleToggleOfferStatus = async (offer: PartialOffer) => {
        if (!user || !offer.id) return;
        try {
            const token = await user.getIdToken();
            const nextActive = !offer.isActive;
            const res = await fetch(`/api/admin/partial-offers/${offer.id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ isActive: nextActive }),
            });
            if (res.ok) {
                toast.success(`Offer ${nextActive ? "enabled" : "disabled"}`);
                loadOffers(user);
                emitAdminRefresh(router);
            }
        } catch {
            toast.error("Failed to toggle offer status");
        }
    };

    // Revoke modal state & execution
    const [revokeModalOffer, setRevokeModalOffer] = useState<PartialOffer | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const handleConfirmRevoke = async (offer: PartialOffer | null) => {
        if (!user || !offer || !offer.id) return;

        setRevokingId(offer.id);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/partial-offers/${offer.id}/revoke`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(
                    `Offer revoked successfully! Reverted ${data.revertedEmails?.join(", ") || offer.targetEmail} to previous plan.`,
                    { duration: 5000 }
                );
                setRevokeModalOffer(null);
                loadOffers(user);
                emitAdminRefresh(router);
            } else {
                toast.error(data.message || "Failed to revoke offer.");
            }
        } catch {
            toast.error("An error occurred while revoking the offer.");
        } finally {
            setRevokingId(null);
        }
    };

    // Delete modal state & execution
    const [deleteModalOffer, setDeleteModalOffer] = useState<PartialOffer | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleConfirmDelete = async (offer: PartialOffer | null) => {
        if (!user || !offer || !offer.id) return;
        setDeletingId(offer.id);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/partial-offers/${offer.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                toast.success(`Partial offer "${offer.title}" deleted permanently.`);
                if (editingId === offer.id) {
                    setEditingId(null);
                    setForm(initialFormState);
                }
                setDeleteModalOffer(null);
                loadOffers(user);
                emitAdminRefresh(router);
            } else {
                toast.error("Failed to delete offer.");
            }
        } catch {
            toast.error("An error occurred while deleting the offer.");
        } finally {
            setDeletingId(null);
        }
    };

    // Edit existing offer
    const handleEditOffer = (offer: PartialOffer) => {
        if (!offer.id) return;
        setEditingId(offer.id);
        setForm({
            targetEmail: offer.targetEmail,
            title: offer.title,
            description: offer.description || "",
            discountType: offer.discountType,
            discountValue: String(offer.discountValue),
            plans: offer.plans || [],
            billingCycle: offer.billingCycle || "all",
            isUnlimitedDuration: !offer.expiresAt,
            startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString().slice(0, 16) : "",
            expiresAt: offer.expiresAt ? new Date(offer.expiresAt).toISOString().slice(0, 16) : "",
            isUnlimitedUsage: offer.usageLimit === null,
            usageLimit: offer.usageLimit !== null ? String(offer.usageLimit) : "1",
            priority: String(offer.priority || 10),
            isActive: offer.isActive,
            notes: offer.notes || "",
        });
        toast.info(`Editing offer for ${offer.targetEmail}`);
    };

    if (loading) return null;

    if (!user || !canAccess) {
        return (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl px-6 py-20 text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <h1 className="mt-5 text-3xl font-black text-slate-900">Admin Access Required</h1>
                <p className="mt-2 text-slate-500 font-medium">This panel is strictly reserved for authorized XURL administrators.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px] space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl p-6 rounded-[28px] border border-slate-200/80 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600">Dynamic Promotion Engine</p>
                    </div>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Partial Offers</h1>
                    <p className="text-sm font-medium text-slate-500">Grant custom, targeted promotional discounts directly to specific users or unregistered emails.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => {
                            if (user) {
                                loadUsers(user);
                                loadOffers(user);
                            }
                        }}
                        variant="outline"
                        className="border-slate-200/80 rounded-2xl h-11 px-4 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${usersLoading || offersLoading ? "animate-spin text-indigo-600" : ""}`} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Split Screen Layout: Left Panel (User Targeting & Manager) + Right Panel (Offer Builder) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ─── LEFT PANEL: TARGET SELECTION & MANAGER ───────────────────────── */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-sm">
                        {/* Tab Switcher */}
                        <div className="flex rounded-2xl bg-slate-100/90 p-1 mb-5">
                            <button
                                onClick={() => setLeftTab("users")}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${leftTab === "users" ? "bg-white text-indigo-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                            >
                                Active Users
                            </button>
                            <button
                                onClick={() => setLeftTab("manual")}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${leftTab === "manual" ? "bg-white text-indigo-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                            >
                                Manual Email
                            </button>
                            <button
                                onClick={() => setLeftTab("existing")}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${leftTab === "existing" ? "bg-white text-indigo-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                            >
                                Offers ({existingOffers.length})
                            </button>
                        </div>

                        {/* TAB 1: ACTIVE USERS DIRECTORY */}
                        {leftTab === "users" && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search active users by email or plan..."
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        className="h-11 pl-10 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs"
                                    />
                                </div>

                                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                                    {usersLoading ? (
                                        <div className="py-12 text-center text-xs text-slate-400 font-medium">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                            Fetching user list…
                                        </div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="py-10 text-center text-xs text-slate-400 font-medium rounded-2xl border border-dashed border-slate-200">
                                            No users found matching search query.
                                        </div>
                                    ) : (
                                        filteredUsers.map((u) => {
                                            const isSelected = form.targetEmail.toLowerCase() === u.email.toLowerCase();
                                            return (
                                                <div
                                                    key={u.id}
                                                    className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                                                        isSelected
                                                            ? "border-indigo-500 bg-indigo-50/80 shadow-sm"
                                                            : "border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-indigo-200"
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <div className="flex items-center gap-2">
                                                            <p className="truncate text-xs font-bold text-slate-900">{u.email}</p>
                                                            {isAdminEmail(u.email) && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">Admin</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                                                            <span className="capitalize">Plan: <strong className="text-slate-800">{u.plan || "Free"}</strong></span>
                                                            <span>Links: <strong className="text-slate-800">{u.activeLinks || 0}</strong></span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => handleSelectTargetUser(u)}
                                                        className={`rounded-xl h-8 text-xs font-bold transition-all ${
                                                            isSelected
                                                                ? "bg-indigo-600 text-white"
                                                                : "bg-white text-slate-700 border border-slate-200 hover:bg-indigo-600 hover:text-white"
                                                        }`}
                                                    >
                                                        {isSelected ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                                                        {isSelected ? "Targeted" : "Target"}
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: MANUAL EMAIL ENTRY */}
                        {leftTab === "manual" && (
                            <div className="space-y-4">
                                <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100 p-4">
                                    <div className="flex items-start gap-2.5">
                                        <Mail className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-indigo-950">Target Any Email Address</p>
                                            <p className="mt-0.5 text-[11px] text-indigo-700 font-medium leading-relaxed">
                                                Enter an existing customer email or an email that has not registered yet. If unregistered, the targeted offer will unlock immediately when they sign up!
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Target Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="email"
                                            placeholder="customer@example.com"
                                            value={form.targetEmail}
                                            onChange={(e) => setForm((f) => ({ ...f, targetEmail: e.target.value }))}
                                            className="h-12 pl-10 rounded-2xl border-slate-200/80 bg-white font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                                    <span className="text-xs font-bold text-slate-700">Target Unregistered Email</span>
                                    <input
                                        type="checkbox"
                                        checked={isUnregisteredTarget}
                                        onChange={(e) => setIsUnregisteredTarget(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 3: EXISTING OFFERS MANAGER */}
                        {leftTab === "existing" && (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {offersLoading ? (
                                    <div className="py-12 text-center text-xs text-slate-400 font-medium">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Loading offers…
                                    </div>
                                ) : existingOffers.length === 0 ? (
                                    <div className="py-10 text-center text-xs text-slate-400 font-medium rounded-2xl border border-dashed border-slate-200">
                                        No partial offers published yet.
                                    </div>
                                ) : (
                                    existingOffers.map((off) => (
                                        <div
                                            key={off.id}
                                            className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                                                off.isRevoked
                                                    ? "border-amber-200/80 bg-amber-50/20 shadow-2xs"
                                                    : off.isActive
                                                    ? "border-slate-200/80 bg-white shadow-sm hover:border-indigo-300"
                                                    : "border-slate-200 bg-slate-50/70 opacity-80"
                                            }`}
                                        >
                                            {/* Card Header: Badges & Action Controls */}
                                            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap border-b border-slate-100 pb-2.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-lg shrink-0">
                                                        {off.discountType === "percentage" ? `${off.discountValue}% OFF` : off.discountType === "flat" ? `₹${off.discountValue} OFF` : `₹${off.discountValue} Fixed`}
                                                    </span>
                                                    {off.isRevoked ? (
                                                        <span className="px-2.5 py-1 bg-amber-100/90 text-amber-900 border border-amber-300/80 rounded-lg text-[10px] font-black flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                                            <RotateCcw className="h-3 w-3 text-amber-700 shrink-0" />
                                                            Revoked & Reverted
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleOfferStatus(off)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors shrink-0 ${
                                                                off.isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                            }`}
                                                        >
                                                            {off.isActive ? "Active" : "Disabled"}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Action Buttons Group */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {!off.isRevoked && (
                                                        <button
                                                            type="button"
                                                            title="Revoke offer & revert user plan"
                                                            disabled={revokingId === off.id}
                                                            onClick={() => setRevokeModalOffer(off)}
                                                            className="px-2.5 py-1 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95 border border-amber-200/60 whitespace-nowrap"
                                                        >
                                                            {revokingId === off.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <RotateCcw className="h-3 w-3 text-amber-700" />
                                                            )}
                                                            Revoke
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditOffer(off)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition-colors"
                                                        title="Edit Offer"
                                                    >
                                                        <Sliders className="h-3.5 w-3.5" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Delete offer permanently"
                                                        disabled={deletingId === off.id}
                                                        onClick={() => setDeleteModalOffer(off)}
                                                        className="px-2.5 py-1 bg-rose-100/90 hover:bg-rose-200 text-rose-900 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95 border border-rose-200/60 whitespace-nowrap"
                                                    >
                                                        {deletingId === off.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-3 w-3 text-rose-700" />
                                                        )}
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Card Body: Full Title & Target Recipient Email */}
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-black text-slate-900 leading-snug break-words">
                                                    {off.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-600 break-all select-all">
                                                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                                    <span>{off.targetEmail}</span>
                                                </div>
                                            </div>

                                            {/* Card Footer: Redemption & Expiry Metadata */}
                                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                                                <span>Redeemed: <strong className="text-slate-700">{off.redemptionCount || 0} times</strong></span>
                                                <span>{off.expiresAt ? `Expires ${new Date(off.expiresAt).toLocaleDateString()}` : "No Expiry"}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── RIGHT PANEL: OFFER BUILDER & LIVE PREVIEW ────────────────────── */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 backdrop-blur-xl p-6 lg:p-8 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-indigo-600" />
                                <h2 className="text-lg font-black tracking-tight text-slate-900">
                                    {editingId ? "Edit Targeted Offer" : "Configure Custom Partial Offer"}
                                </h2>
                            </div>
                            {editingId && (
                                <button
                                    onClick={() => {
                                        setEditingId(null);
                                        setForm(initialFormState);
                                    }}
                                    className="text-xs font-bold text-rose-600 hover:underline"
                                >
                                    Cancel Editing
                                </button>
                            )}
                        </div>

                        {/* Form Inputs Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Target Email Indicator */}
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Target Recipient Email</label>
                                <Input
                                    type="email"
                                    placeholder="Select from left panel or type email address..."
                                    value={form.targetEmail}
                                    onChange={(e) => setForm((f) => ({ ...f, targetEmail: e.target.value }))}
                                    className="h-12 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm"
                                />
                            </div>

                            {/* Offer Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Offer Title</label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. VIP 90% Exclusive Upgrade"
                                    className="h-12 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm"
                                />
                            </div>

                            {/* Discount Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Discount Model</label>
                                <select
                                    value={form.discountType}
                                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as PartialOfferDiscountType }))}
                                    className="h-12 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 text-sm font-bold text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                                >
                                    <option value="percentage">Percentage Discount (%)</option>
                                    <option value="flat">Flat Amount OFF (₹)</option>
                                    <option value="custom_price">Custom Final Price (₹)</option>
                                </select>
                            </div>

                            {/* Discount Value */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                    {form.discountType === "percentage" ? "Percentage Value (%)" : form.discountType === "flat" ? "Flat Amount (₹)" : "Final Override Price (₹)"}
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.discountValue}
                                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                                    placeholder="e.g. 50"
                                    className="h-12 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm"
                                />
                            </div>

                            {/* Billing Cycle */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Billing Cycle Applicability</label>
                                <select
                                    value={form.billingCycle}
                                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as any }))}
                                    className="h-12 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 text-sm font-bold text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                                >
                                    <option value="all">All Cycles (Monthly & Annual)</option>
                                    <option value="monthly">Monthly Only</option>
                                    <option value="annual">Annual Only</option>
                                </select>
                            </div>

                            {/* Eligible Plans Selection */}
                            <div className="md:col-span-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Eligible Target Plans</label>
                                    <button type="button" onClick={selectAllPlans} className="text-xs font-bold text-indigo-600 hover:underline">
                                        {form.plans.length === ALL_PLANS.length ? "Deselect All" : "Select All Plans"}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                    {ALL_PLANS.map((p) => {
                                        const isSelected = form.plans.includes(p);
                                        const label = PLAN_CONFIGS[p as keyof typeof PLAN_CONFIGS]?.label || p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => togglePlan(p)}
                                                className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                                                    isSelected
                                                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                                                        : "border-slate-200/80 bg-slate-50/80 text-slate-700 hover:bg-white"
                                                }`}
                                            >
                                                {label} Plan
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Duration & Expiry */}
                            <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Duration & Expiry</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.isUnlimitedDuration}
                                            onChange={(e) => setForm((f) => ({ ...f, isUnlimitedDuration: e.target.checked }))}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-600">Unlimited Duration (No Expiry)</span>
                                    </label>
                                </div>
                                {!form.isUnlimitedDuration && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500">Starts At</label>
                                            <Input
                                                type="datetime-local"
                                                value={form.startsAt}
                                                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                                                className="h-10 rounded-xl text-xs font-bold bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500">Expires At</label>
                                            <Input
                                                type="datetime-local"
                                                value={form.expiresAt}
                                                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                                                className="h-10 rounded-xl text-xs font-bold bg-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Usage Limits */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Usage Limit</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.isUnlimitedUsage}
                                            onChange={(e) => setForm((f) => ({ ...f, isUnlimitedUsage: e.target.checked }))}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                                        />
                                        <span className="text-[11px] font-bold text-slate-500">Unlimited Uses</span>
                                    </label>
                                </div>
                                {!form.isUnlimitedUsage && (
                                    <Input
                                        type="number"
                                        min="1"
                                        value={form.usageLimit}
                                        onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                                        placeholder="1 for One-Time Use"
                                        className="h-11 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm"
                                    />
                                )}
                            </div>

                            {/* Priority & Status */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Offer Priority & Status</label>
                                <div className="flex gap-3">
                                    <Input
                                        type="number"
                                        value={form.priority}
                                        onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                                        placeholder="Priority (e.g. 10)"
                                        className="h-11 flex-1 rounded-2xl border-slate-200/80 bg-slate-50/80 font-bold text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                                        className={`px-4 h-11 rounded-2xl font-bold text-xs transition-all ${
                                            form.isActive ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                                        }`}
                                    >
                                        {form.isActive ? "Active" : "Disabled"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ─── LIVE INTERACTIVE PREVIEW CARD ─────────────────────────────────── */}
                        <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-white p-6 shadow-sm relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-3">
                                <Eye className="h-4 w-4 text-indigo-600" />
                                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">Live User Pricing Banner Preview</span>
                            </div>

                            <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-md space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                                        🎉 Admin Special Granted Offer
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        Target: {form.targetEmail || "customer@example.com"}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">{form.title || "Special VIP Discount"}</h3>
                                    <p className="text-xs text-slate-600 font-medium mt-0.5">{form.description || "Custom discount granted specially for your account."}</p>
                                </div>
                                <div className="flex items-baseline gap-3 pt-1">
                                    <span className="text-2xl font-black text-emerald-600">₹{previewCalculations.finalPriceINR}</span>
                                    <span className="text-sm font-bold text-slate-400 line-through">₹{previewCalculations.sampleBasePriceINR}</span>
                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                        Save ₹{previewCalculations.savingsINR}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setForm(initialFormState);
                                    setEditingId(null);
                                }}
                                className="rounded-2xl h-12 px-6 font-bold border-slate-200/80 hover:bg-slate-50"
                            >
                                Reset Form
                            </Button>
                            <Button
                                type="button"
                                disabled={publishing}
                                onClick={handlePublish}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-12 px-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 transition-all"
                            >
                                {publishing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Publishing…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {editingId ? "Update Offer" : "Publish Live Offer"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── CUSTOM ANIMATED REVOCATION MODAL DIALOG ────────────────────── */}
            <AnimatePresence>
                {revokeModalOffer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
                        onClick={() => !revokingId && setRevokeModalOffer(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-rose-500/30 bg-slate-900 text-white p-7 shadow-[0_25px_60px_-15px_rgba(244,63,94,0.35)]"
                        >
                            {/* Ambient Glow Effects */}
                            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
                            <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

                            {/* Header */}
                            <div className="relative z-10 flex items-start gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                                    <ShieldAlert className="h-6 w-6 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                                            Admin Action
                                        </span>
                                        <span className="text-[10px] font-extrabold uppercase text-slate-400">
                                            Offer ID #{revokeModalOffer.id?.slice(0, 8)}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black tracking-tight text-white mt-1">
                                        Revoke Offer & Revert Account Plan
                                    </h3>
                                </div>
                            </div>

                            {/* Target & Offer Summary Card */}
                            <div className="relative z-10 my-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Target User:</span>
                                    <span className="font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                        {revokeModalOffer.targetEmail}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Offer Title:</span>
                                    <span className="font-bold text-slate-200 truncate max-w-[220px]">
                                        {revokeModalOffer.title}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Redemption History:</span>
                                    <span className="font-bold text-emerald-400">
                                        Redeemed {revokeModalOffer.redemptionCount || 0} time(s)
                                    </span>
                                </div>
                            </div>

                            {/* Impact Breakdown */}
                            <div className="relative z-10 space-y-2.5 mb-6 text-xs text-slate-300">
                                <p className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                                    Immediate System Behavior:
                                </p>
                                <div className="flex items-start gap-2.5 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                                    <RotateCcw className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        Target user's plan will be <strong className="text-amber-300">immediately reverted</strong> to Free (or previous plan). Quotas & feature access update instantly.
                                    </p>
                                </div>
                                <div className="flex items-start gap-2.5 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        Created short links <strong className="text-emerald-300">remain active</strong> until their scheduled creation expiry time. No links broken.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="relative z-10 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    disabled={!!revokingId}
                                    onClick={() => setRevokeModalOffer(null)}
                                    className="rounded-2xl px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!!revokingId}
                                    onClick={() => handleConfirmRevoke(revokeModalOffer)}
                                    className="rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black px-6 py-2.5 text-xs shadow-[0_0_25px_rgba(244,63,94,0.4)] hover:shadow-[0_0_35px_rgba(244,63,94,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {revokingId === revokeModalOffer.id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span>Revoking & Reverting Account…</span>
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw className="h-4 w-4" />
                                            <span>Revoke & Revert Account Now</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── CUSTOM ANIMATED DELETE MODAL DIALOG ────────────────────── */}
            <AnimatePresence>
                {deleteModalOffer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
                        onClick={() => !deletingId && setDeleteModalOffer(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-rose-600/40 bg-slate-900 text-white p-7 shadow-[0_25px_60px_-15px_rgba(225,29,72,0.4)]"
                        >
                            {/* Ambient Glow Effects */}
                            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-600/20 blur-3xl pointer-events-none" />
                            <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-red-600/15 blur-3xl pointer-events-none" />

                            {/* Header */}
                            <div className="relative z-10 flex items-start gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                                    <Trash2 className="h-6 w-6 animate-pulse text-rose-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                                            Permanent Action
                                        </span>
                                        <span className="text-[10px] font-extrabold uppercase text-slate-400">
                                            Offer ID #{deleteModalOffer.id?.slice(0, 8)}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black tracking-tight text-white mt-1">
                                        Delete Partial Offer Permanently
                                    </h3>
                                </div>
                            </div>

                            {/* Target & Offer Summary Card */}
                            <div className="relative z-10 my-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Target User:</span>
                                    <span className="font-mono font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                                        {deleteModalOffer.targetEmail}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Offer Title:</span>
                                    <span className="font-bold text-slate-200 truncate max-w-[220px]">
                                        {deleteModalOffer.title}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">Redemption History:</span>
                                    <span className="font-bold text-slate-300">
                                        Redeemed {deleteModalOffer.redemptionCount || 0} time(s)
                                    </span>
                                </div>
                            </div>

                            {/* Consequences List */}
                            <div className="relative z-10 space-y-2.5 mb-6 text-xs text-slate-300">
                                <p className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                                    Consequences of Deletion:
                                </p>
                                <div className="flex items-start gap-2.5 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                                    <Trash2 className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        This offer configuration will be <strong className="text-rose-300">permanently removed</strong> from the database. It cannot be undone.
                                    </p>
                                </div>
                                <div className="flex items-start gap-2.5 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                                    <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        An audit log entry (`OFFER_DELETED`) will be recorded in `admin_logs` for compliance tracking.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="relative z-10 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    disabled={!!deletingId}
                                    onClick={() => setDeleteModalOffer(null)}
                                    className="rounded-2xl px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!!deletingId}
                                    onClick={() => handleConfirmDelete(deleteModalOffer)}
                                    className="rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black px-6 py-2.5 text-xs shadow-[0_0_25px_rgba(225,29,72,0.5)] hover:shadow-[0_0_35px_rgba(225,29,72,0.7)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {deletingId === deleteModalOffer.id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span>Deleting Offer…</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            <span>Delete Offer Permanently</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

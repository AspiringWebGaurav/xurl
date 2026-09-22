"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    Coins,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Building2,
    Link2,
    Zap,
    IndianRupee,
    MessageSquare,
    Filter,
    ArrowRight,
    Edit3,
    RotateCcw,
    Calendar,
    Layers,
    Copy,
    Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type CustomPricingRequest = {
    id: string;
    userId?: string | null;
    email: string;
    companyName?: string | null;
    linksNeeded: number;
    apiQuotaNeeded: number;
    proposedPriceINR: number;
    notes: string;
    status: "pending" | "curated" | "rejected";
    createdAt: number;
    curatedAt?: number | null;
    curatedBy?: string | null;
    curatedPriceINR?: number | null;
    curatedLinks?: number | null;
    curatedApiQuota?: number | null;
    curatedOfferId?: string | null;
    adminNotes?: string | null;
};

export default function AdminCustomPricingPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<CustomPricingRequest[]>([]);
    const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "curated" | "rejected">("pending");
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

    // Curate / Edit Modal State with ALL fields
    const [curateModal, setCurateModal] = useState<CustomPricingRequest | null>(null);
    const [approvedPrice, setApprovedPrice] = useState<number>(0);
    const [approvedLinks, setApprovedLinks] = useState<number>(50000);
    const [approvedApiQuota, setApprovedApiQuota] = useState<number>(2000000);
    const [customTitle, setCustomTitle] = useState("");
    const [curateNotes, setCurateNotes] = useState("");
    const [eligiblePlan, setEligiblePlan] = useState<string>("all");
    const [expiresInDays, setExpiresInDays] = useState<string>("none");

    // Reject Modal State
    const [rejectModal, setRejectModal] = useState<CustomPricingRequest | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const fetchRequests = async (currentUser?: User | null) => {
        const u = currentUser || auth.currentUser;
        if (!u) return;

        try {
            const token = await u.getIdToken();
            const res = await fetch(`/api/admin/custom-pricing?status=${filterStatus}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            } else {
                toast.error("Failed to load custom pricing proposals.");
            }
        } catch (err) {
            console.error("Error fetching proposals:", err);
            toast.error("Network error while loading proposals.");
        }
    };

    useEffect(() => {
        let mounted = true;
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!mounted) return;
            if (u) await ensureUserDocument(u);
            setUser(u);
            setLoading(false);
            if (u && isAdminEmail(u.email)) {
                fetchRequests(u);
            }
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, [filterStatus]);

    const openCurateModal = (req: CustomPricingRequest) => {
        setCurateModal(req);
        setApprovedPrice(req.curatedPriceINR ?? req.proposedPriceINR ?? 1499);
        setApprovedLinks(req.curatedLinks ?? req.linksNeeded ?? 50000);
        setApprovedApiQuota(req.curatedApiQuota ?? req.apiQuotaNeeded ?? 2000000);
        setCustomTitle(`Curated Enterprise Plan for ${req.email}`);
        setCurateNotes(
            req.adminNotes ||
            `Curated custom plan: ${(req.curatedLinks ?? req.linksNeeded ?? 50000).toLocaleString()} permanent links & ${(req.curatedApiQuota ?? req.apiQuotaNeeded ?? 2000000).toLocaleString()} API calls/mo.`
        );
        setEligiblePlan("all");
        setExpiresInDays("none");
    };

    const handleCurateSubmit = async () => {
        if (!user || !curateModal) return;
        setActionLoadingId(curateModal.id);

        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/custom-pricing/${curateModal.id}/curate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "curate",
                    approvedPriceINR: approvedPrice,
                    approvedLinks,
                    approvedApiQuota,
                    customTitle,
                    notes: curateNotes,
                    eligiblePlans: eligiblePlan === "all" ? ["all"] : [eligiblePlan],
                    expiresInDays: expiresInDays === "none" ? null : parseInt(expiresInDays, 10),
                }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Custom plan curated and rendered to ${curateModal.email} for ₹${approvedPrice.toLocaleString()}/mo!`);
                setCurateModal(null);
                fetchRequests(user);
            } else {
                toast.error(data.message || "Failed to curate plan");
            }
        } catch (err) {
            console.error("Curate error:", err);
            toast.error("Failed to curate plan");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!user || !rejectModal) return;
        setActionLoadingId(rejectModal.id);

        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/custom-pricing/${rejectModal.id}/curate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "reject",
                    notes: rejectReason.trim() || "Proposal declined by administrator.",
                }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Proposal rejected and any active offers revoked.");
                setRejectModal(null);
                setRejectReason("");
                fetchRequests(user);
            } else {
                toast.error(data.message || "Failed to reject proposal");
            }
        } catch (err) {
            console.error("Reject error:", err);
            toast.error("Failed to reject proposal");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleReopen = async (req: CustomPricingRequest) => {
        if (!user) return;
        setActionLoadingId(req.id);

        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/custom-pricing/${req.id}/curate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "reopen",
                    notes: "Reopened proposal for review.",
                }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Proposal reopened as pending.");
                fetchRequests(user);
            } else {
                toast.error(data.message || "Failed to reopen proposal");
            }
        } catch (err) {
            console.error("Reopen error:", err);
            toast.error("Failed to reopen proposal");
        } finally {
            setActionLoadingId(null);
        }
    };

    const copyEmailToClipboard = (email: string) => {
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        toast.success(`Copied ${email} to clipboard!`);
        setTimeout(() => setCopiedEmail(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || !isAdminEmail(user.email)) {
        return (
            <div className="p-8 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-3" />
                <h1 className="text-xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground mt-1">You must be an administrator to view this page.</p>
            </div>
        );
    }

    const pendingCount = requests.filter((r) => r.status === "pending").length;
    const curatedCount = requests.filter((r) => r.status === "curated").length;
    const rejectedCount = requests.filter((r) => r.status === "rejected").length;

    return (
        <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3">
                        <Coins className="h-7 w-7 text-primary" />
                        <span>Custom Pricing Proposals & Curation</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review customer pricing proposals. Edit any field (price, links, API quota, validity) and render the curated plan directly to their account for instant 1-click checkout.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRequests(user)}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh Queue</span>
                </Button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setFilterStatus("pending")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                        filterStatus === "pending"
                            ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                    <Clock className="h-4 w-4" />
                    <span>Pending Review ({pendingCount})</span>
                </button>
                <button
                    onClick={() => setFilterStatus("all")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                        filterStatus === "all"
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                    <Filter className="h-4 w-4" />
                    <span>All Proposals ({requests.length})</span>
                </button>
                <button
                    onClick={() => setFilterStatus("curated")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                        filterStatus === "curated"
                            ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Curated & Rendered ({curatedCount})</span>
                </button>
                <button
                    onClick={() => setFilterStatus("rejected")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                        filterStatus === "rejected"
                            ? "bg-rose-500/20 text-rose-500 border border-rose-500/40"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                    <XCircle className="h-4 w-4" />
                    <span>Rejected ({rejectedCount})</span>
                </button>
            </div>

            {/* List */}
            {requests.length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
                    <Coins className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="text-lg font-bold text-foreground">No proposals found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        There are currently no proposals matching the &quot;{filterStatus}&quot; filter.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {requests.map((req) => {
                        const isPending = req.status === "pending";
                        const isCurated = req.status === "curated";
                        const isRejected = req.status === "rejected";

                        return (
                            <div
                                key={req.id}
                                className={`rounded-2xl border p-5 sm:p-6 transition backdrop-blur-xl shadow-lg ${
                                    isPending
                                        ? "border-amber-500/30 bg-card/90"
                                        : isCurated
                                        ? "border-emerald-500/30 bg-card/90"
                                        : "border-border/60 bg-muted/20 opacity-80"
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                    <div className="space-y-3 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-extrabold text-base sm:text-lg text-foreground">
                                                {req.email}
                                            </span>
                                            <button
                                                onClick={() => copyEmailToClipboard(req.email)}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
                                                title="Copy email"
                                            >
                                                {copiedEmail === req.email ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>

                                            {req.companyName && (
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground flex items-center gap-1">
                                                    <Building2 className="h-3 w-3 text-primary" /> {req.companyName}
                                                </span>
                                            )}

                                            {/* Status Badge */}
                                            {isPending && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Needs Review
                                                </span>
                                            )}
                                            {isCurated && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Rendered on Account
                                                </span>
                                            )}
                                            {isRejected && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1">
                                                    <XCircle className="h-3 w-3" /> Rejected
                                                </span>
                                            )}
                                        </div>

                                        {/* Metrics requested */}
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
                                            <span className="flex items-center gap-1">
                                                <Link2 className="h-3.5 w-3.5 text-primary" />
                                                Requested Links: <strong className="text-foreground">{req.linksNeeded.toLocaleString()}</strong>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                                                Requested API: <strong className="text-foreground">{req.apiQuotaNeeded.toLocaleString()}/mo</strong>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
                                                Proposed Budget: <strong className="text-emerald-500 text-sm font-black">₹{req.proposedPriceINR.toLocaleString()}/mo</strong>
                                            </span>
                                            <span>
                                                Submitted: {req.createdAt ? format(new Date(req.createdAt), "PPp") : "N/A"}
                                            </span>
                                        </div>

                                        {/* User Notes */}
                                        {req.notes && (
                                            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs sm:text-sm text-foreground flex items-start gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-muted-foreground font-semibold">User Notes: </span>
                                                    <span>{req.notes}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Curated Details */}
                                        {isCurated && req.curatedAt && (
                                            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 space-y-1.5">
                                                <div className="font-bold flex items-center gap-1.5 text-sm">
                                                    <Sparkles className="h-4 w-4" />
                                                    <span>Curated Rate: ₹{req.curatedPriceINR?.toLocaleString()}/mo · {(req.curatedLinks || req.linksNeeded).toLocaleString()} Links · {(req.curatedApiQuota || req.apiQuotaNeeded).toLocaleString()} API/mo</span>
                                                </div>
                                                <p className="text-[11px] opacity-90">
                                                    Curated by {req.curatedBy || "admin"} on {format(new Date(req.curatedAt), "PPp")}.
                                                    {req.curatedOfferId && ` (Offer ID: ${req.curatedOfferId} active on user's /pricing & dashboard)`}
                                                </p>
                                                {req.adminNotes && (
                                                    <p className="text-[11px] text-foreground font-medium bg-background/50 p-2 rounded-lg border border-emerald-500/20">
                                                        <strong>Admin Message to User:</strong> {req.adminNotes}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Rejected Details */}
                                        {isRejected && req.adminNotes && (
                                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 space-y-1">
                                                <p className="font-bold flex items-center gap-1.5">
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    <span>Rejection Reason: {req.adminNotes}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
                                        {isPending && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRejectModal(req);
                                                        setRejectReason("");
                                                    }}
                                                    disabled={actionLoadingId === req.id}
                                                    className="border-border text-foreground hover:bg-muted font-semibold cursor-pointer"
                                                >
                                                    <XCircle className="h-4 w-4 text-rose-500 mr-1" />
                                                    <span>Reject</span>
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    onClick={() => openCurateModal(req)}
                                                    disabled={actionLoadingId === req.id}
                                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    <span>Curate & Render Plan</span>
                                                </Button>
                                            </>
                                        )}

                                        {isCurated && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openCurateModal(req)}
                                                    disabled={actionLoadingId === req.id}
                                                    className="border-border text-foreground hover:bg-muted font-semibold cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5 text-primary" />
                                                    <span>Edit Curated Plan</span>
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRejectModal(req);
                                                        setRejectReason("Curated offer revoked by administrator.");
                                                    }}
                                                    disabled={actionLoadingId === req.id}
                                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    <span>Revoke Offer</span>
                                                </Button>
                                            </>
                                        )}

                                        {isRejected && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReopen(req)}
                                                    disabled={actionLoadingId === req.id}
                                                    className="border-border text-foreground hover:bg-muted font-semibold cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                                                    <span>Reopen as Pending</span>
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    onClick={() => openCurateModal(req)}
                                                    disabled={actionLoadingId === req.id}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    <span>Curate Plan</span>
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Comprehensive Curate / Edit Modal */}
            {curateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-8">
                        <div className="flex items-start justify-between border-b border-border/60 pb-3">
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    <span>Curate & Render Custom Plan</span>
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Recipient: <strong className="text-foreground">{curateModal.email}</strong> {curateModal.companyName && `(${curateModal.companyName})`}
                                </p>
                            </div>
                            <button
                                onClick={() => setCurateModal(null)}
                                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs sm:text-sm">
                            {/* Price field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
                                        <span>Approved Price in Rupees (₹ / month):</span>
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">
                                        User proposed: <strong>₹{curateModal.proposedPriceINR.toLocaleString()}</strong>
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    value={approvedPrice}
                                    onChange={(e) => setApprovedPrice(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-base font-black text-emerald-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    min={1}
                                    required
                                />
                            </div>

                            {/* Links & API Quota grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Link2 className="h-3.5 w-3.5 text-primary" />
                                            <span>Permanent Links:</span>
                                        </span>
                                        <span className="text-muted-foreground text-[10px]">
                                            Req: {curateModal.linksNeeded.toLocaleString()}
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        value={approvedLinks}
                                        onChange={(e) => setApprovedLinks(Number(e.target.value))}
                                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        min={1}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                                            <span>Monthly API Calls:</span>
                                        </span>
                                        <span className="text-muted-foreground text-[10px]">
                                            Req: {curateModal.apiQuotaNeeded.toLocaleString()}
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        value={approvedApiQuota}
                                        onChange={(e) => setApprovedApiQuota(Number(e.target.value))}
                                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        min={1}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Plan title */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Curated Plan Title:</label>
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="e.g. Curated Scale-Up Plan"
                                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                            </div>

                            {/* Eligible Plan & Expiry Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                                        <Layers className="h-3.5 w-3.5 text-primary" />
                                        <span>Target Base Tier:</span>
                                    </label>
                                    <select
                                        value={eligiblePlan}
                                        onChange={(e) => setEligiblePlan(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                        <option value="all">All Paid Plans</option>
                                        <option value="enterprise">Enterprise Tier Only</option>
                                        <option value="business">Business Tier Only</option>
                                        <option value="pro">Pro Tier Only</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        <span>Offer Expiry / Validity:</span>
                                    </label>
                                    <select
                                        value={expiresInDays}
                                        onChange={(e) => setExpiresInDays(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                        <option value="none">No Expiry (Active until redeemed)</option>
                                        <option value="7">7 Days</option>
                                        <option value="14">14 Days</option>
                                        <option value="30">30 Days</option>
                                    </select>
                                </div>
                            </div>

                            {/* Message to customer */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Message / Notes to Customer (Shown on their billing view):</label>
                                <textarea
                                    value={curateNotes}
                                    onChange={(e) => setCurateNotes(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Includes 50,000 permanent links & 2M API calls/mo with dedicated throughput..."
                                    className="w-full p-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                            <Button
                                variant="outline"
                                onClick={() => setCurateModal(null)}
                                disabled={actionLoadingId === curateModal.id}
                                className="cursor-pointer"
                            >
                                Cancel
                            </Button>

                            <Button
                                onClick={handleCurateSubmit}
                                disabled={actionLoadingId === curateModal.id || approvedPrice <= 0}
                                className="font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg cursor-pointer"
                            >
                                {actionLoadingId === curateModal.id ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Rendering Plan...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        <span>Render & Offer to Customer</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <XCircle className="h-5 w-5 text-rose-500" />
                                    <span>Reject Proposal</span>
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    For recipient: <strong className="text-foreground">{rejectModal.email}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setRejectModal(null)}
                                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-foreground">Reason for Rejection (Optional message to user):</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. Requested volume exceeds single-tenant capacity. Please consider our Business tier or contact sales."
                                rows={3}
                                className="w-full p-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setRejectModal(null)}
                                disabled={actionLoadingId === rejectModal.id}
                                className="cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleRejectSubmit}
                                disabled={actionLoadingId === rejectModal.id}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                            >
                                {actionLoadingId === rejectModal.id ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        <span>Rejecting...</span>
                                    </>
                                ) : (
                                    <span>Confirm Rejection</span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

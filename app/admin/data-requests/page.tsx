"use client";

import { useEffect, useState, useTransition } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    Trash2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ShieldAlert,
    RefreshCw,
    UserX,
    Database,
    Link2,
    Calendar,
    MessageSquare,
    Filter
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type DeletionRequest = {
    id: string;
    userId: string;
    email: string;
    displayName?: string;
    plan?: string;
    activeLinks?: number;
    linksCreated?: number;
    cumulativeQuota?: number;
    reason: string;
    status: "pending" | "approved" | "rejected";
    requestedAt: number;
    processedAt?: number | null;
    processedBy?: string | null;
    notes?: string | null;
    linksPurged?: number;
};

export default function AdminDataRequestsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        request: DeletionRequest;
        action: "approve" | "reject";
    } | null>(null);
    const [actionNotes, setActionNotes] = useState("");

    const fetchRequests = async (currentUser?: User | null) => {
        const u = currentUser || auth.currentUser;
        if (!u) return;

        try {
            const token = await u.getIdToken();
            const res = await fetch(`/api/admin/data-requests?status=${filterStatus}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            } else {
                toast.error("Failed to load deletion requests.");
            }
        } catch (err) {
            console.error("Error fetching requests:", err);
            toast.error("Network error while loading deletion requests.");
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

    const handleAction = async (requestId: string, action: "approve" | "reject", notes?: string) => {
        if (!user) return;
        setActionLoadingId(requestId);

        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/data-requests/${requestId}/action`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action, notes }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(
                    action === "approve"
                        ? "Account & links permanently purged from database & Redis!"
                        : "Deletion request rejected. User data and links retained in database."
                );
                setConfirmModal(null);
                setActionNotes("");
                fetchRequests(user);
            } else {
                toast.error(data.message || "Failed to process request");
            }
        } catch (err) {
            console.error("Action error:", err);
            toast.error("Failed to perform action");
        } finally {
            setActionLoadingId(null);
        }
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
    const approvedCount = requests.filter((r) => r.status === "approved").length;
    const rejectedCount = requests.filter((r) => r.status === "rejected").length;

    return (
        <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3">
                        <UserX className="h-7 w-7 text-primary" />
                        <span>Data & Link Deletion Queue</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review user deletion requests. <strong className="text-foreground">YES</strong> permanently deletes all user links from Firestore and Redis. <strong className="text-foreground">NO</strong> rejects the request and keeps data in the database.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRequests(user)}
                    className="flex items-center gap-2"
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
                    <span>All Requests ({requests.length})</span>
                </button>
                <button
                    onClick={() => setFilterStatus("approved")}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                        filterStatus === "approved"
                            ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approved & Purged ({approvedCount})</span>
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
                    <span>Rejected & Retained ({rejectedCount})</span>
                </button>
            </div>

            {/* Requests List */}
            {requests.length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card/60 p-12 text-center">
                    <Database className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="text-lg font-bold text-foreground">No requests found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        There are currently no deletion requests matching the &quot;{filterStatus}&quot; filter.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {requests.map((req) => {
                        const isPending = req.status === "pending";
                        const isApproved = req.status === "approved";
                        const isRejected = req.status === "rejected";

                        return (
                            <div
                                key={req.id}
                                className={`rounded-2xl border p-5 sm:p-6 transition backdrop-blur-xl shadow-lg ${
                                    isPending
                                        ? "border-amber-500/30 bg-card/90"
                                        : isApproved
                                        ? "border-emerald-500/20 bg-muted/20 opacity-80"
                                        : "border-border/60 bg-muted/20 opacity-80"
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                    {/* Left: User Identity & Request Info */}
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-extrabold text-base sm:text-lg text-foreground truncate">
                                                {req.displayName || req.email}
                                            </span>
                                            <span className="text-xs font-mono text-muted-foreground truncate">
                                                ({req.email})
                                            </span>

                                            {/* Status Badge */}
                                            {isPending && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Pending Review
                                                </span>
                                            )}
                                            {isApproved && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Data & Links Purged
                                                </span>
                                            )}
                                            {isRejected && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1">
                                                    <XCircle className="h-3 w-3" /> Request Rejected (Data Retained)
                                                </span>
                                            )}
                                        </div>

                                        {/* Metadata Row */}
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                                Requested: {req.requestedAt ? format(new Date(req.requestedAt), "PPp") : "N/A"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Link2 className="h-3.5 w-3.5 text-primary" />
                                                Active Links: <strong className="text-foreground">{req.activeLinks ?? 0}</strong>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                Plan: <strong className="text-foreground uppercase">{req.plan || "free"}</strong>
                                            </span>
                                            {req.cumulativeQuota ? (
                                                <span>Banked Quota: {req.cumulativeQuota}</span>
                                            ) : null}
                                        </div>

                                        {/* User Reason */}
                                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs sm:text-sm text-foreground flex items-start gap-2">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-muted-foreground font-semibold">User Reason: </span>
                                                <span>{req.reason}</span>
                                            </div>
                                        </div>

                                        {/* Processed Notes */}
                                        {!isPending && req.processedAt && (
                                            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                                                <p>
                                                    Processed by <span className="font-semibold text-foreground">{req.processedBy}</span> on {format(new Date(req.processedAt), "PPp")}
                                                </p>
                                                {req.notes && <p className="italic">&quot;{req.notes}&quot;</p>}
                                                {req.linksPurged !== undefined && (
                                                    <p className="font-semibold text-rose-500">{req.linksPurged} links deleted from Firestore & evicted from Redis.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: YES / NO Action Buttons (Only for Pending) */}
                                    {isPending && (
                                        <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setConfirmModal({ request: req, action: "reject" })}
                                                disabled={actionLoadingId === req.id}
                                                className="border-border hover:bg-muted text-foreground font-bold flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <XCircle className="h-4 w-4 text-rose-500" />
                                                <span>NO (Reject & Retain)</span>
                                            </Button>

                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setConfirmModal({ request: req, action: "approve" })}
                                                disabled={actionLoadingId === req.id}
                                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span>YES (Approve & Purge)</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-2xl ${
                                confirmModal.action === "approve" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                            }`}>
                                {confirmModal.action === "approve" ? (
                                    <AlertTriangle className="h-6 w-6" />
                                ) : (
                                    <ShieldAlert className="h-6 w-6" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-foreground">
                                    {confirmModal.action === "approve"
                                        ? "Approve Deletion (YES)?"
                                        : "Reject Deletion (NO)?"}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {confirmModal.action === "approve"
                                        ? `This will PERMANENTLY delete all ${confirmModal.request.activeLinks || 0} links for ${confirmModal.request.email}, evict them from Redis, and purge their user record. This action CANNOT be undone.`
                                        : `This will reject the deletion request for ${confirmModal.request.email}. All their links and account data will remain untouched in the database.`}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-foreground">Admin Notes / Reason (Optional):</label>
                            <input
                                type="text"
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="E.g. Approved per GDPR request / Retained due to active investigation"
                                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setConfirmModal(null);
                                    setActionNotes("");
                                }}
                                disabled={actionLoadingId === confirmModal.request.id}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant={confirmModal.action === "approve" ? "destructive" : "default"}
                                onClick={() => handleAction(confirmModal.request.id, confirmModal.action, actionNotes)}
                                disabled={actionLoadingId === confirmModal.request.id}
                                className="font-bold flex items-center gap-2"
                            >
                                {actionLoadingId === confirmModal.request.id ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : confirmModal.action === "approve" ? (
                                    <>
                                        <Trash2 className="h-4 w-4" />
                                        <span>Confirm Purge (YES)</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4" />
                                        <span>Reject Request (NO)</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

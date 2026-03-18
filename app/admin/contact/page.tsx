"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Mail, MailOpen, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import type { ContactSubmissionDocument } from "@/types";
import { formatDistanceToNow } from "date-fns";

type FilterType = "all" | "new" | "unresolved" | "resolved";

export default function AdminContactPage() {
    const [submissions, setSubmissions] = useState<ContactSubmissionDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [summary, setSummary] = useState({
        newCount: 0,
        readCount: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        totalCount: 0,
    });
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchSubmissions = async (cursor?: string | null) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const params = new URLSearchParams({ limit: "50" });
            
            if (cursor) params.append("cursor", cursor);
            if (filter === "new") params.append("status", "new");
            if (filter === "unresolved") params.append("resolved", "false");
            if (filter === "resolved") params.append("resolved", "true");

            const response = await fetch(`/api/admin/contact?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) return;

            const data = await response.json();
            
            if (cursor) {
                setSubmissions((prev) => [...prev, ...data.items]);
            } else {
                setSubmissions(data.items);
            }
            
            setNextCursor(data.nextCursor);
            setHasMore(data.hasMore);
            setSummary(data.summary);
        } catch (error) {
            console.error("Failed to fetch submissions:", error);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setSubmissions([]);
            setNextCursor(null);
            setExpandedId(null);
            await fetchSubmissions();
            setLoading(false);
        });

        return () => unsub();
    }, [filter]);

    const handleLoadMore = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        await fetchSubmissions(nextCursor);
        setLoadingMore(false);
    };

    const handleToggleExpand = async (id: string, currentStatus: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(id);

        if (currentStatus === "new") {
            await updateSubmission(id, { status: "read" });
        }
    };

    const updateSubmission = async (id: string, updates: { status?: "new" | "read"; isResolved?: boolean }) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/contact/${id}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) return;

            setSubmissions((prev) =>
                prev.map((sub) =>
                    sub.id === id
                        ? { ...sub, ...updates, updatedAt: Date.now() }
                        : sub
                )
            );

            await fetchSubmissions();
        } catch (error) {
            console.error("Failed to update submission:", error);
        }
    };

    const filters: { key: FilterType; label: string; count: number }[] = [
        { key: "all", label: "All", count: summary.totalCount },
        { key: "new", label: "New", count: summary.newCount },
        { key: "unresolved", label: "Unresolved", count: summary.unresolvedCount },
        { key: "resolved", label: "Resolved", count: summary.resolvedCount },
    ];

    return (
        <div className="space-y-6">
            <div className="rounded-[22px] border border-slate-200/80 bg-white px-6 py-6 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Contact Submissions</h1>
                <p className="mt-1 text-sm text-slate-600">View and manage support requests</p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {filters.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                filter === f.key
                                    ? "border-slate-300 bg-slate-900/5 text-slate-900"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {f.label}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {f.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center rounded-[22px] border border-slate-200/80 bg-white px-6 py-12 shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : submissions.length === 0 ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
                    <p className="text-sm text-slate-500">No submissions found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {submissions.map((submission) => {
                        const isExpanded = expandedId === submission.id;
                        const isNew = submission.status === "new";

                        return (
                            <div
                                key={submission.id}
                                className={`rounded-[18px] border bg-white shadow-sm transition-all ${
                                    isNew ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200/80"
                                }`}
                            >
                                <div
                                    className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4"
                                    onClick={() => handleToggleExpand(submission.id, submission.status)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 ${isNew ? "text-indigo-600" : "text-slate-400"}`}>
                                            {isNew ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-slate-900">{submission.name}</p>
                                                {submission.isResolved && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Resolved
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">{submission.email}</p>
                                            {!isExpanded && (
                                                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                                    {submission.message.substring(0, 100)}
                                                    {submission.message.length > 100 && "..."}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                            {formatDistanceToNow(submission.createdAt, { addSuffix: true })}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 px-5 py-4">
                                        {submission.subject && (
                                            <div className="mb-3">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</p>
                                                <p className="mt-1 text-sm text-slate-900">{submission.subject}</p>
                                            </div>
                                        )}
                                        <div className="mb-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Message</p>
                                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-900">{submission.message}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateSubmission(submission.id, {
                                                        status: submission.status === "new" ? "read" : "new",
                                                    });
                                                }}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                            >
                                                Mark as {submission.status === "new" ? "read" : "unread"}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateSubmission(submission.id, {
                                                        isResolved: !submission.isResolved,
                                                    });
                                                }}
                                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                                    submission.isResolved
                                                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                                }`}
                                            >
                                                {submission.isResolved ? "Mark as unresolved" : "Mark as resolved"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>Load more</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

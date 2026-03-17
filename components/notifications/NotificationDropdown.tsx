"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Bell } from "lucide-react";
import { NotificationItem, type NotificationRecord } from "@/components/notifications/NotificationItem";

interface NotificationDropdownProps {
    notifications: NotificationRecord[];
    loading: boolean;
    emptyMessage?: string;
    onAction: (notification: NotificationRecord) => void;
    onMarkRead?: (notification: NotificationRecord) => void;
    highlightId?: string | null;
    onViewAll?: () => void;
    showHeader?: boolean;
    showFooter?: boolean;
}

type Group = {
    label: string;
    items: NotificationRecord[];
};

function groupNotifications(items: NotificationRecord[]): Group[] {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = format(yesterday, "yyyy-MM-dd");

    const groups: Record<string, NotificationRecord[]> = {
        Today: [],
        Yesterday: [],
        Earlier: [],
    };

    items.forEach((item) => {
        const itemKey = format(new Date(item.createdAt), "yyyy-MM-dd");
        if (itemKey === todayKey) {
            groups.Today.push(item);
        } else if (itemKey === yesterdayKey) {
            groups.Yesterday.push(item);
        } else {
            groups.Earlier.push(item);
        }
    });

    return [
        { label: "Today", items: groups.Today },
        { label: "Yesterday", items: groups.Yesterday },
        { label: "Earlier", items: groups.Earlier },
    ].filter((group) => group.items.length > 0);
}

export function NotificationDropdown({
    notifications,
    loading,
    emptyMessage,
    onAction,
    onMarkRead,
    highlightId,
    onViewAll,
    showHeader = true,
    showFooter = true,
}: NotificationDropdownProps) {
    const groups = useMemo(() => groupNotifications(notifications), [notifications]);

    return (
        <div className="flex flex-col gap-4">
            {showHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">Notifications</p>
                        <p className="text-sm font-semibold text-slate-900">Your latest updates</p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                    Loading notifications…
                </div>
            )}

            {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                    <Bell className="h-4 w-4 text-slate-400" />
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-700">You're all caught up</p>
                        <p className="text-xs text-slate-500">{emptyMessage ?? "No new notifications right now."}</p>
                    </div>
                </div>
            )}

            {!loading && notifications.length > 0 && (
                <div className="flex flex-col gap-4 scroll-smooth">
                    {groups.map((group) => (
                        <div key={group.label} className="space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
                            <div className="space-y-2">
                                {group.items.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onAction={() => onAction(notification)}
                                        onMarkRead={onMarkRead ? () => onMarkRead(notification) : undefined}
                                        highlighted={highlightId === notification.id}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showFooter && (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="flex items-center justify-between text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                >
                    <span>View all notifications</span>
                    <span aria-hidden>→</span>
                </button>
            )}
        </div>
    );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ArrowRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NotificationRecord = {
    id: string;
    type: string;
    title: string;
    message: string;
    action?: {
        type: "REDIRECT";
        url: string;
        label: string;
    } | null;
    read: boolean;
    createdAt: number;
};

interface NotificationItemProps {
    notification: NotificationRecord;
    onAction: () => void;
    onMarkRead?: () => void;
    highlighted?: boolean;
}

export function NotificationItem({ notification, onAction, onMarkRead, highlighted }: NotificationItemProps) {
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ctaHoverRef = useRef(false);

    const clearHoverTimer = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (notification.read || ctaHoverRef.current) {
            return;
        }
        if (hoverTimerRef.current) {
            return;
        }
        hoverTimerRef.current = setTimeout(() => {
            hoverTimerRef.current = null;
            if (!notification.read) {
                onMarkRead?.();
            }
        }, 800);
    }, [notification.read, onMarkRead]);

    const handleMouseLeave = useCallback(() => {
        clearHoverTimer();
    }, [clearHoverTimer]);

    const handleCardClick = useCallback(() => {
        onAction();
    }, [onAction]);

    useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

    return (
        <div
            className={cn(
                "rounded-lg border border-transparent bg-white px-3 py-2.5 transition-colors",
                "hover:bg-slate-50/70 active:bg-slate-100",
                !notification.read && "bg-blue-50/60",
                highlighted && "border-slate-300 bg-slate-100 animate-highlight-pulse"
            )}
            onClick={handleCardClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <Bell className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900 break-words">
                                    {notification.title}
                                </p>
                                {!notification.read && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                )}
                            </div>
                            <p className="mt-1 break-words text-xs text-slate-600 leading-relaxed">
                                {notification.message}
                            </p>
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {format(new Date(notification.createdAt), "MMM d")}
                        </p>
                    </div>
                    {notification.action && (
                        <div className="mt-3 flex items-center justify-between">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction();
                                }}
                                onMouseEnter={() => {
                                    ctaHoverRef.current = true;
                                    clearHoverTimer();
                                }}
                                onMouseLeave={() => {
                                    ctaHoverRef.current = false;
                                }}
                                className="h-7 rounded-full px-3 text-[11px] font-semibold"
                            >
                                {notification.action.label}
                            </Button>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

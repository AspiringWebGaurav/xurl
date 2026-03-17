"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
    unreadCount: number;
    isShaking: boolean;
    isOpen: boolean;
    onClick: () => void;
}

export function NotificationBell({ unreadCount, isShaking, isOpen, onClick }: NotificationBellProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "relative p-1.5 text-slate-600 transition-all duration-150 hover:bg-slate-100/60 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1",
                isShaking && "animate-notification-shake"
            )}
            aria-label="Notifications"
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </button>
    );
}

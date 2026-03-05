"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Link as LinkIcon,
    BarChart3,
    Settings
} from "lucide-react";

const NAV_ITEMS = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Links", href: "/links", icon: LinkIcon },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-56 shrink-0 border-r bg-zinc-50/50 flex flex-col h-full">
            <div className="flex flex-col gap-1 p-4">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-zinc-200/50 text-zinc-900"
                                    : "text-zinc-500 hover:bg-zinc-100/50 hover:text-zinc-900"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-zinc-900" : "text-zinc-400")} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>
            <div className="mt-auto p-4 border-t">
                {/* User profile brief can go here */}
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50 rounded-md transition-colors cursor-pointer">
                    <div className="h-6 w-6 rounded-full bg-zinc-200 border border-zinc-300" />
                    <span className="truncate">Gaurav</span>
                </div>
            </div>
        </aside>
    );
}

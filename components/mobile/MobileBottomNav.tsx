"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ hidePlus }: { hidePlus?: boolean }) {
    const pathname = usePathname();

    const isDashboard = pathname === "/dashboard" || pathname === "/mobile/dashboard";
    const isAnalytics = pathname === "/analytics" || pathname === "/mobile/analytics";

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)] pt-2 z-50">
            <div className="relative flex justify-between items-center h-16 px-8">
                {/* Left group */}
                <div className="flex gap-10">
                    <Link href="/mobile/dashboard" className="h-full">
                        <button
                            className={cn(
                                "flex flex-col items-center justify-center h-full transition-colors",
                                isDashboard ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Home className="w-[22px] h-[22px] mb-1" />
                            <span className="text-[10px] font-semibold">Home</span>
                        </button>
                    </Link>

                    <Link href="/mobile/analytics" className="h-full">
                        <button
                            className={cn(
                                "flex flex-col items-center justify-center h-full transition-colors",
                                isAnalytics ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <BarChart2 className="w-[22px] h-[22px] mb-1" />
                            <span className="text-[10px] font-semibold">Stats</span>
                        </button>
                    </Link>
                </div>

                {/* Exact Center FAB */}
                {!hidePlus && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                        <button className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform touch-manipulation">
                            <Plus className="w-7 h-7" />
                        </button>
                    </div>
                )}

                {/* Right group */}
                <div className="flex gap-10">
                    {/* Placeholder to balance layout perfectly since we only have 3 nav items total besides + */}
                    <div className="w-[30px]" />

                    <Link href="/mobile/settings" className="h-full">
                        <button
                            className={cn(
                                "flex flex-col items-center justify-center h-full transition-colors",
                                pathname === "/mobile/settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Settings className="w-[22px] h-[22px] mb-1" />
                            <span className="text-[10px] font-semibold">Settings</span>
                        </button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}

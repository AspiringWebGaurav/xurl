"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { Sparkles, Percent, Gift, ClipboardList, ListChecks, Loader2, ShieldCheck, Link as LinkIcon, ShieldAlert, Ban, Settings, Tag } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { cn } from "@/lib/utils";
import { getOrCreateGuestSessionId } from "@/lib/utils/fingerprint";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: Sparkles },
    { href: "/admin/plans", label: "Plan Configuration", icon: Settings },
    { href: "/admin/offers", label: "Global Offers", icon: Tag },
    { href: "/admin/promo-codes", label: "Promo Codes", icon: Percent },
    { href: "/admin/grant-plan", label: "Grant Plan", icon: Gift },
    { href: "/admin/bans", label: "Bans & Appeals", icon: ShieldCheck },
    { href: "/admin/system-bans", label: "System Bans", icon: ShieldAlert },
    { href: "/admin/links", label: "Link Management", icon: LinkIcon },
    { href: "/admin/purchase-history", label: "Purchase History", icon: ClipboardList },
    { href: "/admin/logs", label: "Admin Logs", icon: ListChecks },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [strikeWarning, setStrikeWarning] = useState<string | null>(null);
    const [isBanned, setIsBanned] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setLoading(false);
            if (nextUser) {
                await ensureUserDocument(nextUser);
            }
        });

        return () => unsubscribe();
    }, []);

    const isAdmin = isAdminEmail(user?.email);

    useEffect(() => {
        let mounted = true;
        if (!isAdmin && !loading) {
            const logStrike = async () => {
                try {
                    let headers: Record<string, string> = {
                        "Content-Type": "application/json"
                    };
                    if (user) {
                        const token = await user.getIdToken();
                        headers["Authorization"] = `Bearer ${token}`;
                    }

                    const guestId = await getOrCreateGuestSessionId();

                    const res = await fetch("/api/user/strike", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ type: "ADMIN_ACCESS", guestId })
                    });
                    const data = await res.json();
                    if (!mounted) return;
                    if (data.action === "ban") {
                        // BanGuard will take over the UI automatically since it listens to Firestore in real-time.
                        setStrikeWarning(data.message);
                    } else if (data.action === "warning") {
                        setStrikeWarning(data.message);
                    }
                } catch (e) {
                    console.error("Failed to log strike:", e);
                }
            };
            logStrike();
        }
        return () => { mounted = false; };
    }, [user, isAdmin, loading]);

    const title = useMemo(() => {
        return NAV_ITEMS.find((item) => item.href === pathname)?.label || "Admin Console";
    }, [pathname]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
                <div className="fixed inset-x-0 top-0 z-50">
                    <TopNavbar />
                </div>
                <div className="flex min-h-screen items-center justify-center pt-14">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            </div>
        );
    }

    if (!user || !isAdmin) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
                <div className="fixed inset-x-0 top-0 z-50">
                    <TopNavbar />
                </div>
                <main className="flex min-h-screen items-center justify-center px-6 pt-14">
                    <div className={cn("w-full max-w-2xl rounded-[32px] border bg-white/85 p-10 text-center shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-colors", strikeWarning ? "border-amber-400 shadow-amber-500/20" : "border-white/70")}>
                        <div className={cn("mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg", strikeWarning ? "bg-amber-500 shadow-amber-500/30" : "bg-slate-900 shadow-slate-900/20")}>
                            {strikeWarning ? <ShieldAlert className="h-9 w-9" /> : <ShieldCheck className="h-9 w-9" />}
                        </div>
                        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">
                            {strikeWarning ? "Access Violation Warning" : "Admin access required"}
                        </h1>
                        <p className={cn("mx-auto mt-4 max-w-xl text-base font-medium", strikeWarning ? "text-amber-700" : "text-slate-600")}>
                            {strikeWarning || "This workspace is reserved for configured XURL administrators. Sign in with an authorized admin email to access promo tools, grants, and billing controls."}
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                                Go to homepage
                            </Link>
                            <Link href="/login" className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
                                Sign in with admin email
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div id="admin-root" className="min-h-screen bg-[#f5f7fb] text-slate-900">
            <div className="fixed inset-x-0 top-0 z-50">
                <TopNavbar />
            </div>

            <div className="pt-14">
                <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-56px)] w-96 border-r border-slate-200 bg-white/85 backdrop-blur-xl lg:block">
                    <div className="flex h-full flex-col px-5 py-6">
                        <div className="shrink-0 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Admin Console</p>
                            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Operate XURL</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Manage promotions, grants, and billing from one calm workspace.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto my-4 pr-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <nav className="flex flex-col gap-2">
                                {NAV_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    const active = pathname === item.href;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                                                active
                                                    ? "bg-slate-100 text-slate-900 border border-slate-200 shadow-sm"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                            )}
                                        >
                                            <span className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-xl border transition-all shrink-0",
                                                active ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50 group-hover:bg-white"
                                            )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="mt-auto shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Signed in</p>
                            <p className="mt-2 truncate text-sm font-medium text-slate-800">{user.email}</p>
                            <p className="mt-1 text-xs text-slate-500">Administrative access verified</p>
                        </div>
                    </div>
                </aside>

                <main className="lg:pl-96">
                    <div className="sticky top-14 z-30 border-b border-slate-200 bg-[#f5f7fb]/90 px-4 py-4 backdrop-blur-xl lg:hidden">
                        <div className="flex flex-col gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Admin</p>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {NAV_ITEMS.map((item) => {
                                    const active = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition",
                                                active
                                                    ? "border-slate-300 bg-slate-900/5 text-slate-900"
                                                    : "border-slate-200 bg-white text-slate-600"
                                            )}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="h-[calc(100vh-56px)] overflow-y-auto">
                        <div className="mx-auto w-full px-4 py-6 lg:px-8 lg:py-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

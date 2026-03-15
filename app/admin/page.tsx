"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { isAdminEmail } from "@/lib/admin-config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Lock, ArrowUpRight, Sparkles, Percent, Gift, ClipboardList } from "lucide-react";
import Link from "next/link";

const navLinks = [
    { href: "/admin", label: "Dashboard", icon: <Sparkles className="h-4 w-4" /> },
    { href: "/admin/promo-codes", label: "Promo Codes", icon: <Percent className="h-4 w-4" /> },
    { href: "/admin/grant-plan", label: "Grant Plan", icon: <Gift className="h-4 w-4" /> },
    { href: "/purchase-history", label: "Purchase History", icon: <ClipboardList className="h-4 w-4" /> },
];

export default function AdminDashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setLoading(false);
            if (u) await ensureUserDocument(u);
        });
        return () => unsub();
    }, []);

    const isAdmin = isAdminEmail(user?.email);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-sand-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user || !isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f7f5f0] via-white to-[#eef2ff] text-slate-900">
                <TopNavbar />
                <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center" style={{ minHeight: "calc(100vh - 56px)" }}>
                    <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100 shadow-xl backdrop-blur">
                        <div className="absolute inset-[-14px] rounded-[30px] bg-amber-200/40 blur-2xl" aria-hidden="true" />
                        <div className="absolute inset-[-6px] rounded-[28px] bg-amber-100/80" aria-hidden="true" />
                        <Lock className="relative h-9 w-9 text-amber-500 drop-shadow-sm" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Ohhoo! Looks like you don’t have access.</h1>
                    <p className="mt-3 max-w-2xl text-slate-600 text-lg">This admin console is restricted. Sign in with an authorized admin email to continue, or head back to the app.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        <Link href="/">
                            <Button variant="outline" className="border-slate-200 bg-white/90 text-slate-800 hover:bg-white shadow-sm">Go to homepage</Button>
                        </Link>
                        <Link href="/login">
                            <Button className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm">Sign in with admin email</Button>
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f5ef] text-slate-900">
            <TopNavbar />
            <div className="mx-auto flex max-w-7xl px-6 py-8 gap-6">
                <aside className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
                    <div className="px-4 py-5 border-b border-slate-100">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
                        <h2 className="text-lg font-bold mt-1">Console</h2>
                    </div>
                    <nav className="flex flex-col p-2 text-sm">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                            >
                                {link.icon}
                                <span>{link.label}</span>
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-auto px-4 py-4 text-xs text-slate-500 border-t border-slate-100">
                        {user.email}
                    </div>
                </aside>

                <main className="flex-1">
                    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-8">
                        <p className="text-sm font-semibold text-slate-500">Welcome back</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="mt-2 text-slate-500">One place to manage promos, grants, and billing signals.</p>

                        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between text-sm text-slate-600">
                                    <span>Promo Codes</span>
                                    <Percent className="h-4 w-4" />
                                </div>
                                <p className="text-lg font-semibold">Create, edit, view redemptions</p>
                                <Link href="/admin/promo-codes" className="inline-flex items-center gap-1 text-sm font-medium text-slate-800 hover:underline">
                                    Open promos <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between text-sm text-slate-600">
                                    <span>Grant Plans</span>
                                    <Gift className="h-4 w-4" />
                                </div>
                                <p className="text-lg font-semibold">Manual grants with custom durations</p>
                                <Link href="/admin/grant-plan" className="inline-flex items-center gap-1 text-sm font-medium text-slate-800 hover:underline">
                                    Open grant tool <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between text-sm text-slate-600">
                                    <span>Billing History</span>
                                    <ClipboardList className="h-4 w-4" />
                                </div>
                                <p className="text-lg font-semibold">See transactions & sources</p>
                                <Link href="/purchase-history" className="inline-flex items-center gap-1 text-sm font-medium text-slate-800 hover:underline">
                                    View history <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>

                        <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Shortcuts</p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Link href="/admin/promo-codes" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
                                        <Percent className="h-4 w-4" /> Manage promos
                                    </Link>
                                    <Link href="/admin/grant-plan" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
                                        <Gift className="h-4 w-4" /> Grant plan
                                    </Link>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status</p>
                                <div className="mt-3 space-y-2 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        <span>Developer mode available in local/dev only.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        <span>Admin actions require admin email.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, FormEvent } from "react";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
    emitProfileUpdated,
    ensureUserDocument,
    getPreferredDisplayName,
} from "@/lib/firebase/user-profile";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Loader2, User as UserIcon, ShieldCheck, Mail, Calendar, CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DesktopGuestLocked } from "@/components/layout/DesktopGuestLocked";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);
    const [userPlan, setUserPlan] = useState("free");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                setDisplayName(getPreferredDisplayName(u));
                try {
                    await ensureUserDocument(u);
                    const token = await u.getIdToken();
                    const res = await fetch("/api/user/profile", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.displayName) {
                        setDisplayName(data.displayName);
                    }
                    if (data.plan) {
                        setUserPlan(data.plan);
                    }
                } catch (e) {
                    console.error("Failed to fetch profile", e);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleProfileUpdated = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.plan) {
                setUserPlan(customEvent.detail.plan);
            }
        };

        window.addEventListener("userProfileUpdated", handleProfileUpdated);
        return () => {
            window.removeEventListener("userProfileUpdated", handleProfileUpdated);
        };
    }, []);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = displayName.trim();
        if (!trimmed || !user) return;

        setSaving(true);

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ displayName: trimmed })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || "Failed to update profile name.");
            } else {
                const nextDisplayName = data.displayName;
                await updateProfile(user, { displayName: nextDisplayName });
                const syncedUser = auth.currentUser ?? user;

                setDisplayName(nextDisplayName);
                emitProfileUpdated({
                    displayName: nextDisplayName,
                    email: syncedUser.email ?? null,
                    photoURL: syncedUser.photoURL ?? null,
                });

                toast.success("Profile display name updated successfully!", {
                    description: "Your new display name is now visible across XURL.",
                });
            }
        } catch {
            toast.error("An unexpected error occurred while saving your profile.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const createdDateStr = user?.metadata.creationTime
        ? format(new Date(user.metadata.creationTime), "MMM d, yyyy")
        : "Member";

    return (
        <div className="h-[100dvh] flex flex-col justify-between bg-background overflow-hidden select-none">
            {/* Header Navbar */}
            <div className="shrink-0">
                <TopNavbar />
            </div>

            {/* Main Single-Screen Content View (Broad Executive Desktop Spacing) */}
            <main className="flex-1 min-h-0 w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col justify-center items-center overflow-hidden">
                {!user ? (
                    <div className="w-full max-w-xl">
                        <DesktopGuestLocked
                            title="Sign in Required"
                            message="Please sign in to view and manage your profile settings."
                        >
                            <div className="p-8 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl text-center space-y-4">
                                <UserIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                                <p className="text-base text-muted-foreground">Sign in to update account display settings.</p>
                            </div>
                        </DesktopGuestLocked>
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-full space-y-3 sm:space-y-6"
                    >
                        {/* Top Back & Action Breadcrumb Bar */}
                        <div className="flex items-center justify-between gap-2 px-1">
                            <Link href="/" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition">
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to shortener</span>
                            </Link>
                            <span className="text-[11px] sm:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                                Account Console
                            </span>
                        </div>

                        {/* Main Glassmorphic Profile Card - Broad Responsive Enlarge */}
                        <div className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-2xl p-5 sm:p-8 lg:p-10 overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-center">
                                
                                {/* Left Column: Identity Card */}
                                <div className="md:col-span-5 flex flex-col items-center text-center p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-muted/30 border border-border/50 space-y-3 sm:space-y-4">
                                    <div className="relative">
                                        <div className="h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-3 border-primary/40 shadow-xl ring-4 ring-primary/10">
                                            <UserAvatar user={user} className="h-full w-full object-cover text-4xl font-extrabold" />
                                        </div>
                                        <span className="absolute -bottom-1 -right-1 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-3 ring-background text-xs shadow-lg">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </span>
                                    </div>

                                    <div className="space-y-1 w-full min-w-0">
                                        <h2 className="text-lg sm:text-2xl font-black text-foreground truncate px-1">
                                            {displayName || "User Account"}
                                        </h2>
                                        <p className="text-xs sm:text-sm text-muted-foreground truncate font-mono px-1">
                                            {user.email}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full">
                                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border font-mono tracking-wider ${
                                            userPlan === "enterprise" || userPlan === "business"
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                : userPlan === "pro" || userPlan === "starter"
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                : "bg-primary/10 text-primary border-primary/20"
                                        }`}>
                                            {userPlan} Tier
                                        </span>

                                        <span className="text-xs font-semibold text-muted-foreground px-3 py-1 rounded-full bg-muted border border-border flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {createdDateStr}
                                        </span>
                                    </div>
                                </div>

                                {/* Right Column: Display Name Edit Form */}
                                <div className="md:col-span-7 space-y-4 sm:space-y-6">
                                    <div>
                                        <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
                                            <span>Profile Preferences</span>
                                            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                                        </h1>
                                        <p className="text-xs sm:text-base text-muted-foreground mt-1">
                                            Manage your public account identity and display preferences.
                                        </p>
                                    </div>

                                    <form onSubmit={handleSave} className="space-y-4 sm:space-y-5">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-foreground">
                                                <label htmlFor="displayName">Display Name</label>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {displayName.length}/50
                                                </span>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    id="displayName"
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className="w-full h-11 sm:h-13 rounded-2xl border border-border bg-background/90 px-4 text-xs sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition shadow-sm font-semibold"
                                                    placeholder="E.g. Jane Doe"
                                                    maxLength={50}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 sm:p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs sm:text-sm text-muted-foreground space-y-1">
                                            <p className="font-bold text-foreground flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-primary" />
                                                <span>Google OAuth Identity</span>
                                            </p>
                                            <p>Your primary email (<span className="font-mono font-bold text-foreground">{user.email}</span>) is verified via Google SSO.</p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={saving || !displayName.trim()}
                                            className="w-full h-11 sm:h-13 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-base transition shadow-xl flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span>Updating Profile...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="h-5 w-5" />
                                                    <span>Save Profile Changes</span>
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>

                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Footer */}
            <div className="shrink-0 hidden md:block">
                <HomeFooter />
            </div>
            <div className="shrink-0 block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, FormEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                try {
                    const token = await u.getIdToken();
                    const res = await fetch("/api/user/profile", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.displayName) {
                        setDisplayName(data.displayName);
                    }
                } catch (e) {
                    console.error("Failed to fetch profile", e);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMessage("");
        setErrorMessage("");

        if (!user) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ displayName })
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.message || "Failed to update profile");
            } else {
                setSuccessMessage("Profile updated successfully!");
                setDisplayName(data.displayName);
                // Simple trick to refresh the UI
                setUser({ ...user } as any); 
            }
        } catch (e) {
            setErrorMessage("An unexpected error occurred.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <TopNavbar />
                <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full px-6 py-12">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in Required</h1>
                    <p className="text-slate-500">Please sign in to view your profile.</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <TopNavbar />
            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Profile Settings</h1>
                    <p className="text-slate-500 mt-2">Manage your account details and display name.</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                    <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-100">
                        <div className="h-24 w-24 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-3xl font-medium text-slate-400">
                                    {displayName.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-slate-900">{displayName}</p>
                            <p className="text-sm text-slate-500 font-medium">{user.email}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6 max-w-md">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-900" htmlFor="displayName">
                                Display Name
                            </label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="E.g. Jane Doe"
                                maxLength={50}
                            />
                        </div>

                        {successMessage && (
                            <p className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-100">
                                {successMessage}
                            </p>
                        )}
                        {errorMessage && (
                            <p className="text-sm font-medium text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                                {errorMessage}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={saving || !displayName.trim()}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

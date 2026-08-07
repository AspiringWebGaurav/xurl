"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { PartialOffer } from "@/services/partial-offers";

export function PartialOfferNotificationBanner() {
    const [activeOffer, setActiveOffer] = useState<PartialOffer | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const fetchOffer = async (user: User) => {
            try {
                const token = await user.getIdToken(true);
                const res = await fetch("/api/user/partial-offers", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.offers) && data.offers.length > 0) {
                    setActiveOffer(data.offers[0]);
                } else {
                    setActiveOffer(null);
                }
            } catch {
                setActiveOffer(null);
            }
        };

        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user || !user.email) {
                setActiveOffer(null);
                return;
            }
            fetchOffer(user);
        });

        const handleRealtimeUpdate = () => {
            if (auth.currentUser) {
                fetchOffer(auth.currentUser);
            }
        };

        window.addEventListener("userProfileUpdated", handleRealtimeUpdate);
        window.addEventListener("linkGenerated", handleRealtimeUpdate);

        return () => {
            unsub();
            window.removeEventListener("userProfileUpdated", handleRealtimeUpdate);
            window.removeEventListener("linkGenerated", handleRealtimeUpdate);
        };
    }, []);

    if (!activeOffer || dismissed) return null;

    return (
        <div className="relative z-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 px-4 py-2.5 text-white shadow-md animate-fade-in">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs sm:text-sm font-bold">
                <div className="flex items-center gap-2 truncate">
                    <Sparkles className="h-4 w-4 text-amber-300 animate-pulse shrink-0" />
                    <span className="truncate">
                        🎉 <strong className="underline decoration-amber-300 decoration-2">Special Offer Unlocked:</strong> {activeOffer.title}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        href="/pricing"
                        className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-xs font-black text-indigo-950 shadow-sm transition hover:bg-amber-300 hover:text-indigo-950 active:scale-95"
                    >
                        Claim Offer <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="text-white/80 hover:text-white transition"
                        title="Dismiss banner"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

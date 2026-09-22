"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

export interface OfferSummary {
    id: string;
    title: string;
    type: "percentage" | "flat" | "custom_price";
    value: number;
    badgeText: string;
    isTargeted?: boolean;
}

interface OfferState {
    hasOffer: boolean;
    offer: OfferSummary | null;
    loading: boolean;
}

// Global cache to avoid redundant API requests across multiple components
let cachedState: OfferState = {
    hasOffer: false,
    offer: null,
    loading: true,
};

const listeners = new Set<(state: OfferState) => void>();

function notifyListeners(state: OfferState) {
    cachedState = state;
    listeners.forEach((listener) => listener(state));
}

let isFetching = false;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache

async function fetchActiveOffers(user: User | null) {
    const now = Date.now();
    if (isFetching || (now - lastFetchTime < CACHE_TTL_MS && !cachedState.loading)) {
        return;
    }

    isFetching = true;

    try {
        let bestOffer: OfferSummary | null = null;

        // 1. Fetch Targeted Partial Offers if user is logged in
        if (user && user.email) {
            try {
                const token = await user.getIdToken(true);
                const res = await fetch("/api/user/partial-offers", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.offers) && data.offers.length > 0) {
                        const target = data.offers[0];
                        const discountVal = target.discountValue || 0;
                        const badgeText = target.discountType === "percentage"
                            ? `${discountVal}% OFF`
                            : target.discountType === "flat"
                            ? `₹${discountVal} OFF`
                            : "SPECIAL DEAL";

                        bestOffer = {
                            id: target.id || "targeted",
                            title: target.title || "Special Offer",
                            type: target.discountType || "percentage",
                            value: discountVal,
                            badgeText,
                            isTargeted: true,
                        };
                    }
                }
            } catch {
                // Ignore targeted offer error and proceed to global offers
            }
        }

        // 2. If no targeted offer, check Public Global Offers
        if (!bestOffer) {
            try {
                const res = await fetch("/api/config/public");
                if (res.ok) {
                    const data = await res.json();
                    const offers = data.config?.offers || [];
                    const activeOffers = offers.filter((o: any) => {
                        if (!o.isActive) return false;
                        if (o.startsAt && o.startsAt > now) return false;
                        if (o.expiresAt && o.expiresAt <= now) return false;
                        return true;
                    });

                    if (activeOffers.length > 0) {
                        // Pick the best active global offer
                        let topOffer = activeOffers[0];
                        for (const o of activeOffers) {
                            if ((o.value || 0) > (topOffer.value || 0)) {
                                topOffer = o;
                            }
                        }

                        const discountVal = topOffer.value || 0;
                        const badgeText = topOffer.type === "percentage"
                            ? `${discountVal}% OFF`
                            : `₹${discountVal} OFF`;

                        bestOffer = {
                            id: topOffer.id || "global",
                            title: topOffer.name || "Limited Offer",
                            type: topOffer.type || "percentage",
                            value: discountVal,
                            badgeText,
                            isTargeted: false,
                        };
                    }
                }
            } catch {
                // Ignore public config fetch error
            }
        }

        lastFetchTime = Date.now();
        notifyListeners({
            hasOffer: Boolean(bestOffer),
            offer: bestOffer,
            loading: false,
        });
    } catch {
        notifyListeners({
            hasOffer: false,
            offer: null,
            loading: false,
        });
    } finally {
        isFetching = false;
    }
}

/**
 * Hook to determine if any plans are currently on offer (either global or targeted).
 * Returns `hasOffer: boolean` and `offer: OfferSummary | null`.
 */
export function usePlansOffer(): OfferState {
    const [state, setState] = useState<OfferState>(cachedState);

    useEffect(() => {
        listeners.add(setState);

        // Trigger initial fetch if needed
        fetchActiveOffers(auth.currentUser);

        // Listen for auth changes
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            fetchActiveOffers(user);
        });

        // Listen for realtime update events
        const handleUpdate = () => {
            lastFetchTime = 0; // Invalidate cache
            fetchActiveOffers(auth.currentUser);
        };

        window.addEventListener("userProfileUpdated", handleUpdate);
        window.addEventListener("linkGenerated", handleUpdate);

        return () => {
            listeners.delete(setState);
            unsubAuth();
            window.removeEventListener("userProfileUpdated", handleUpdate);
            window.removeEventListener("linkGenerated", handleUpdate);
        };
    }, []);

    return state;
}

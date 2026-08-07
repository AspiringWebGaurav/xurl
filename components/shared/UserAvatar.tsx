"use client";

import { useState } from "react";
import { User } from "firebase/auth";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
    user: User | null;
    className?: string;
}

const GRADIENT_PALETTES = [
    "bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white shadow-inner",
    "bg-gradient-to-tr from-indigo-600 via-violet-500 to-purple-400 text-white shadow-inner",
    "bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-500 text-white shadow-inner",
    "bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 text-white shadow-inner",
    "bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-500 text-white shadow-inner",
    "bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500 text-white shadow-inner",
] as const;

export function UserAvatar({ user, className = "" }: UserAvatarProps) {
    const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

    if (!user) return null;

    // Resolve photo URL from primary user object or provider data (Google Auth)
    let photoUrl: string | null = null;
    if (user.photoURL && user.photoURL.trim()) {
        photoUrl = user.photoURL.trim();
    } else if (user.providerData && user.providerData.length > 0) {
        for (const provider of user.providerData) {
            if (provider?.photoURL && provider.photoURL.trim()) {
                photoUrl = provider.photoURL.trim();
                break;
            }
        }
    }

    const displayName = user.displayName?.trim() || "";
    const email = user.email?.trim() || "";

    const initials = (
        displayName ? displayName.charAt(0) : email ? email.charAt(0) : "U"
    ).toUpperCase();

    // Deterministic palette selection based on user identity string
    const seedString = email || displayName || user.uid || "XURL";
    let seedHash = 0;
    for (let i = 0; i < seedString.length; i++) {
        seedHash += seedString.charCodeAt(i);
    }
    const gradientClass = GRADIENT_PALETTES[seedHash % GRADIENT_PALETTES.length];

    if (photoUrl && failedPhotoUrl !== photoUrl) {
        return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img 
                src={photoUrl} 
                alt={displayName || email || "User Avatar"} 
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className={cn("object-cover rounded-full select-none", className)} 
                onError={() => setFailedPhotoUrl(photoUrl)} 
            />
        );
    }

    return (
        <div 
            className={cn(
                "rounded-full flex items-center justify-center font-bold tracking-tight select-none border border-white/20",
                gradientClass,
                className
            )}
        >
            <span>{initials}</span>
        </div>
    );
}

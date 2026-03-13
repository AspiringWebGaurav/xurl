"use client";

import type { User } from "firebase/auth";

export const PROFILE_UPDATED_EVENT = "xurl:profile-updated";

export interface ProfileUpdatedDetail {
    displayName: string;
    email: string | null;
    photoURL: string | null;
}

const pendingEnsures = new Map<string, Promise<void>>();

export function getPreferredDisplayName(user: Pick<User, "displayName" | "email">) {
    const trimmedDisplayName = user.displayName?.trim();
    if (trimmedDisplayName) {
        return trimmedDisplayName;
    }

    const emailPrefix = user.email?.split("@")[0]?.trim();
    if (emailPrefix) {
        return emailPrefix;
    }

    return "User";
}

export async function ensureUserDocument(user: User) {
    const existingPromise = pendingEnsures.get(user.uid);
    if (existingPromise) {
        return existingPromise;
    }

    const ensurePromise = (async () => {
        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/user/profile", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                return;
            }
        } catch {
            return;
        }
    })();

    pendingEnsures.set(user.uid, ensurePromise);

    try {
        await ensurePromise;
    } finally {
        pendingEnsures.delete(user.uid);
    }
}

export function emitProfileUpdated(detail: ProfileUpdatedDetail) {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail }));
}

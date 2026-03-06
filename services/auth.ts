import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const googleProvider = new GoogleAuthProvider();

let isPopupOpen = false;
let deadlockTimer: ReturnType<typeof setTimeout> | null = null;

/** Force-release the popup lock so a new login attempt can proceed. */
export const releasePopupLock = () => {
    isPopupOpen = false;
    if (deadlockTimer) {
        clearTimeout(deadlockTimer);
        deadlockTimer = null;
    }
};

export const signInWithGoogle = async () => {
    if (isPopupOpen) {
        return { user: null, error: "auth/cancelled-popup-request" };
    }

    isPopupOpen = true;

    // Deadlock protection: auto-release lock after 15s if promise hangs
    deadlockTimer = setTimeout(() => {
        isPopupOpen = false;
        deadlockTimer = null;
    }, 15000);

    try {
        const result = await signInWithPopup(auth, googleProvider);
        releasePopupLock();
        return { user: result.user, error: null };
    } catch (error: unknown) {
        releasePopupLock();
        const err = error as { code?: string };
        if (
            err.code === "auth/popup-closed-by-user" ||
            err.code === "auth/cancelled-popup-request" ||
            err.code === "auth/popup-blocked"
        ) {
            return { user: null, error: err.code };
        }

        console.error("Error signing in with Google:", error);
        return { user: null, error: err.code || "unknown-error" };
    }
};

export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

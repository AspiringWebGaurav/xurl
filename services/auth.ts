import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    type User
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const googleProvider = new GoogleAuthProvider();

let isPopupOpen = false;
let deadlockTimer: ReturnType<typeof setTimeout> | null = null;

export interface SignInResult {
    user: User | null;
    error: string | null;
}

export interface SignInOptions {
    onPopupOpen?: () => void;      // Called when popup confirmed open
    onPopupClose?: () => void;     // Called instantly when popup closes
    pollInterval?: number;          // Default 50ms for close detection
}

/** Force-release the popup lock so a new login attempt can proceed. */
export const releasePopupLock = () => {
    isPopupOpen = false;
    if (deadlockTimer) {
        clearTimeout(deadlockTimer);
        deadlockTimer = null;
    }
};

export const signInWithGoogle = async (options?: SignInOptions): Promise<SignInResult> => {
    const { onPopupOpen, onPopupClose, pollInterval = 50 } = options || {};

    if (isPopupOpen) {
        return { user: null, error: "auth/cancelled-popup-request" };
    }

    isPopupOpen = true;

    // Cancel flag for UI-Auth decoupling
    let userCancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Deadlock protection: auto-release lock after 10s if promise hangs
    deadlockTimer = setTimeout(() => {
        isPopupOpen = false;
        deadlockTimer = null;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }, 10000);

    // Cleanup function
    const cleanup = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        releasePopupLock();
    };

    try {
        // Notify that popup will open
        onPopupOpen?.();

        // Start the sign-in popup and wait for result
        const result = await signInWithPopup(auth, googleProvider);

        // Check if user already cancelled via popup close
        if (userCancelled) {
            cleanup();
            return { user: null, error: 'cancelled' };
        }

        cleanup();
        return { user: result.user, error: null };
    } catch (error: unknown) {
        const err = error as { code?: string };

        // If popup was closed by user, trigger callback immediately
        if (
            err.code === "auth/popup-closed-by-user" ||
            err.code === "auth/cancelled-popup-request"
        ) {
            if (!userCancelled) {
                userCancelled = true;
                onPopupClose?.();
            }
        }

        cleanup();

        // Only process error if not already cancelled
        if (userCancelled) {
            return { user: null, error: 'cancelled' };
        }

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

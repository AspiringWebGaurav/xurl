import { useState, useCallback, useRef } from "react";
import { signInWithGoogle } from "@/services/auth";
import { toast } from "sonner";

export interface UseGoogleLoginOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onCancel?: () => void;          // Called instantly on popup close
    onPopupOpen?: () => void;        // Called when popup confirmed open
    toastId?: string;
    showToasts?: boolean;            // Default true
}

export function useGoogleLogin(options: UseGoogleLoginOptions = {}) {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { 
        onSuccess, 
        onError, 
        onCancel, 
        onPopupOpen,
        toastId = "google-login",
        showToasts = true
    } = options;

    // Cancel flag for UI-Auth decoupling (persists across re-renders)
    const cancelledRef = useRef(false);
    const isProcessingRef = useRef(false);

    const login = useCallback(async () => {
        // Prevent duplicate simultaneous calls
        if (isProcessingRef.current) return;
        
        isProcessingRef.current = true;
        cancelledRef.current = false;

        try {
            const { user: loggedInUser, error } = await signInWithGoogle({
                // Popup open callback - show loader only when confirmed
                onPopupOpen: () => {
                    if (!cancelledRef.current) {
                        setIsLoggingIn(true);
                        if (showToasts) {
                            toast.loading("Connecting to Google...", { id: toastId });
                        }
                        onPopupOpen?.();
                    }
                },
                
                // Popup close callback - UI updates when Firebase detects closure
                onPopupClose: () => {
                    cancelledRef.current = true;
                    setIsLoggingIn(false);
                    
                    if (showToasts) {
                        toast.info("Login cancelled", { id: toastId, duration: 2000 });
                    }
                    
                    // Fire cancel callback (no artificial delay)
                    onCancel?.();
                }
            });

            // Check if user already cancelled via popup close
            if (cancelledRef.current) {
                // User cancelled - UI already updated, ignore late result
                return;
            }

            // Process result only if not cancelled
            if (error) {
                if (error === "cancelled") {
                    // Already handled by onPopupClose callback
                    return;
                }
                
                setIsLoggingIn(false);
                
                if (error === "auth/popup-blocked") {
                    if (showToasts) {
                        toast.error("Popup blocked. Please allow popups and try again.", { 
                            id: toastId, 
                            duration: 4000 
                        });
                    }
                    onError?.(error);
                } else if (error === "auth/popup-closed-by-user" || error === "auth/cancelled-popup-request") {
                    // This is a backup - should already be handled by onPopupClose
                    cancelledRef.current = true;
                    if (showToasts) {
                        toast.info("Login cancelled", { id: toastId, duration: 2000 });
                    }
                    onCancel?.();
                } else {
                    if (showToasts) {
                        toast.error("Failed to sign in. Please try again.", { id: toastId });
                    }
                    onError?.(error);
                }
            } else if (loggedInUser) {
                setIsLoggingIn(false);
                if (showToasts) {
                    toast.success("Signed in successfully!", { id: toastId });
                }
                onSuccess?.();
            } else {
                setIsLoggingIn(false);
                if (showToasts) {
                    toast.dismiss(toastId);
                }
            }
        } catch (e) {
            // Only process unexpected errors if not already cancelled
            if (!cancelledRef.current) {
                console.error("Login unexpected error", e);
                setIsLoggingIn(false);
                if (showToasts) {
                    toast.error("An unexpected error occurred. Please try again.", { id: toastId });
                }
                onError?.("unknown-error");
            }
        } finally {
            isProcessingRef.current = false;
        }
    }, [toastId, onSuccess, onError, onCancel, onPopupOpen, showToasts]);

    const reset = useCallback(() => {
        cancelledRef.current = true;
        setIsLoggingIn(false);
        isProcessingRef.current = false;
        if (showToasts) {
            toast.dismiss(toastId);
        }
    }, [toastId, showToasts]);

    return {
        login,
        isLoggingIn,
        reset
    };
}

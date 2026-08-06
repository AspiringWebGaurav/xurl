"use client";

import { Loader2, Lock } from "lucide-react";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";

interface MobileGuestLockedProps {
    title?: string;
    message?: string;
    children?: React.ReactNode;
}

export function MobileGuestLocked({ 
    title = "Sign in Required", 
    message = "Create an account to access this feature.", 
    children 
}: MobileGuestLockedProps) {
    const { login, isLoggingIn } = useGoogleLogin({ toastId: "mobile-guest-login" });

    return (
        <div className="flex-1 px-6 py-6 pb-32 relative bg-background overflow-hidden h-full w-full">
            <div className="pointer-events-none select-none blur-[5px] opacity-40">
                {children}
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/50 backdrop-blur-md z-10">
                <div className="w-full max-w-sm text-center flex flex-col items-center">
                    <div className="mb-3">
                        <Lock className="h-7 w-7 text-primary drop-shadow-sm" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground mb-2 tracking-tight drop-shadow-sm">
                        {title}
                    </h2>
                    <p className="text-muted-foreground mb-6 text-[14px] leading-relaxed font-medium px-4">
                        {message}
                    </p>
                    
                    <div className="w-full space-y-2.5">
                        <button 
                            onClick={login}
                            disabled={isLoggingIn}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-bold rounded-full shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoggingIn ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In with Google"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

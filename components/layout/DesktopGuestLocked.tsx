"use client";

import { Loader2, Lock } from "lucide-react";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";
import { Button } from "@/components/ui/button";

interface DesktopGuestLockedProps {
    title?: string;
    message?: string;
    children?: React.ReactNode;
}

export function DesktopGuestLocked({ 
    title = "Sign in Required", 
    message = "Create an account to access this feature.", 
    children 
}: DesktopGuestLockedProps) {
    const { login, isLoggingIn } = useGoogleLogin({ toastId: "desktop-guest-login" });

    return (
        <div className="relative mt-4 min-h-[450px] max-h-[calc(100vh-280px)] overflow-hidden rounded-3xl">
            <div className="pointer-events-none select-none blur-[6px] opacity-50">
                {children}
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/40 backdrop-blur-md z-10">
                <div className="max-w-lg w-full mx-4 text-center flex flex-col items-center">
                    <div className="mb-6">
                        <Lock className="h-10 w-10 text-slate-700/80 drop-shadow-sm" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight drop-shadow-sm">
                        {title}
                    </h2>
                    <p className="text-slate-600 mb-8 text-base leading-relaxed max-w-sm mx-auto font-medium">
                        {message}
                    </p>
                    <Button 
                        onClick={login}
                        disabled={isLoggingIn}
                        className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 text-base font-semibold rounded-full shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98]"
                    >
                        {isLoggingIn ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            "Sign In with Google"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

"use client";

import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { useGoogleLogin } from '@/lib/hooks/useGoogleLogin';
import { useRouter, useSearchParams } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptics';
import { Suspense, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuthTransition } from '@/components/providers/AuthTransitionProvider';

function MobileLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const planParam = searchParams.get("plan");
    const redirectParam = searchParams.get("redirect") || "/mobile/dashboard";
    const { triggerLoginTransition } = useAuthTransition();
    const isRedirectingRef = useRef(false);

    const handleSuccessRedirect = useCallback((u?: User | null) => {
        if (isRedirectingRef.current) return;
        isRedirectingRef.current = true;
        triggerHaptic(40);
        const target = planParam ? `/login?plan=${planParam}` : redirectParam;
        void triggerLoginTransition(u || auth.currentUser, target);
    }, [planParam, redirectParam, triggerLoginTransition]);

    const { login, isLoggingIn } = useGoogleLogin({
        toastId: "mobile-login-toast",
        onSuccess: (u) => {
            handleSuccessRedirect(u);
        }
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                handleSuccessRedirect(u);
            }
        });
        return () => unsubscribe();
    }, [handleSuccessRedirect]);

    return (
        <div className="flex flex-col flex-1 min-h-[100dvh] px-6 py-8 bg-background">
            <header className="flex items-center mb-8 mt-2">
                <Link 
                    href="/mobile" 
                    onClick={() => triggerHaptic(20)}
                    className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-foreground" />
                </Link>
            </header>

            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        Welcome to xurl
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {planParam 
                            ? `Sign in to activate your ${planParam} plan.` 
                            : "Access your dashboard, live metrics, and banked links."}
                    </p>
                </div>

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic(40);
                            login();
                        }}
                        disabled={isLoggingIn}
                        className="w-full border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98] py-4 rounded-2xl font-bold text-base transition-all touch-manipulation shadow-md flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isLoggingIn ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        )}
                        <span>{isLoggingIn ? "Connecting to Google..." : "Continue with Google"}</span>
                    </button>
                </div>

                <div className="pt-8 flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Secure authentication via Google Identity</span>
                </div>
                
                <p className="text-center text-muted-foreground text-xs mt-auto pb-4 pt-8">
                    By continuing, you agree to our <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}

export default function MobileLoginPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col flex-1 min-h-[100dvh] items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <MobileLoginContent />
        </Suspense>
    );
}

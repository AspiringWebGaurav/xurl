"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { signInWithGoogle } from "@/services/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                router.push("/");
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const result = await signInWithGoogle();
            // If popup was cancelled/blocked, reset loading so user can retry
            if (result.error) {
                setLoading(false);
            }
            // On success, the auth state listener will handle the redirect
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 p-8 bg-card border border-border shadow-sm rounded-2xl">
                <Logo size="lg" />
                <div className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to XURL</h1>
                    <p className="text-sm text-muted-foreground mt-2">Create custom links and track your history.</p>
                </div>
                <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-medium"
                >
                    Continue with Google
                </Button>
            </div>
        </div>
    );
}

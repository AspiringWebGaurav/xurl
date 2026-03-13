"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";

function getDynamicExpiryMessage(planKey?: string | null) {
    if (!planKey) return "";
    const now = new Date();
    switch (planKey) {
        case 'free': now.setMinutes(now.getMinutes() + 10); break;
        case 'starter': now.setHours(now.getHours() + 2); break;
        case 'pro': now.setHours(now.getHours() + 6); break;
        case 'business': now.setHours(now.getHours() + 12); break;
        case 'enterprise': now.setHours(now.getHours() + 24); break;
        case 'bigenterprise': now.setHours(now.getHours() + 24); break;
        default: return "";
    }
    return `Expires ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
}
import { signInWithGoogle } from "@/services/auth";
import { releasePopupLock } from "@/services/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { UpgradeNavbar } from "@/components/layout/UpgradeNavbar";
import { Loader2, ArrowRight, Link2, Clock, Check, ShieldCheck, Zap, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import Script from "next/script";
import { toast } from "sonner";

const PLAN_DATA: Record<string, {
    badgeName: string;
    badgeStyle: string;
    title: string;
    description: string;
    linkCount: string;
    expiryTime: string;
    linkIconColor: string;
    linkBgColor: string;
    clockIconColor: string;
    clockBgColor: string;
}> = {
    free: {
        badgeName: "Free Plan",
        badgeStyle: "bg-emerald-50 border-emerald-100/50 text-emerald-600",
        title: "Create your account",
        description: "Sign in to instantly unlock:",
        linkCount: "1 Free Link",
        expiryTime: "10-Minute Expiry",
        linkIconColor: "text-emerald-600",
        linkBgColor: "bg-emerald-100/50",
        clockIconColor: "text-amber-600",
        clockBgColor: "bg-amber-100/50",
    },
    starter: {
        badgeName: "Starter Plan",
        badgeStyle: "bg-amber-50 border-amber-100/50 text-amber-600",
        title: "Upgrade to Starter",
        description: "Sign in to unlock Starter benefits:",
        linkCount: "5 Custom Links",
        expiryTime: "2-Hour Expiry",
        linkIconColor: "text-amber-600",
        linkBgColor: "bg-amber-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    pro: {
        badgeName: "Pro Plan",
        badgeStyle: "bg-sky-50 border-sky-100/50 text-sky-600",
        title: "Upgrade to Pro",
        description: "Sign in to unlock Pro benefits:",
        linkCount: "25 Custom Links",
        expiryTime: "6-Hour Expiry",
        linkIconColor: "text-sky-600",
        linkBgColor: "bg-sky-100/50",
        clockIconColor: "text-blue-600",
        clockBgColor: "bg-blue-100/50",
    },
    business: {
        badgeName: "Business Plan",
        badgeStyle: "bg-fuchsia-50 border-fuchsia-100/50 text-fuchsia-600",
        title: "Upgrade to Business",
        description: "Sign in to unlock Business benefits:",
        linkCount: "100 Custom Links",
        expiryTime: "12-Hour Expiry",
        linkIconColor: "text-fuchsia-600",
        linkBgColor: "bg-fuchsia-100/50",
        clockIconColor: "text-indigo-600",
        clockBgColor: "bg-indigo-100/50",
    },
    enterprise: {
        badgeName: "Enterprise Plan",
        badgeStyle: "bg-teal-50 border-teal-100/50 text-teal-600",
        title: "Upgrade to Enterprise",
        description: "Sign in to unlock Enterprise benefits:",
        linkCount: "300 Custom Links",
        expiryTime: "24-Hour Expiry",
        linkIconColor: "text-teal-600",
        linkBgColor: "bg-teal-100/50",
        clockIconColor: "text-emerald-600",
        clockBgColor: "bg-emerald-100/50",
    },
    bigenterprise: {
        badgeName: "Big Enterprise Plan",
        badgeStyle: "bg-slate-100 border-slate-200 text-slate-700",
        title: "Upgrade to Big Enterprise",
        description: "Sign in to unlock maximum capacity:",
        linkCount: "600 Links",
        expiryTime: "24-Hour Expiry",
        linkIconColor: "text-slate-700",
        linkBgColor: "bg-slate-200",
        clockIconColor: "text-slate-700",
        clockBgColor: "bg-slate-200",
    }
};

function LoginContent() {
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showLoginOverlay, setShowLoginOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");
    const [paymentState, setPaymentState] = useState<"idle" | "upgrading" | "processing" | "success" | "failed" | "cancelled">("idle");
    const router = useRouter();
    const searchParams = useSearchParams();
    const plan = searchParams.get("plan");
    const planKey = plan ? plan.toLowerCase() : null;
    const planContext = planKey && PLAN_DATA[planKey] ? PLAN_DATA[planKey] : null;
    const planDisplayName = planContext?.badgeName.replace(/\s+Plan$/, "") ?? "";

    // Live quota data for renewal detection
    const [renewalData, setRenewalData] = useState<{
        isRenewal: boolean;
        currentPlan: string;
        linksUsed: number;
        currentLimit: number;
        newAddition: number;
        newTotal: number;
        totalLinksEver: number;
        expiredLinksCount: number;
    } | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                await ensureUserDocument(u);
                setUser(u);
                if (!plan) {
                    router.push("/");
                } else {
                    setAuthLoading(false);
                    // Fetch live quota data for renewal detection
                    try {
                        const token = await u.getIdToken();
                        // Trigger guest link migration silently in the background
                        fetch("/api/user/sync", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` }
                        }).catch(() => {});
                        
                        const res = await fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } });
                        const data = await res.json();
                        if (data.plan && planKey && data.plan === planKey && planKey !== 'free') {
                            const planConfig = { starter: 5, pro: 25, business: 100, enterprise: 300, bigenterprise: 600 };
                            const newAddition = planConfig[planKey as keyof typeof planConfig] || 0;
                            setRenewalData({
                                isRenewal: true,
                                currentPlan: data.plan,
                                linksUsed: data.paidLinksCreated || 0,
                                currentLimit: data.limit || 0,
                                newAddition,
                                newTotal: (data.limit || 0) + newAddition,
                                totalLinksEver: data.totalLinksEver || 0,
                                expiredLinksCount: data.expiredLinksCount || 0,
                            });
                        } else {
                            setRenewalData(null);
                        }
                    } catch {
                        setRenewalData(null);
                    }
                }
            } else {
                setUser(null);
                setAuthLoading(false);
                setRenewalData(null);
            }
        });
        return () => unsubscribe();
    }, [router, plan, planKey]);

    const verifyPayment = async (orderId: string, planName: string, paymentId?: string, signature?: string) => {
        let attempts = 0;
        while (attempts < 10) {
            try {
                if (!user) break;
                const token = await user.getIdToken();
                const res = await fetch("/api/payments/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ orderId, paymentId, signature })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "paid" || data.status === "consumed") {
                        setPaymentState("success");
                        toast.success(`Successfully upgraded to ${planName} Plan!`);
                        setTimeout(() => {
                            setPaymentState("idle");
                            setIsUpgrading(false);
                            user.getIdToken(true).then(() => router.push("/"));
                        }, 5000);
                        return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
        }
        setPaymentState("failed");
        toast.error("Payment verification timeout. If amount was deducted, it will be refunded or credited soon.");
        setIsUpgrading(false);
    };

    const loadRazorpayOptions = async (orderId: string, amount: number, currency: string, planName: string) => {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
            setPaymentState("idle");
            setIsUpgrading(false);
            toast.error("Oops! Something went wrong. Payment configuration missing.");
            return;
        }

        const options = {
            key: keyId,
            amount: amount,
            currency: currency,
            name: "xurl.eu.cc",
            description: `Upgrade to ${planName}`,
            order_id: orderId,
            handler: async function (response: { razorpay_payment_id: string; razorpay_signature: string }) {
                setPaymentState("processing");
                verifyPayment(orderId, planName, response.razorpay_payment_id, response.razorpay_signature);
            },
            prefill: {
                name: user?.displayName || "",
                email: user?.email || ""
            },
            theme: {
                color: "#0f172a"
            },
            modal: {
                ondismiss: function () {
                    if (paymentState === "upgrading" || paymentState === "idle") {
                        setPaymentState("cancelled");
                        setIsUpgrading(false);
                        toast.info("Payment cancelled. No changes made.");
                    }
                }
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: { error?: { description?: string } }) {
            setPaymentState("failed");
            setIsUpgrading(false);
            toast.error(response.error?.description || "Oops! Something went wrong with the payment.");
        });
        rzp.open();
    };

    const handlePurchase = async () => {
        if (!user || !plan) return;
        setIsUpgrading(true);
        if (planKey === 'free') {
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/user/upgrade", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ plan })
                });
                if (res.ok) {
                    router.push("/");
                } else {
                    toast.error("Failed to claim free plan. Please try again.");
                    setIsUpgrading(false);
                }
            } catch (error) {
                console.error("Purchase error:", error);
                setIsUpgrading(false);
            }
        } else {
            setPaymentState("upgrading");
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/payments/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ planId: plan })
                });
                const data = await res.json();

                if (data.success) {
                    loadRazorpayOptions(data.orderId, data.amount, data.currency, planContext?.badgeName || "Paid Plan");
                } else {
                    setPaymentState("failed");
                    setIsUpgrading(false);
                    toast.error(data.message || "Failed to initiate payment.");
                }
            } catch {
                setPaymentState("failed");
                setIsUpgrading(false);
                toast.error("Network error. Could not initiate payment.");
            }
        }
    };

    const resetLoginState = () => {
        setIsLoggingIn(false);
        setShowLoginOverlay(false);
        releasePopupLock();
    };

    const handleLogin = async () => {
        if (authLoading || isLoggingIn) return;
        setIsLoggingIn(true);
        setOverlayMessage("Connecting to Google...");
        setShowLoginOverlay(true);
        
        try {
            const { user: loggedInUser, error } = await signInWithGoogle();
            
            if (error) {
                if (error === "auth/popup-blocked") {
                    setOverlayMessage(
                        <>
                            Popup blocked - click to retry login
                            <br />
                            <span 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    resetLoginState();
                                    setTimeout(() => handleLogin(), 50); 
                                }} 
                                className="mt-2 inline-block cursor-pointer underline transition-colors hover:text-foreground"
                            >
                                Open login
                            </span>
                        </>
                    );
                    return;
                } else if (error === "auth/popup-closed-by-user" || error === "auth/cancelled-popup-request") {
                    setOverlayMessage("Login cancelled - staying on this page...");
                    setTimeout(() => resetLoginState(), 500);
                } else {
                    setOverlayMessage("Unable to sign in. Please try again.");
                    setTimeout(() => resetLoginState(), 700);
                }
            } else if (loggedInUser) {
                setOverlayMessage("Signing in...");
                setTimeout(() => resetLoginState(), 600);
            } else {
                resetLoginState();
            }
        } catch (error) {
            console.error("Login unexpected error", error);
            resetLoginState();
        }
    };

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div id="login-root" className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
            
            {/* Global Payment Overlay for states like processing & success */}
            <AnimatePresence>
                {(paymentState === "processing" || paymentState === "success" || paymentState === "failed" || paymentState === "cancelled") && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border p-8 flex flex-col items-center text-center"
                        >
                            {paymentState === "processing" ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 relative">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin absolute" />
                                        <ShieldCheck className="w-4 h-4 text-blue-500 absolute" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Verifying Payment</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Please do not close this window. We are confirming your transaction with Razorpay...
                                    </p>
                                </>
                            ) : paymentState === "success" ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
                                        >
                                            <Check className="w-8 h-8 text-emerald-600" />
                                        </motion.div>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 text-emerald-700">Payment Successful!</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Your account has been upgraded instantly. Redirecting to dashboard...
                                    </p>
                                </>
                            ) : paymentState === "cancelled" ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-6">
                                        <AlertCircle className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Payment Cancelled</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                        No changes have been made to your account. You can try again when you&apos;re ready.
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <Button
                                            onClick={() => { setPaymentState("idle"); handlePurchase(); }}
                                            className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                                        >
                                            Retry Payment
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => { setPaymentState("idle"); router.push("/"); }}
                                            className="flex-1"
                                        >
                                            Dashboard
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                /* paymentState === "failed" */
                                <>
                                    <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-6">
                                        <AlertCircle className="w-8 h-8 text-red-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 text-red-600">Payment Failed</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                        Something went wrong with your payment. If money was deducted, it will be refunded automatically.
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <Button
                                            onClick={() => { setPaymentState("idle"); handlePurchase(); }}
                                            className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                                        >
                                            Retry Payment
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => { setPaymentState("idle"); router.push("/"); }}
                                            className="flex-1"
                                        >
                                            Dashboard
                                        </Button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showLoginOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-md"
                    >
                        <div className="flex flex-col items-center gap-3 px-6 text-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <p className="text-sm font-medium tracking-tight text-muted-foreground">
                                {overlayMessage}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <UpgradeNavbar
                backLabel="Back to pricing"
                logoHref="/"
                homeHref="/"
                onBack={() => router.back()}
                contentClassName="max-w-none"
            />

            {/* Subtle background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

            <main className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-12 pb-16 lg:flex-row lg:gap-16 lg:px-12 lg:py-0">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mx-auto grid h-full w-full max-w-[1120px] grid-cols-1 gap-8 lg:grid-cols-[minmax(0,560px)_420px] lg:items-center lg:justify-between lg:gap-10"
                >
                <section className="flex w-full flex-col items-center gap-6 lg:items-start lg:justify-center lg:self-center lg:gap-8">
                <div className="flex w-full max-w-[560px] flex-col items-center gap-5 lg:items-start">
                <div className="w-full space-y-5 text-center lg:text-left">
                    <div className="space-y-4">
                    {planContext && (
                        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${planContext.badgeStyle}`}>
                            <span className="text-[11px] font-bold uppercase tracking-wider">{renewalData?.isRenewal ? `RENEW ${planContext.badgeName}` : planContext.badgeName}</span>
                        </div>
                    )}

                    {planContext ? (
                        <h1 className="text-[clamp(1.5rem,5vw,3.25rem)] font-extrabold tracking-[-0.05em] text-slate-900 whitespace-nowrap">
                            <span>{renewalData?.isRenewal ? "Renew" : "Upgrade to"} </span>
                            <span className="bg-[linear-gradient(90deg,#6366f1,#22c55e,#f59e0b)] bg-clip-text text-transparent">
                                {planDisplayName}
                            </span>
                        </h1>
                    ) : (
                        <h1 className="text-[clamp(1.5rem,5vw,3.25rem)] font-extrabold tracking-[-0.05em] text-slate-900">
                            Welcome back
                        </h1>
                    )}
                    </div>

                    {planContext ? (
                        <div className="flex w-full flex-col items-center gap-6 lg:items-start">
                            <p className="max-w-[52ch] text-base leading-7 text-slate-600 sm:text-lg">
                                {user
                                    ? (renewalData?.isRenewal
                                        ? "Your current usage stays intact. Review the updated limits below before continuing."
                                        : "Review the unlocked benefits below, then apply this plan to your account.")
                                    : planContext.description}
                            </p>

                            {/* Renewal-specific quota breakdown */}
                            {user && renewalData?.isRenewal ? (
                                <div className="w-full max-w-[520px] rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Renewal Overview</p>
                                        <p className="text-sm leading-6 text-slate-500">A compact summary of what changes when you renew.</p>
                                    </div>
                                    {/* Current usage */}
                                    <div className="mt-6 flex items-start gap-4 border-b border-slate-100 pb-4">
                                        <div className={`${planContext.linkBgColor} rounded-lg p-2 shrink-0`}>
                                            <Link2 className={`h-4 w-4 ${planContext.linkIconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Active links</p>
                                            <p className="text-sm text-slate-500">{renewalData.linksUsed} of {renewalData.currentLimit} currently in use</p>
                                        </div>
                                    </div>

                                    {/* Expired links row — only if there are expired links */}
                                    {renewalData.expiredLinksCount > 0 && (
                                        <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                                            <div className="rounded-lg bg-amber-100 p-2 shrink-0">
                                                <Clock className="h-4 w-4 text-amber-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-900">Expired links</p>
                                                <p className="text-sm text-slate-500">{renewalData.expiredLinksCount} links are already expired</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* New addition */}
                                    <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                                        <div className="rounded-lg bg-emerald-100 p-2 shrink-0">
                                            <Zap className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Renewal adds</p>
                                            <p className="text-sm text-slate-500">+{renewalData.newAddition} links added to your current allocation</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                                        <div className={`${planContext.linkBgColor} rounded-lg p-2 shrink-0`}>
                                            <Link2 className={`h-4 w-4 ${planContext.linkIconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Total after renewal</p>
                                            <p className="text-sm text-slate-500">{renewalData.newTotal} total links available after checkout</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className={`${planContext.clockBgColor} rounded-lg p-2 shrink-0`}>
                                            <Clock className={`h-4 w-4 ${planContext.clockIconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Expiry window</p>
                                            <p className="text-sm text-slate-500">{getDynamicExpiryMessage(planKey)}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Standard first-purchase cards */
                                <div className="w-full max-w-[520px] rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm">
                                    <div className="mb-6 space-y-2 text-left">
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Included Benefits</p>
                                        <p className="text-sm leading-6 text-slate-500">Everything unlocked immediately after you continue.</p>
                                    </div>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                                        <div className={`${planContext.linkBgColor} rounded-lg p-2 shrink-0`}>
                                            <Link2 className={`h-4 w-4 ${planContext.linkIconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Link capacity</p>
                                            <p className="text-sm text-slate-500">{planContext.linkCount}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className={`${planContext.clockBgColor} rounded-lg p-2 shrink-0`}>
                                            <Clock className={`h-4 w-4 ${planContext.clockIconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">Expiry window</p>
                                            <p className="text-sm text-slate-500">{user || planKey === 'free' ? getDynamicExpiryMessage(planKey) : planContext.expiryTime}</p>
                                        </div>
                                    </div>
                                </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="max-w-[52ch] text-lg leading-8 text-slate-600">
                            Sign in to XURL to manage your custom aliases and track history.
                        </p>
                    )}
                </div>
                </div>
                </section>

                <aside className="w-full max-w-[420px] justify-self-center lg:w-[420px] lg:self-center lg:justify-self-end">
                    <div className="w-full rounded-[32px] border border-slate-200/90 bg-white px-5 py-6 shadow-[0_32px_90px_-34px_rgba(15,23,42,0.4)] lg:px-6 lg:py-6">
                    <div className="mb-5 space-y-2.5 text-center lg:text-left">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                            {user ? "Complete upgrade" : "Continue to account"}
                        </p>
                        <h2 className="text-[clamp(1.4rem,1.1rem+0.8vw,1.9rem)] font-bold leading-none tracking-[-0.035em] text-slate-900 whitespace-nowrap">
                            {user
                                ? (planContext ? `Unlock ${planContext.badgeName}` : "Finish checkout")
                                : "Continue with your account"}
                        </h2>
                        <p className="text-sm leading-6 text-slate-500">
                            {user
                                ? "Review your plan details and confirm to activate this tier on your account."
                                : "Sign in with Google to continue securely and apply the selected plan instantly."}
                        </p>
                    </div>
                    {planContext && (
                        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected plan</p>
                            <div className="mt-2.5 flex items-center justify-between gap-4">
                                <span className="text-sm font-semibold text-slate-900">{renewalData?.isRenewal ? `Renew ${planContext.badgeName}` : planContext.badgeName}</span>
                                <span className="text-xs text-slate-500">{user || planKey === 'free' ? getDynamicExpiryMessage(planKey) : planContext.expiryTime}</span>
                            </div>
                        </div>
                    )}

                    {user ? (
                        <Button
                            onClick={handlePurchase}
                            disabled={isUpgrading}
                            className="h-12 w-full rounded-xl bg-slate-900 text-base font-medium text-slate-50 shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                        >
                            {isUpgrading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {isUpgrading ? "Processing..." : (planKey === 'free' ? "Claim Free Plan" : (renewalData?.isRenewal ? "Renew Now" : "Buy Now"))} <ArrowRight className="ml-2 h-4 w-4 opacity-70" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleLogin}
                            disabled={authLoading || isLoggingIn}
                            className="h-12 w-full rounded-xl bg-slate-900 text-base font-medium text-slate-50 shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                        >
                            {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {isLoggingIn ? "Connecting..." : "Continue with Google"} <ArrowRight className="ml-2 h-4 w-4 opacity-70" />
                        </Button>
                    )}

                    <p className="mt-5 text-center text-xs leading-6 text-slate-500">
                        {user ? "By confirming purchase, you agree to the immediate billing of this tier." : "By continuing, you agree to our Terms of Service and Privacy Policy."}
                    </p>
                    {user && planKey !== 'free' && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium uppercase tracking-wider">Secured by Razorpay</span>
                        </div>
                    )}
                </div>
                </aside>
                </motion.div>
            </main>

            <HomeFooter />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

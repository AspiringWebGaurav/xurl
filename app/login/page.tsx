"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

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
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { Loader2, ArrowRight, ArrowLeft, Home, Link2, Clock, Check, ShieldCheck, Zap, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import Link from "next/link";
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
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [paymentState, setPaymentState] = useState<"idle" | "upgrading" | "processing" | "success" | "failed" | "cancelled">("idle");
    const router = useRouter();
    const searchParams = useSearchParams();
    const plan = searchParams.get("plan");
    const planKey = plan ? plan.toLowerCase() : null;
    const planContext = planKey && PLAN_DATA[planKey] ? PLAN_DATA[planKey] : null;

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
                setUser(u);
                if (!plan) {
                    router.push("/");
                } else {
                    setLoading(false);
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
                setLoading(false);
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
            handler: async function (response: any) {
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
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
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

    const [loginMessage, setLoginMessage] = useState<React.ReactNode | null>(null);

    const handleLogin = async () => {
        if (loading) return;
        setLoading(true);
        setLoginMessage(null);
        
        try {
            const { user: loggedInUser, error } = await signInWithGoogle();
            
            if (error) {
                if (error === "auth/popup-blocked") {
                    setLoading(false);
                    setLoginMessage(
                        <div className="text-sm font-medium text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 text-center animate-in fade-in slide-in-from-top-2">
                            Popup blocked. Please allow popups or 
                            <span 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLoginMessage(null);
                                    setTimeout(() => handleLogin(), 50); 
                                }} 
                                className="underline cursor-pointer ml-1 hover:text-amber-800 transition-colors font-bold"
                            >
                                click here to retry login
                            </span>.
                        </div>
                    );
                } else {
                    setLoading(false);
                }
            } else if (!loggedInUser) {
                setLoading(false);
            }
            // On success, the auth state listener will handle the redirect
        } catch (error) {
            console.error("Login unexpected error", error);
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
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
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
                                        No changes have been made to your account. You can try again when you're ready.
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

            {/* Navigation - Top Left */}
            <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to pricing
                </Button>
                <Link href="/">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Home
                    </Button>
                </Link>
            </div>

            {/* Subtle background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md flex flex-col items-center gap-8 p-8 relative z-10"
            >
                <Logo size="lg" />

                <div className="text-center w-full space-y-3">
                    {planContext && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-2 ${planContext.badgeStyle}`}>
                            <span className="text-[11px] font-bold uppercase tracking-wider">{renewalData?.isRenewal ? `RENEW ${planContext.badgeName}` : planContext.badgeName}</span>
                        </div>
                    )}

                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                        {user && planContext
                            ? (renewalData?.isRenewal ? `Renew ${planContext.badgeName}` : `Confirm ${planContext.badgeName}`)
                            : (planContext ? planContext.title : "Welcome back")}
                    </h1>

                    {planContext ? (
                        <div className="flex flex-col items-center gap-5 mt-2 mb-2 w-full">
                            <p className="text-base text-slate-600">
                                {user
                                    ? (renewalData?.isRenewal
                                        ? "Your existing links stay untouched. Here's what this renewal adds:"
                                        : "Review your plan limits globally unlocking across your account:")
                                    : planContext.description}
                            </p>

                            {/* Renewal-specific quota breakdown */}
                            {user && renewalData?.isRenewal ? (
                                <div className="w-full max-w-[380px] space-y-3">
                                    {/* Current usage */}
                                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`${planContext.linkBgColor} p-1.5 rounded-lg shrink-0`}>
                                                <Link2 className={`w-4 h-4 ${planContext.linkIconColor}`} />
                                            </div>
                                            <span className="text-sm text-slate-600">Active links</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-900">{renewalData.linksUsed} / {renewalData.currentLimit} used</span>
                                    </div>

                                    {/* Expired links row — only if there are expired links */}
                                    {renewalData.expiredLinksCount > 0 && (
                                        <div className="flex items-center justify-between bg-amber-50/60 px-4 py-3 rounded-xl border border-amber-200/50 shadow-sm">
                                            <div className="flex items-center gap-2.5">
                                                <div className="bg-amber-100 p-1.5 rounded-lg shrink-0">
                                                    <Clock className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <span className="text-sm text-amber-700">Expired links</span>
                                            </div>
                                            <span className="text-sm font-bold text-amber-700">{renewalData.expiredLinksCount} expired</span>
                                        </div>
                                    )}

                                    {/* New addition */}
                                    <div className="flex items-center justify-between bg-emerald-50/70 px-4 py-3 rounded-xl border border-emerald-200/60 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0">
                                                <Zap className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-sm text-emerald-700 font-medium">+ Renewal adds</span>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-700">+{renewalData.newAddition} links</span>
                                    </div>

                                    {/* Divider */}
                                    <div className="flex items-center gap-2 px-2">
                                        <div className="flex-1 h-px bg-slate-200" />
                                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">After renewal</span>
                                        <div className="flex-1 h-px bg-slate-200" />
                                    </div>

                                    {/* New total */}
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <div className="flex flex-col items-center justify-center gap-1.5 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm w-full h-full transition-all hover:-translate-y-1 hover:shadow-md">
                                            <div className={`${planContext.linkBgColor} p-2 rounded-lg mb-1 shrink-0`}>
                                                <Link2 className={`w-5 h-5 ${planContext.linkIconColor}`} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-900 break-words text-center">{renewalData.newTotal} Total Links</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center gap-1.5 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm w-full h-full transition-all hover:-translate-y-1 hover:shadow-md">
                                            <div className={`${planContext.clockBgColor} p-2 rounded-lg mb-1 shrink-0`}>
                                                <Clock className={`w-5 h-5 ${planContext.clockIconColor}`} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-900 break-words text-center">
                                                {getDynamicExpiryMessage(planKey)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Standard first-purchase cards */
                                <div className="grid grid-cols-2 gap-3 w-full max-w-[340px]">
                                    <div className="flex flex-col items-center justify-center gap-1.5 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm w-full h-full transition-all hover:-translate-y-1 hover:shadow-md">
                                        <div className={`${planContext.linkBgColor} p-2 rounded-lg mb-1 shrink-0`}>
                                            <Link2 className={`w-5 h-5 ${planContext.linkIconColor}`} />
                                        </div>
                                        <span className="text-sm font-bold text-slate-900 break-words text-center">{planContext.linkCount}</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-1.5 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm w-full h-full transition-all hover:-translate-y-1 hover:shadow-md">
                                        <div className={`${planContext.clockBgColor} p-2 rounded-lg mb-1 shrink-0`}>
                                            <Clock className={`w-5 h-5 ${planContext.clockIconColor}`} />
                                        </div>
                                        <span className="text-sm font-bold text-slate-900 break-words text-center">
                                            {user || planKey === 'free' ? getDynamicExpiryMessage(planKey) : planContext.expiryTime}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-base text-slate-600">
                            Sign in to XURL to manage your custom aliases and track history.
                        </p>
                    )}
                </div>

                <div className="w-full max-w-[320px] mt-2">
                    {user ? (
                        <Button
                            onClick={handlePurchase}
                            disabled={isUpgrading}
                            className="w-full h-12 rounded-xl bg-slate-900 text-slate-50 hover:bg-slate-800 font-medium shadow-md shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                        >
                            {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {isUpgrading ? "Processing..." : (planKey === 'free' ? "Claim Free Plan" : (renewalData?.isRenewal ? "Renew Now" : "Buy Now"))} <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full h-12 rounded-xl bg-slate-900 text-slate-50 hover:bg-slate-800 font-medium shadow-md shadow-slate-900/10 transition-all hover:-translate-y-0.5"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {loading ? "Connecting..." : "Continue with Google"} <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
                        </Button>
                    )}
                    
                    {loginMessage && (
                        <div className="mt-4">
                            {loginMessage}
                        </div>
                    )}

                    <p className="text-center text-xs text-slate-500 mt-6">
                        {user ? "By confirming purchase, you agree to the immediate billing of this tier." : "By continuing, you agree to our Terms of Service and Privacy Policy."}
                    </p>
                    {user && planKey !== 'free' && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium uppercase tracking-wider">Secured by Razorpay</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Dedicated Login Page Footer */}
            <div className="absolute bottom-6 w-full px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400 z-20 max-w-7xl mx-auto">
                <p>&copy; {new Date().getFullYear()} XURL. All rights reserved.</p>
                <div className="flex items-center gap-6">
                    <Link href="/placeholder" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Help Center</Link>
                    <Link href="/placeholder" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
                    <Link href="/placeholder" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
                </div>
            </div>
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

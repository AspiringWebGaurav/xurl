"use client";

import React, { Suspense } from "react";
import Script from "next/script";
import { Loader2, ShieldCheck, AlertCircle, PartyPopper, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

import { useCheckout } from "./useCheckout";
import { DesktopCheckoutUI } from "./DesktopCheckoutUI";
import { MobileCheckoutUI } from "./MobileCheckoutUI";

function LoginContent() {
    const checkoutState = useCheckout();
    const { 
        authLoading, 
        showLoginOverlay, 
        overlayMessage, 
        paymentState,
        setPaymentState,
        handlePurchase,
        router,
        appliedPromo,
        planContext
    } = checkoutState;

    if (authLoading) {
        return (
            <div className="flex h-[100dvh] w-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div id="login-root" className="flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50 relative">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

            {checkoutState.killSwitchActive && (
                <div className="bg-rose-950 text-rose-200 px-4 py-2.5 text-center shadow-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-b border-rose-500/40 z-50">
                    <ShieldCheck className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>EMERGENCY KILL SWITCH MODE ACTIVE — ONLY VERIFIED ADMIN CREDENTIALS PERMITTED</span>
                </div>
            )}
            
            <AnimatePresence>
                {(paymentState === "processing" || paymentState === "success" || paymentState === "free_success" || paymentState === "failed" || paymentState === "cancelled") && (
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
                            className={`w-full max-w-sm rounded-2xl shadow-xl border p-8 flex flex-col items-center text-center ${
                                paymentState === "free_success" 
                                ? "bg-white dark:bg-slate-950 backdrop-blur-xl border-purple-200 dark:border-purple-900/50 ring-2 ring-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.2)]" 
                                : "bg-card border-border"
                            }`}
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
                            ) : paymentState === "free_success" ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center mb-6 relative">
                                        <motion.div
                                            initial={{ scale: 0, rotate: -45 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
                                        >
                                            <PartyPopper className="w-8 h-8 text-purple-600" />
                                        </motion.div>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="absolute -top-1 -right-1"
                                        >
                                            <Sparkles className="w-4 h-4 text-amber-400" />
                                        </motion.div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-foreground mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                                        Congratulations!
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Your 100% off promo code <strong className="text-foreground">{appliedPromo?.code}</strong> has been successfully applied and consumed!
                                    </p>
                                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg w-full flex flex-col gap-1 text-left">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Plan Unlocked</span>
                                            <span className="text-sm font-semibold">{planContext?.badgeName}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Amount Charged</span>
                                            <span className="text-sm font-semibold text-emerald-600">₹0.00</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-6 animate-pulse">
                                        Redirecting to your dashboard...
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

            {/* Render distinct components based on viewport */}
            <div className="hidden lg:flex w-full h-full flex-1 overflow-hidden">
                <DesktopCheckoutUI {...checkoutState} />
            </div>
            
            <div className="flex lg:hidden w-full h-full flex-1 overflow-hidden">
                <MobileCheckoutUI {...checkoutState} />
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[100dvh] w-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

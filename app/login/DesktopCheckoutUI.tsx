import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Link2, Clock, ShieldCheck, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromoCodeSection } from "@/components/payments/PromoCodeSection";
import { getExpiryDisplay } from "./shared";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { type ReturnType } from "typescript";
import { useCheckout } from "./useCheckout";
import Link from "next/link";

type CheckoutState = ReturnType<typeof useCheckout>;

export function DesktopCheckoutUI(props: CheckoutState) {
    const {
        user, isUpgrading, appliedPromo, setAppliedPromo, renewalData,
        planKey, planContext, planDisplayName, handlePurchase, handleLogin, isLoggingIn, router
    } = props;

    return (
        <div className="flex h-full w-full bg-white">
            
            {/* LEFT PANEL (Pitch/Benefits) */}
            <section className="relative flex w-1/2 flex-col justify-between overflow-hidden bg-slate-950 px-16 py-12 text-slate-50">
                {/* Immersive glow effects */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
                
                {/* Header (Back & Logo) */}
                <div className="relative z-10 flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white">
                        <ArrowRight className="h-5 w-5 rotate-180" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-950">
                            <span className="text-sm font-black">X</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">URL</span>
                    </div>
                </div>

                {/* Main Pitch */}
                <div className="relative z-10 my-auto flex w-full max-w-lg flex-col gap-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="space-y-4"
                    >
                        {planContext && (
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-1.5 backdrop-blur-md">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                                    {renewalData?.isRenewal ? `RENEW ${planContext.badgeName}` : planContext.badgeName}
                                </span>
                            </div>
                        )}

                        {planContext ? (
                            <h1 className="text-6xl font-black leading-tight tracking-[-0.04em]">
                                {renewalData?.isRenewal ? "Renew " : "Upgrade to "} <br />
                                <span className="bg-[linear-gradient(90deg,#818cf8,#34d399,#fbbf24)] bg-clip-text text-transparent">
                                    {planDisplayName}
                                </span>
                            </h1>
                        ) : (
                            <h1 className="text-6xl font-black leading-tight tracking-[-0.04em]">
                                Welcome back
                            </h1>
                        )}
                        
                        <p className="max-w-[40ch] text-lg leading-relaxed text-slate-400">
                            {user
                                ? (renewalData?.isRenewal
                                    ? "Your current usage stays intact. Review the updated limits before continuing."
                                    : "You're one step away from unlocking premium analytics and massive capacity.")
                                : planContext?.description}
                        </p>
                    </motion.div>

                    {planContext && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                            className="space-y-6"
                        >
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                                {renewalData?.isRenewal ? "Renewal Perks" : "Included Benefits"}
                            </p>
                            <div className="flex flex-col gap-6">
                                {renewalData?.isRenewal ? (
                                    <>
                                        <div className="flex items-start gap-5">
                                            <div className="rounded-xl bg-slate-800/50 p-3 text-slate-300 shadow-inner">
                                                <Link2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-base font-semibold text-white">Active Links Maintained</p>
                                                <p className="mt-1 text-sm text-slate-400">{renewalData.linksUsed} of {renewalData.currentLimit} in use</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-5">
                                            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400 shadow-inner">
                                                <Zap className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-base font-semibold text-emerald-400">Instant Capacity Boost</p>
                                                <p className="mt-1 text-sm text-emerald-400/70">+{renewalData.newAddition} links added</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-start gap-5">
                                        <div className="rounded-xl bg-slate-800/50 p-3 text-slate-300 shadow-inner">
                                            <Link2 className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-white">Massive Link Capacity</p>
                                            <p className="mt-1 text-sm text-slate-400">Create up to {planContext.linkCount}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-start gap-5">
                                    <div className="rounded-xl bg-slate-800/50 p-3 text-slate-300 shadow-inner">
                                        <Clock className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-white">Extended Validity</p>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {getExpiryDisplay(planKey, renewalData?.isRenewal ?? false, renewalData?.planExpiry ?? null)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="relative z-10 flex items-center gap-2 text-sm text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Secure Checkout</span>
                </div>
            </section>


            {/* RIGHT PANEL (Action) */}
            <section className="flex w-1/2 items-center justify-center bg-white px-10 py-12">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    className="w-full max-w-[460px]"
                >
                    <div className="mb-12 space-y-3">
                        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
                            {user
                                ? (planContext ? `Checkout` : "Finish setup")
                                : "Continue securely"}
                        </h2>
                        <p className="text-lg text-slate-500">
                            {user ? "Review your total and confirm payment." : "Sign in to apply the selected plan instantly."}
                        </p>
                    </div>


                    {planContext && (
                        <div className="mb-8 rounded-2xl bg-slate-50 border border-slate-100 p-6">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2.5">Selected Plan</p>
                                    <span className="text-2xl font-bold text-slate-900">
                                        {renewalData?.isRenewal ? `Renew ${planContext.badgeName}` : planContext.badgeName}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <AnimatePresence mode="popLayout">
                                        {planKey && planKey !== 'free' && (
                                            appliedPromo ? (
                                                <motion.div
                                                    key="promo-applied"
                                                    initial={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                                    exit={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                                                    transition={{ duration: 0.4, ease: "backOut" }}
                                                    className="flex flex-col items-end"
                                                >
                                                    <span className="text-sm font-semibold text-slate-400 line-through decoration-red-500 decoration-2">
                                                        ₹{PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                                    </span>
                                                    <span className="text-3xl font-black text-emerald-600 pb-1 font-mono tracking-tight">
                                                        ₹{appliedPromo.finalAmount / 100}
                                                    </span>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="no-promo"
                                                    initial={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                                    exit={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                                                    transition={{ duration: 0.4, ease: "backOut" }}
                                                    className="flex flex-col items-end"
                                                >
                                                    <span className="text-3xl font-black text-slate-900 pb-1 font-mono tracking-tight">
                                                        ₹{PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                                    </span>
                                                </motion.div>
                                            )
                                        )}
                                        {planKey === 'free' && (
                                            <motion.span
                                                key="free-plan"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="text-3xl font-black text-slate-900 pb-1 tracking-tight"
                                            >
                                                Free
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                    <span className="text-[15px] font-medium text-slate-500">
                                        {getExpiryDisplay(planKey, renewalData?.isRenewal ?? false, renewalData?.planExpiry ?? null)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mb-10">
                        {planKey !== 'free' && (
                            <PromoCodeSection
                                planId={planKey}
                                onPromoChange={setAppliedPromo}
                                variant="minimal"
                            />
                        )}
                    </div>

                    <div>
                        {user ? (
                            <Button
                                onClick={handlePurchase}
                                disabled={isUpgrading}
                                className="h-16 w-full rounded-[18px] bg-slate-950 text-[19px] font-semibold text-white shadow-[0_12px_40px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(15,23,42,0.2)] active:scale-[0.98]"
                            >
                                {isUpgrading ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : null}
                                {isUpgrading ? "Processing..." : (planKey === 'free' ? "Claim Free Plan" : (renewalData?.isRenewal ? "Renew Now" : "Complete Purchase"))} 
                                {!isUpgrading && <ArrowRight className="ml-3 h-6 w-6 opacity-70" />}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className="h-16 w-full rounded-[18px] bg-slate-950 text-[19px] font-semibold text-white shadow-[0_12px_40px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(15,23,42,0.2)] active:scale-[0.98]"
                            >
                                {isLoggingIn ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : null}
                                {isLoggingIn ? "Connecting..." : "Continue with Google"} 
                                {!isLoggingIn && <ArrowRight className="ml-3 h-6 w-6 opacity-70" />}
                            </Button>
                        )}
                        
                        <p className="mt-8 text-center text-sm font-medium text-slate-500">
                            {user ? "By confirming, you agree to the immediate billing of this tier." : "Subject to our Terms of Service and Privacy Policy."}
                        </p>
                    </div>

                </motion.div>
            </section>

        </div>
    );
}

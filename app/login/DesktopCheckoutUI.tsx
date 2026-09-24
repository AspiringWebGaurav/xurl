import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Link2, Clock, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromoCodeSection } from "@/components/payments/PromoCodeSection";
import { getExpiryDisplay } from "./shared";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { useCheckout } from "./useCheckout";
import { UserAvatar } from "@/components/shared/UserAvatar";

type CheckoutState = ReturnType<typeof useCheckout>;

function GoogleGIcon() {
    return (
        <svg className="h-4.5 w-4.5 mr-2.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
    );
}

export function DesktopCheckoutUI(props: CheckoutState) {
    const {
        user, isUpgrading, appliedPromo, setAppliedPromo, renewalData,
        curatedOffer, isCuratedDeal, curatedLinks, curatedApiQuota,
        planKey, planContext, planDisplayName, handlePurchase, handleLogin, isLoggingIn, router
    } = props;

    const isCurated = Boolean(isCuratedDeal && curatedOffer);
    const displayLinkCount = isCurated && curatedLinks
        ? `${curatedLinks.toLocaleString()} Permanent Links`
        : (planContext?.linkCount || "2,500 Permanent Links");
    const displayApiQuota = isCurated && curatedApiQuota
        ? `${curatedApiQuota.toLocaleString()} API Calls/mo`
        : "300,000 API Calls/mo";

    const finalPrice = planKey && planKey !== 'free' 
        ? (appliedPromo ? appliedPromo.finalAmount / 100 : (isCurated && curatedOffer?.discountType === "custom_price" ? curatedOffer.discountValue : PLAN_CONFIGS[resolvePlanType(planKey)].priceINR))
        : 0;

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden select-none">
            
            {/* LEFT PANEL: Deep Cosmic Pitch with Glass Accents */}
            <section className="relative flex w-1/2 flex-col justify-between overflow-y-auto bg-[#070913] px-10 xl:px-14 py-7 xl:py-9 text-slate-50 border-r border-slate-800/40 checkout-scrollbar">
                {/* Vibrant ambient gradients */}
                <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
                <div className="absolute top-1/2 -right-20 w-[380px] h-[380px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-24 left-1/3 w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-[100px] pointer-events-none" />
                
                {/* Header (Back & Brand) */}
                <div className="relative z-10 flex items-center justify-between shrink-0">
                    <button 
                        onClick={() => router.back()} 
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md transition-all hover:border-slate-700 hover:bg-slate-800/60 hover:text-white"
                    >
                        <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                        <span>Back</span>
                    </button>
                    
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 p-[1px] shadow-sm">
                            <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-[#070913]">
                                <span className="text-xs font-black text-white">X</span>
                            </div>
                        </div>
                        <span className="text-base font-extrabold tracking-tight text-white">URL</span>
                    </div>
                </div>

                {/* Center Pitch Content */}
                <div className="relative z-10 my-auto flex w-full max-w-lg flex-col gap-5 py-4">
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="space-y-2.5"
                    >
                        {planContext && (
                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 backdrop-blur-md">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                                    {isCurated ? "👑 ADMIN CURATED VIP PLAN" : (renewalData?.isRenewal ? `RENEW ${planContext.badgeName}` : planContext.badgeName)}
                                </span>
                            </div>
                        )}

                        {planContext ? (
                            <h1 className="text-4xl xl:text-[44px] font-black leading-[1.1] tracking-[-0.035em] text-white">
                                {isCurated ? (
                                    <>
                                        Curated <br />
                                        <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-indigo-300 bg-clip-text text-transparent">
                                            VIP Plan
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {renewalData?.isRenewal ? "Renew " : "Upgrade to "} <br />
                                        <span className="bg-gradient-to-r from-indigo-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                                            {planDisplayName}
                                        </span>
                                    </>
                                )}
                            </h1>
                        ) : (
                            <h1 className="text-4xl xl:text-[44px] font-black leading-[1.1] tracking-[-0.035em] text-white">
                                Welcome back
                            </h1>
                        )}
                        
                        <p className="max-w-[42ch] text-xs xl:text-sm leading-relaxed text-slate-400">
                            {isCurated
                                ? `Signed in as ${user?.displayName || user?.email}. Approved proposal perks (${displayLinkCount} & ${displayApiQuota}) unlocked for ₹${curatedOffer?.discountValue || 1}/mo.`
                                : user
                                ? `Signed in as ${user.displayName || user.email}. Review your plan perks and complete your purchase below.`
                                : "Everything included with your plan. Instant activation right after checkout."}
                        </p>
                    </motion.div>

                    {planContext && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
                            className="space-y-3 pt-1"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                {isCurated ? "Admin Curated Perks" : renewalData?.isRenewal ? "Renewal Perks" : "Included Benefits"}
                            </p>
                            
                            <div className="flex flex-col gap-2.5">
                                {renewalData?.isRenewal ? (
                                    <>
                                        <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 backdrop-blur-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400 border border-indigo-500/20">
                                                    <Link2 className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white">Active Links Maintained</p>
                                                    <p className="text-[11px] text-slate-400">{renewalData.linksUsed} of {renewalData.currentLimit} in use</p>
                                                </div>
                                            </div>
                                            <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300 border border-slate-700/60">
                                                Maintained
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 backdrop-blur-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 border border-emerald-500/30">
                                                    <Zap className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-emerald-300">Instant Capacity Boost</p>
                                                    <p className="text-[11px] text-emerald-400/80">+{renewalData.newAddition} links added</p>
                                                </div>
                                            </div>
                                            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/40">
                                                +{renewalData.newAddition}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 backdrop-blur-sm transition-all hover:border-slate-700/80">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400 border border-indigo-500/20">
                                                <Link2 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-white">Massive Link Capacity</p>
                                                <p className="text-[11px] text-slate-400">Create up to {displayLinkCount}</p>
                                            </div>
                                        </div>
                                        <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-300 border border-indigo-500/30">
                                            {displayLinkCount}
                                        </span>
                                    </div>
                                )}

                                {isCurated ? (
                                    <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 backdrop-blur-sm transition-all hover:border-amber-500/50">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30">
                                                <Zap className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-amber-200">Dedicated API Quota</p>
                                                <p className="text-[11px] text-amber-300/80">{displayApiQuota}</p>
                                            </div>
                                        </div>
                                        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/40">
                                            {displayApiQuota}
                                        </span>
                                    </div>
                                ) : null}

                                <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 backdrop-blur-sm transition-all hover:border-slate-700/80">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400 border border-emerald-500/20">
                                            <Clock className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-white">Extended Validity</p>
                                            <p className="text-[11px] text-slate-400">
                                                {isCurated ? "Permanent Links (Never Expire)" : getExpiryDisplay(planKey, renewalData?.isRenewal ?? false, renewalData?.planExpiry ?? null)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                                        {isCurated ? "Permanent" : "30 Days"}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer Security Badges */}
                <div className="relative z-10 flex items-center justify-between pt-2 text-[11px] text-slate-400 border-t border-slate-800/50 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>256-bit SSL Encryption</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Instant Plan Activation</span>
                    </div>
                </div>
            </section>


            {/* RIGHT PANEL: Crisp, Focused Checkout Container */}
            <section className="flex w-1/2 flex-col items-center bg-slate-50/70 px-6 sm:px-8 xl:px-12 pt-6 xl:pt-8 pb-12 overflow-y-auto checkout-scrollbar">
                <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
                    className="w-full max-w-[430px] flex flex-col pt-1 pb-8"
                >
                    {/* Header */}
                    <div className="mb-3.5 space-y-0.5 text-left">
                        <h2 className="text-2xl xl:text-[28px] font-extrabold tracking-tight text-slate-900">
                            {user
                                ? (isCurated ? "Curated Checkout" : planContext ? "Checkout" : "Finish Setup")
                                : "Complete Purchase"}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {user 
                                ? (isCurated ? "Review your curated perks and complete activation." : "Review your total and confirm payment.")
                                : "Sign in to connect your account and activate your plan."}
                        </p>
                    </div>

                    {/* Dynamic Auth Status Card: Shows "Signed in as [User]" if logged in, or Step 1 guidance if logged out */}
                    {user ? (
                        <div className="mb-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar user={user} className="h-8 w-8 text-xs shrink-0" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-slate-900 truncate">
                                            {user.displayName || "Account Connected"}
                                        </p>
                                        <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 shrink-0">
                                            Connected
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleLogin()}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0 ml-2 cursor-pointer"
                            >
                                Switch
                            </button>
                        </div>
                    ) : (
                        <div className="mb-3 rounded-xl border border-indigo-100/90 bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/70 p-3 shadow-xs">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white shadow-xs">
                                        1
                                    </div>
                                    <span className="text-xs font-bold text-slate-900">Sign in with Google</span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                                    <span>Next: Razorpay</span>
                                    <ArrowRight className="h-2.5 w-2.5" />
                                </span>
                            </div>
                            <p className="text-[11.5px] text-slate-600 leading-relaxed pl-7">
                                You are <strong className="text-slate-900">not logged in</strong>. Signing in connects this plan to your account so Razorpay can immediately process and activate your link limits.
                            </p>
                        </div>
                    )}

                    {/* Selected Plan Summary Card */}
                    {planContext && (
                        <div className="mb-2.5 rounded-xl bg-white border border-slate-200/80 p-3.5 shadow-xs transition-shadow hover:shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-0.5">
                                        {isCurated ? "Admin Curated VIP Plan" : "Selected Plan"}
                                    </p>
                                    <h3 className="text-base xl:text-lg font-bold text-slate-900">
                                        {isCurated ? "Curated VIP Plan" : (renewalData?.isRenewal ? `Renew ${planContext.badgeName}` : planContext.badgeName)}
                                    </h3>
                                    <span className="text-[11px] font-medium text-slate-500">
                                        {isCurated 
                                            ? `${displayLinkCount} · ${displayApiQuota}` 
                                            : getExpiryDisplay(planKey, renewalData?.isRenewal ?? false, renewalData?.planExpiry ?? null)}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <AnimatePresence mode="popLayout">
                                        {planKey && planKey !== 'free' && (
                                            appliedPromo ? (
                                                <motion.div
                                                    key="promo-applied"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="flex flex-col items-end leading-none"
                                                >
                                                    <span className="text-xs font-semibold text-slate-400 line-through decoration-red-500 decoration-1.5 mb-0.5">
                                                        ₹{PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                                    </span>
                                                    <span className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                                                        ₹{appliedPromo.finalAmount / 100}
                                                    </span>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="no-promo"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="flex flex-col items-end leading-none"
                                                >
                                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                                        ₹{isCurated && curatedOffer?.discountType === "custom_price" ? curatedOffer.discountValue : PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                                    </span>
                                                </motion.div>
                                            )
                                        )}
                                        {planKey === 'free' && (
                                            <motion.span
                                                key="free-plan"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="text-2xl font-black text-slate-900 tracking-tight"
                                            >
                                                Free
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Promo Code & Breakdown Section */}
                    <div className="mb-3">
                        {planKey !== 'free' && (
                            <PromoCodeSection
                                planId={planKey}
                                onPromoChange={setAppliedPromo}
                                variant="minimal"
                            />
                        )}
                    </div>

                    {/* Action CTA & Trust Footer */}
                    <div className="space-y-2">
                        {user ? (
                            <Button
                                onClick={handlePurchase}
                                disabled={isUpgrading}
                                className="h-12 xl:h-13 w-full rounded-xl bg-slate-950 text-sm xl:text-base font-semibold text-white shadow-[0_8px_20px_-4px_rgba(15,23,42,0.25)] hover:bg-slate-900 hover:shadow-[0_12px_24px_-4px_rgba(15,23,42,0.3)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer"
                            >
                                {isUpgrading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isUpgrading ? (
                                    "Processing..."
                                ) : planKey === 'free' ? (
                                    "Claim Free Plan"
                                ) : renewalData?.isRenewal ? (
                                    `Renew for ₹${finalPrice}`
                                ) : (
                                    `Pay ₹${finalPrice} via Razorpay`
                                )} 
                                {!isUpgrading && <ArrowRight className="ml-2 h-4 w-4 opacity-70" />}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className="h-12 xl:h-13 w-full rounded-xl bg-slate-950 text-sm xl:text-base font-semibold text-white shadow-[0_8px_20px_-4px_rgba(15,23,42,0.25)] hover:bg-slate-900 hover:shadow-[0_12px_24px_-4px_rgba(15,23,42,0.3)] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer"
                            >
                                {isLoggingIn ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <GoogleGIcon />
                                )}
                                {isLoggingIn ? "Connecting to Google..." : "Sign in with Google to Checkout"} 
                                {!isLoggingIn && <ArrowRight className="ml-2 h-4 w-4 opacity-70" />}
                            </Button>
                        )}
                        
                        <p className="text-center text-[11px] text-slate-500 font-medium">
                            {user 
                                ? "🔒 256-bit SSL encrypted • Instant link activation via Razorpay" 
                                : "🔒 1-click Google sign-in • Direct redirect to Razorpay"}
                        </p>
                    </div>

                </motion.div>
            </section>

        </div>
    );
}

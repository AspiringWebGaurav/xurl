import React from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Link2, Clock, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromoCodeSection } from "@/components/payments/PromoCodeSection";
import { getExpiryDisplay } from "./shared";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";

import { useCheckout } from "./useCheckout";
import { UpgradeNavbar } from "@/components/layout/UpgradeNavbar";
import { UserAvatar } from "@/components/shared/UserAvatar";

type CheckoutState = ReturnType<typeof useCheckout>;

export function MobileCheckoutUI(props: CheckoutState) {
    const {
        user, isUpgrading, paymentState, appliedPromo, setAppliedPromo,
        renewalData, planKey, planContext, planDisplayName, handlePurchase, handleLogin, isLoggingIn, router
    } = props;

    const finalPrice = planKey && planKey !== 'free' 
        ? (appliedPromo ? appliedPromo.finalAmount / 100 : PLAN_CONFIGS[resolvePlanType(planKey)].priceINR)
        : 0;

    return (
        <div className="flex h-[100dvh] w-full flex-col bg-slate-50 overflow-hidden">
            <UpgradeNavbar
                backLabel="Back"
                logoHref="/"
                homeHref="/"
                onBack={() => router.back()}
                contentClassName="max-w-none px-4"
            />

            <main className="flex flex-1 flex-col items-center justify-between px-4 pb-4 overflow-hidden">
                {/* Top Section */}
                <div className="w-full flex flex-col gap-4 overflow-hidden pt-2">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {renewalData?.isRenewal ? "Renewing" : "Upgrading to"}
                            </p>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                                <span className="bg-[linear-gradient(90deg,#6366f1,#22c55e,#f59e0b)] bg-clip-text text-transparent">
                                    {planDisplayName || "Checkout"}
                                </span>
                            </h1>
                        </div>
                        {planContext && (
                            <div className={`flex flex-col items-end`}>
                                {planKey && planKey !== 'free' && (
                                    appliedPromo ? (
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-xs font-semibold text-slate-400 line-through decoration-red-500 decoration-2">
                                                ₹{PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                            </span>
                                            <span className="text-xl font-bold text-emerald-600">
                                                ₹{appliedPromo.finalAmount / 100}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xl font-bold text-slate-900">
                                            ₹{PLAN_CONFIGS[resolvePlanType(planKey)].priceINR}
                                        </span>
                                    )
                                )}
                                {planKey === 'free' && (
                                    <span className="text-xl font-bold text-slate-900">Free</span>
                                )}
                                <div className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${planContext.badgeStyle}`}>
                                    <Clock className="w-2.5 h-2.5" />
                                    <span className="text-[8px] font-bold uppercase tracking-wider">
                                        {getExpiryDisplay(planKey, renewalData?.isRenewal ?? false, renewalData?.planExpiry ?? null).replace('Valid for ', '')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Compact Benefits Row (Horizontal Scroll) */}
                    {planContext && (
                        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {renewalData?.isRenewal ? (
                                <>
                                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                        <div className={`${planContext.linkBgColor} rounded-md p-1.5`}>
                                            <Link2 className={`h-3.5 w-3.5 ${planContext.linkIconColor}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">In Use</span>
                                            <span className="text-xs font-semibold text-slate-900">{renewalData.linksUsed}/{renewalData.currentLimit}</span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 shadow-sm">
                                        <div className="rounded-md bg-emerald-100 p-1.5">
                                            <Zap className="h-3.5 w-3.5 text-emerald-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wide">Adding</span>
                                            <span className="text-xs font-semibold text-emerald-700">+{renewalData.newAddition} Links</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                    <div className={`${planContext.linkBgColor} rounded-md p-1.5`}>
                                        <Link2 className={`h-3.5 w-3.5 ${planContext.linkIconColor}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Capacity</span>
                                        <span className="text-xs font-semibold text-slate-900">{planContext.linkCount}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Promo & Summary Section */}
                    {planKey !== 'free' && (
                        <div className="w-full shrink-0 mt-2">
                            <PromoCodeSection planId={planKey} onPromoChange={setAppliedPromo} />
                        </div>
                    )}
                </div>

                {/* Bottom Docked Section */}
                <div className="w-full shrink-0 flex flex-col gap-3 pt-3 border-t border-slate-200">
                    {user ? (
                        <>
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <UserAvatar user={user} className="h-6 w-6 text-[10px] shrink-0" />
                                    <p className="text-xs font-semibold text-slate-700 truncate">
                                        {user.displayName || user.email}
                                    </p>
                                </div>
                                <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.2 text-[9px] font-bold text-emerald-700 shrink-0">
                                    Connected
                                </span>
                            </div>
                            <Button
                                onClick={handlePurchase}
                                disabled={isUpgrading}
                                className="h-14 w-full rounded-[16px] bg-slate-900 text-base font-semibold text-slate-50 shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                            >
                                {isUpgrading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                {isUpgrading ? (
                                    "Processing..."
                                ) : planKey === 'free' ? (
                                    "Claim Free Plan"
                                ) : renewalData?.isRenewal ? (
                                    `Renew for ₹${finalPrice}`
                                ) : (
                                    `Pay ₹${finalPrice} via Razorpay`
                                )} 
                                {!isUpgrading && <ArrowRight className="ml-2 h-5 w-5 opacity-70" />}
                            </Button>
                        </>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className="h-14 w-full rounded-[16px] bg-slate-900 text-base font-semibold text-slate-50 shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                            >
                                {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                {isLoggingIn ? "Connecting..." : "Sign in with Google to Checkout"} 
                                {!isLoggingIn && <ArrowRight className="ml-2 h-5 w-5 opacity-70" />}
                            </Button>
                            <p className="text-center text-[11px] text-slate-500">
                                🔒 Sign in required to link plan and open Razorpay payment.
                            </p>
                        </div>
                    )}
                    
                    {user && planKey !== 'free' && (
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 pb-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Secured by Razorpay</span>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

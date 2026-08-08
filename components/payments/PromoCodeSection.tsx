"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { auth } from "@/lib/firebase/config";
import { Loader2, Tag, Sparkles } from "lucide-react";

export interface AppliedPromo {
    code: string;
    isManualPromo?: boolean;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    subtotalAmount?: number;
    gstAmount?: number;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
}

interface PromoCodeSectionProps {
    planId: string | null;
    onPromoChange: (promo: AppliedPromo | null) => void;
    variant?: "default" | "minimal";
}

function formatInrPaise(amount: number): string {
    return `Rs. ${(amount / 100).toFixed(2)}`;
}

export function PromoCodeSection({ planId, onPromoChange, variant = "default" }: PromoCodeSectionProps) {
    const resolvedPlan = resolvePlanType(planId);
    const baseAmount = PLAN_CONFIGS[resolvedPlan].priceINR * 100;
    const [code, setCode] = useState("");
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState("");
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
    const [globalOffer, setGlobalOffer] = useState<any>(null);
    const [partialOffer, setPartialOffer] = useState<any>(null);

    useEffect(() => {
        let mounted = true;
        
        // Fetch Public Global Offers
        fetch("/api/config/public")
            .then(res => res.json())
            .then(data => {
                if (!mounted || !data.config) return;
                const config = data.config;
                const now = Date.now();
                const validOffers = ((config.offers || []) as Array<{ isActive?: boolean; expiresAt?: number | null; type?: string; value?: number }>).filter((o) => o.isActive && (!o.expiresAt || o.expiresAt > now));
                let best: { type?: string; value?: number } | null = null;
                const proxyPrice = PLAN_CONFIGS[resolvedPlan].priceINR;
                let maxD = 0;
                for (const o of validOffers) {
                    const val = o.value || 0;
                    const d = o.type === "percentage" ? proxyPrice * (val / 100) : val;
                    if (d > maxD) { maxD = d; best = o; }
                }
                setGlobalOffer(best);
            })
            .catch(console.error);

        // Fetch User Targeted Partial Offers
        const user = auth.currentUser;
        if (user) {
            user.getIdToken().then((token) => {
                fetch("/api/user/partial-offers", {
                    headers: { Authorization: `Bearer ${token}` }
                })
                    .then(res => res.json())
                    .then(data => {
                        if (!mounted || !Array.isArray(data.offers) || data.offers.length === 0) {
                            setPartialOffer(null);
                            return;
                        }
                        const applicable = (data.offers as Array<{ plans: string[] }>).find((o) => 
                            o.plans.includes("all") || o.plans.includes(resolvedPlan.toLowerCase())
                        );
                        if (applicable) {
                            setPartialOffer(applicable);
                        } else {
                            setPartialOffer(null);
                        }
                    })
                    .catch(() => setPartialOffer(null));
            });
        }

        return () => { mounted = false; };
    }, [resolvedPlan]);

    useEffect(() => {
        setCode("");
        setError("");
        setAppliedPromo(null);
    }, [resolvedPlan]);

    const summary = useMemo(() => {
        let finalAmount = baseAmount;

        if (partialOffer) {
            const priceINR = PLAN_CONFIGS[resolvedPlan].priceINR;
            let finalPrice = priceINR;
            if (partialOffer.discountType === "percentage") {
                finalPrice = Math.max(0, priceINR * (1 - partialOffer.discountValue / 100));
            } else if (partialOffer.discountType === "flat") {
                finalPrice = Math.max(0, priceINR - partialOffer.discountValue);
            } else if (partialOffer.discountType === "custom_price") {
                finalPrice = Math.max(0, partialOffer.discountValue);
            }
            const partialDiscountPaise = baseAmount - Math.round(finalPrice * 100);
            finalAmount -= partialDiscountPaise;
        } else if (globalOffer) {
            const priceINR = PLAN_CONFIGS[resolvedPlan].priceINR;
            let finalPrice = priceINR;
            if (globalOffer.type === "percentage") {
                finalPrice = Math.max(0, priceINR * (1 - globalOffer.value / 100));
            } else if (globalOffer.type === "flat") {
                finalPrice = Math.max(0, priceINR - globalOffer.value);
            }
            const globalDiscountPaise = baseAmount - Math.round(finalPrice * 100);
            finalAmount -= globalDiscountPaise;
        }

        if (appliedPromo) {
            let promoDiscountPaise = 0;
            if (appliedPromo.discountType === "free_plan") {
                promoDiscountPaise = finalAmount;
            } else if (appliedPromo.discountType === "percentage") {
                promoDiscountPaise = Math.round(finalAmount * (appliedPromo.discountValue / 100));
            } else if (appliedPromo.discountType === "fixed") {
                promoDiscountPaise = Math.round(appliedPromo.discountValue * 100);
            }
            promoDiscountPaise = Math.min(promoDiscountPaise, finalAmount);
            finalAmount -= promoDiscountPaise;
        }

        const totalDiscountPaise = baseAmount - finalAmount;
        // Backward calculate GST since the final amount is inclusive
        const subtotalPaise = finalAmount === 0 ? 0 : Math.round(finalAmount / 1.18);
        const gstPaise = finalAmount === 0 ? 0 : finalAmount - subtotalPaise;

        let codeLabel = "";
        if (partialOffer) {
            codeLabel = `Admin Special Deal (${partialOffer.title})`;
        } else if (globalOffer) {
            codeLabel = `Global Offer (${globalOffer.name})`;
        }

        if (appliedPromo) {
            codeLabel = codeLabel ? `${codeLabel} + ${appliedPromo.code}` : appliedPromo.code;
        }

        return {
            code: codeLabel,
            originalAmount: baseAmount,
            discountAmount: totalDiscountPaise,
            subtotalAmount: subtotalPaise,
            gstAmount: gstPaise,
            finalAmount: finalAmount,
            discountType: "fixed" as const,
            discountValue: totalDiscountPaise,
        };
    }, [appliedPromo, baseAmount, globalOffer, partialOffer, resolvedPlan]);

    useEffect(() => {
        if (summary.discountAmount > 0) {
            onPromoChange(summary);
        } else {
            onPromoChange(null);
        }
    }, [summary, onPromoChange]);

    if (PLAN_CONFIGS[resolvedPlan].priceINR <= 0) {
        return null;
    }

    async function applyPromoCode() {
        const trimmedCode = code.trim();
        if (!trimmedCode) {
            setError("Enter a promo code.");
            setAppliedPromo(null);
            onPromoChange(null);
            return;
        }

        setApplying(true);
        setError("");

        try {
            const response = await fetch("/api/promo-codes/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: trimmedCode, planId: resolvedPlan }),
            });
            const data = await response.json();

            if (!response.ok || !data.valid) {
                throw new Error(data.message || "Promo code is not valid.");
            }

            const nextPromo: AppliedPromo = {
                code: data.code,
                isManualPromo: true,
                originalAmount: data.originalAmount,
                discountAmount: data.discountAmount,
                subtotalAmount: Math.round(data.finalAmount / 1.18),
                gstAmount: data.finalAmount - Math.round(data.finalAmount / 1.18),
                finalAmount: data.finalAmount,
                discountType: data.discountType,
                discountValue: data.discountValue,
            };

            setCode(data.code);
            setAppliedPromo(nextPromo);
            onPromoChange(nextPromo);
        } catch (promoError) {
            setAppliedPromo(null);
            onPromoChange(null);
            setError(promoError instanceof Error ? promoError.message : "Promo code is not valid.");
        } finally {
            setApplying(false);
        }
    }

    function clearPromoCode() {
        setCode("");
        setError("");
        setAppliedPromo(null);
        onPromoChange(null);
    }

    return (
        <div className={`mb-4 ${variant === "default" ? "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" : "px-1 py-1"}`}>
            {partialOffer && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 p-3 text-indigo-950 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse shrink-0" />
                        <div>
                            <p className="text-xs font-black">🎉 Admin Granted Offer Applied</p>
                            <p className="text-[11px] text-slate-600 font-medium">{partialOffer.title}</p>
                        </div>
                    </div>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                        {partialOffer.discountType === "percentage" ? `${partialOffer.discountValue}% OFF` : `₹${partialOffer.discountValue} OFF`}
                    </span>
                </div>
            )}

            <div className={`flex items-center gap-2 text-slate-900 ${variant === "minimal" ? "px-1" : ""}`}>
                <Tag className={`${variant === "minimal" ? "h-4 w-4" : "h-3.5 w-3.5"} text-slate-500`} />
                <p className={`${variant === "minimal" ? "text-sm" : "text-xs"} font-semibold`}>Promo code</p>
            </div>

            <div className="mt-2.5 flex gap-2">
                <Input
                    value={code}
                    onChange={(event) => {
                        setCode(event.target.value.toUpperCase());
                        setError("");
                        if (appliedPromo) {
                            setAppliedPromo(null);
                            onPromoChange(null);
                        }
                    }}
                    placeholder="Enter code"
                    className={`${variant === "minimal" ? "h-11 text-base" : "h-10"} rounded-xl border-slate-200 bg-white`}
                />
                <Button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={applying}
                    className={`${variant === "minimal" ? "h-11 px-5 text-base" : "h-10 px-4 text-sm"} rounded-xl bg-slate-900 text-white hover:bg-slate-800`}
                >
                    {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
            </div>

            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

            {appliedPromo && (
                <div className={`mt-2.5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 ${variant === "minimal" ? "text-sm" : "text-[11px]"}`}>
                    <span>
                        Applied <span className="font-semibold">{appliedPromo.code}</span>
                    </span>
                    <button type="button" onClick={clearPromoCode} className="font-semibold underline underline-offset-4 hover:text-emerald-900">
                        Remove
                    </button>
                </div>
            )}

            <div className={`mt-4 space-y-2 rounded-lg ${variant === "default" ? "border border-slate-200 bg-white px-3 py-2.5 text-xs" : "py-1 text-[15px]"}`}>
                <div className="flex items-center justify-between text-slate-500">
                    <span>Original price</span>
                    <span className={`font-mono font-medium ${appliedPromo ? "line-through opacity-70" : "text-slate-900"}`}>{formatInrPaise(summary.originalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                    <span>{summary.code ? `Discount (${summary.code})` : "Discount"}</span>
                    <span className="font-mono font-bold text-emerald-600">- {formatInrPaise(summary.discountAmount)}</span>
                </div>
                {summary.gstAmount !== undefined && summary.gstAmount > 0 && (
                    <>
                        <div className="flex items-center justify-between text-slate-500">
                            <span>Subtotal (excl. GST)</span>
                            <span className="font-mono font-medium text-slate-900">{formatInrPaise(summary.subtotalAmount!)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                            <span>GST (18%)</span>
                            <span className="font-mono font-medium text-slate-600">+ {formatInrPaise(summary.gstAmount)}</span>
                        </div>
                    </>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-900">
                    <span className={`${variant === "minimal" ? "text-base font-bold" : ""}`}>Final price</span>
                    <span className={`font-mono ${variant === "minimal" ? "text-xl font-black text-slate-950" : "font-bold"}`}>{formatInrPaise(summary.finalAmount)}</span>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { Loader2, Tag } from "lucide-react";

export interface AppliedPromo {
    code: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    discountType: "percentage" | "fixed" | "free_plan";
    discountValue: number;
}

interface PromoCodeSectionProps {
    planId: string | null;
    onPromoChange: (promo: AppliedPromo | null) => void;
}

function formatInrPaise(amount: number): string {
    return `Rs. ${(amount / 100).toFixed(2)}`;
}

export function PromoCodeSection({ planId, onPromoChange }: PromoCodeSectionProps) {
    const resolvedPlan = resolvePlanType(planId);
    const baseAmount = PLAN_CONFIGS[resolvedPlan].priceINR * 100;
    const [code, setCode] = useState("");
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState("");
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

    useEffect(() => {
        setCode("");
        setError("");
        setAppliedPromo(null);
        onPromoChange(null);
    }, [resolvedPlan, onPromoChange]);

    const summary = useMemo(() => {
        if (appliedPromo) {
            return appliedPromo;
        }

        return {
            code: "",
            originalAmount: baseAmount,
            discountAmount: 0,
            finalAmount: baseAmount,
            discountType: "fixed" as const,
            discountValue: 0,
        };
    }, [appliedPromo, baseAmount]);

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
                originalAmount: data.originalAmount,
                discountAmount: data.discountAmount,
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
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2 text-slate-900">
                <Tag className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold">Promo code</p>
            </div>

            <div className="mt-3 flex gap-2">
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
                    className="h-10 rounded-xl border-slate-200 bg-white"
                />
                <Button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={applying}
                    className="h-10 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                >
                    {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
            </div>

            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

            {appliedPromo && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    <span>
                        Applied <span className="font-semibold">{appliedPromo.code}</span>
                    </span>
                    <button type="button" onClick={clearPromoCode} className="font-semibold underline underline-offset-4">
                        Remove
                    </button>
                </div>
            )}

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                <div className="flex items-center justify-between text-slate-500">
                    <span>Original price</span>
                    <span className={appliedPromo ? "line-through" : ""}>{formatInrPaise(summary.originalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                    <span>Discount</span>
                    <span className="text-emerald-600">- {formatInrPaise(summary.discountAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                    <span>Final price</span>
                    <span>{formatInrPaise(summary.finalAmount)}</span>
                </div>
            </div>
        </div>
    );
}

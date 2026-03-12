"use client";

import { useState, useEffect, Suspense } from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ShieldCheck, CreditCard, Zap, AlertCircle, Clock, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { PLAN_CONFIGS, PAID_PLAN_ORDER } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";

/** Reads ?plan= from URL — must be wrapped in <Suspense>. */
function SearchParamsReader({ onPlan }: { onPlan: (plan: string | null) => void }) {
    const searchParams = useSearchParams();
    useEffect(() => {
        onPlan(searchParams.get("plan"));
    }, [searchParams, onPlan]);
    return null;
}

type Currency = "INR" | "USD" | "EUR";

const defaultExchangeRates: Record<Currency, number> = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
};

const currencySymbols: Record<Currency, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
};

interface PricingTier {
    name: string;
    planId: string;
    description: string;
    priceINR: number;
    links: string;
    expiry: string;
    isPopular?: boolean;
    features?: string[];
    ctaText: string;
    comparisonHint?: string;
}

// UI-only metadata for each paid plan (display strings not in PLAN_CONFIGS)
const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
    starter: { description: "Personal use", features: ["Login required", "Custom aliases"], ctaText: "Start" },
    pro: { description: "For power users", features: ["Login required", "Custom aliases", "Priority support"], ctaText: "Go Pro" },
    business: { description: "Best value for heavy users", features: ["Login required", "Custom aliases", "Priority support", "4× more links than Pro"], ctaText: "Get Business", comparisonHint: "Most Popular" },
    enterprise: { description: "Advanced link management", features: ["Login required", "Custom aliases", "Custom domains integration"], ctaText: "Go Enterprise" },
    bigenterprise: { description: "Maximum scale", features: ["Login required", "Custom aliases", "Dedicated account manager"], ctaText: "Go Big" },
};

function formatTtl(ttlMs: number): string {
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${Math.round(ttlMs / (60 * 1000))} minutes`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}

// Derive tiers from the centralized PLAN_CONFIGS — prices, limits, and TTLs stay in sync automatically
const tiers: PricingTier[] = PAID_PLAN_ORDER.map((planId: PlanType) => {
    const cfg = PLAN_CONFIGS[planId];
    const ui = PLAN_UI_META[planId] || { description: "", features: [], ctaText: cfg.label };
    return {
        name: cfg.label,
        planId,
        description: ui.description,
        priceINR: cfg.priceINR,
        links: `${cfg.limit} links`,
        expiry: formatTtl(cfg.ttlMs),
        isPopular: cfg.badge === "MOST_POPULAR",
        features: ui.features,
        ctaText: ui.ctaText,
        comparisonHint: ui.comparisonHint,
    };
});

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
        },
    },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.42,
            ease: "easeOut",
        },
    },
};

export default function PricingPage() {
    const [currency, setCurrency] = useState<Currency>("INR");
    const [rates, setRates] = useState<Record<Currency, number>>(defaultExchangeRates);
    const [user, setUser] = useState<User | null>(null);
    const [currentPlan, setCurrentPlan] = useState<string>("free");

    const router = useRouter();
    const [focusPlan, setFocusPlan] = useState<string | null>(null);

    useEffect(() => {
        if (focusPlan) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`plan-${focusPlan.toLowerCase()}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [focusPlan]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                try {
                    const token = await u.getIdToken();
                    const res = await fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } });
                    const data = await res.json();
                    if (data.plan) {
                        setCurrentPlan(data.plan);
                    }
                } catch (err) {
                    console.error("Failed to fetch current plan", err);
                }
            } else {
                setCurrentPlan("free");
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let mounted = true;
        fetch("/api/exchange-rates")
            .then((res) => res.json())
            .then((data) => {
                if (mounted && data?.rates) {
                    setRates(data.rates);
                }
            })
            .catch(console.error);

        document.documentElement.style.setProperty('scrollbar-width', 'none');
        document.body.style.setProperty('scrollbar-width', 'none');
        const style = document.createElement('style');
        style.id = 'hide-scrollbar-style';
        style.innerHTML = `
            ::-webkit-scrollbar {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            mounted = false;
            document.documentElement.style.removeProperty('scrollbar-width');
            document.body.style.removeProperty('scrollbar-width');
            const styleElement = document.getElementById('hide-scrollbar-style');
            if (styleElement) {
                styleElement.remove();
            }
        };
    }, []);

    const formatPrice = (priceINR: number) => {
        const converted = priceINR * rates[currency];
        if (currency === "INR") return converted.toString();
        return Number(converted.toFixed(1)).toString();
    };

    const handleUpgrade = (tierPlanId: string, tierDisplayName: string) => {
        router.push(`/login?plan=${tierPlanId}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
            <Suspense fallback={null}>
                <SearchParamsReader onPlan={setFocusPlan} />
            </Suspense>
            <TopNavbar />

            <main className="flex-1 py-16 px-6 lg:px-8 flex flex-col items-center z-10">
                <div className="text-center max-w-3xl mb-12">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
                        Simple, transparent pricing
                    </h1>
                    <p className="text-lg text-slate-600">
                        Choose the perfect plan for your link management needs. No hidden fees.
                    </p>
                </div>

                <div className="flex items-center p-1 bg-slate-200/50 rounded-lg mb-12 shadow-sm border border-slate-200">
                    {(["INR", "USD", "EUR"] as Currency[]).map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={`px-6 py-2 text-sm font-medium rounded-md transition-all duration-200 ${currency === c
                                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                }`}
                        >
                            {currencySymbols[c]} {c}
                        </button>
                    ))}
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 group/cards"
                >
                    {/* Free Plan Card — Guest + Account Access */}
                    <motion.div
                        id="plan-free"
                        variants={cardVariants}
                        className={`rounded-2xl border bg-white p-8 shadow-sm flex flex-col transition-all duration-[400ms] ease-out hover:-translate-y-2 hover:shadow-xl hover:border-slate-300 group-hover/cards:[&:not(:hover)]:opacity-90 relative ${focusPlan === 'free' ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.15)] scale-[1.02]' : 'border-slate-200'}`}
                    >
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Free</h3>
                            <p className="text-sm text-slate-500">Quick testing</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-extrabold text-slate-900">Free</span>
                        </div>

                        <div className="flex-1 space-y-6">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Guest Access</h4>
                                <ul className="space-y-3">
                                    {["1 link", "Expires in 5 minutes", "No login required", "Once per IP"].map((feature, i) => (
                                        <li key={i} className="flex items-start">
                                            <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                                            <span className={`text-sm ${i === 0 ? "text-slate-900 font-semibold" : "text-slate-600"}`}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Account Access</h4>
                                <ul className="space-y-3">
                                    {["1 link", "Expires in 10 minutes", "Login required", "24h cooldown", "3 uses max"].map((feature, i) => (
                                        <li key={i} className="flex items-start">
                                            <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                                            <span className={`text-sm ${i === 0 ? "text-slate-900 font-semibold" : "text-slate-600"}`}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <Button
                            className={`w-full mt-8 transition-all duration-150 ease-out ${currentPlan === "free" && user ? "bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200 disabled:opacity-100" : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 hover:brightness-95"}`}
                            onClick={() => router.push(user ? "/" : "/login?plan=free")}
                            disabled={currentPlan === "free" && user !== null}
                        >
                            {user ? (currentPlan === "free" ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Current Plan</span> : "Go to Dashboard") : "Try Free"}
                        </Button>
                    </motion.div>

                    {/* Paid Plans */}
                    {tiers.map((tier) => {
                        const isFocused = focusPlan === tier.planId;

                        return (
                            <motion.div
                                key={tier.planId}
                                id={`plan-${tier.planId}`}
                                variants={cardVariants}
                                className={`rounded-2xl border bg-white p-8 flex flex-col transition-all duration-[400ms] ease-out hover:-translate-y-2 hover:shadow-xl group-hover/cards:[&:not(:hover)]:opacity-90 relative 
                                ${isFocused
                                        ? "border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.15)] scale-[1.02]"
                                        : tier.isPopular
                                            ? "border-primary/40 shadow-[0_0_20px_rgba(0,0,0,0.04)] ring-1 ring-primary/10 bg-slate-50/40 hover:shadow-[0_0_30px_hsl(var(--primary)/20%)] hover:border-primary/60"
                                            : "border-slate-200 shadow-sm hover:border-slate-300"
                                    }`}
                            >
                                {tier.isPopular && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                                        className="absolute -top-3.5 left-0 right-0 flex justify-center"
                                    >
                                        <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Most Popular
                                        </span>
                                    </motion.div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                        {tier.name}
                                        {tier.comparisonHint && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                {tier.comparisonHint}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-slate-500 min-h-[40px]">{tier.description}</p>
                                </div>

                                <div className="mb-6 flex items-baseline text-slate-900">
                                    <span className="text-3xl font-bold tracking-tight">{currencySymbols[currency]}</span>
                                    <motion.span
                                        key={currency}
                                        initial={{ opacity: 0, filter: "blur(4px)" }}
                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        className="text-4xl font-extrabold tracking-tight"
                                    >
                                        {formatPrice(tier.priceINR)}
                                    </motion.span>
                                    <span className="text-sm font-medium text-slate-500 ml-1">/mo</span>
                                </div>

                                <div className="flex-1">
                                    <ul className="space-y-4">
                                        <li className="flex items-start">
                                            <Check className="h-5 w-5 text-slate-900 shrink-0 mr-3" />
                                            <span className="text-sm text-slate-900 font-semibold">{tier.links}</span>
                                        </li>
                                        <li className="flex items-start">
                                            <Check className="h-5 w-5 text-slate-900 shrink-0 mr-3" />
                                            <span className="text-sm text-slate-600">{tier.expiry}</span>
                                        </li>
                                        {tier.features?.map((feature, i) => (
                                            <li key={i} className="flex items-start">
                                                <Check className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
                                                <span className="text-sm text-slate-500">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <Button
                                    className={`w-full mt-8 transition-all duration-150 ease-out 
                                    ${tier.planId === currentPlan
                                            ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:scale-105"
                                            : tier.isPopular
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:brightness-95 hover:scale-105"
                                                : "bg-slate-100 text-slate-900 hover:bg-slate-200 hover:brightness-95 hover:scale-105"
                                        }`}
                                    onClick={() => handleUpgrade(tier.planId, tier.name)}
                                >
                                    {tier.planId === currentPlan ? (
                                        <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> Renew / Repurchase</span>
                                    ) : (
                                        tier.ctaText
                                    )}
                                </Button>
                            </motion.div>
                        );
                    })}
                </motion.div>

                <div className="mt-16 mb-8 flex items-center justify-center gap-2 text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Secure checkout powered by Razorpay</span>
                </div>
            </main>
        </div>
    );
}

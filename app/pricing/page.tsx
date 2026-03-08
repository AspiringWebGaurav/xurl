"use client";

import { useState, useEffect } from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";

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
    description: string;
    priceINR: number;
    links: string;
    expiry: string;
    isPopular?: boolean;
    features?: string[];
    ctaText: string;
    comparisonHint?: string;
}

const tiers: PricingTier[] = [
    {
        name: "Starter",
        description: "Personal use",
        priceINR: 100,
        links: "5 links",
        expiry: "Expires in 12 hours",
        features: ["Login required"],
        ctaText: "Start",
    },
    {
        name: "Creator",
        description: "Perfect for creators",
        priceINR: 200,
        links: "20 links",
        expiry: "Expires in 24 hours",
        features: ["Login required"],
        ctaText: "Upgrade",
    },
    {
        name: "Business",
        description: "Perfect for teams & startups",
        priceINR: 300,
        links: "50 links",
        expiry: "Expires in 3 days",
        isPopular: true,
        features: ["Login required", "Priority support"],
        ctaText: "Get Business",
        comparisonHint: "Best value for teams",
    },
    {
        name: "Enterprise",
        description: "Advanced link management",
        priceINR: 500,
        links: "100 links",
        expiry: "Expires in 7 days",
        features: ["Login required", "Custom domains integration"],
        ctaText: "Go Enterprise",
    },
    {
        name: "Scale",
        description: "Maximum scale",
        priceINR: 1000,
        links: "Unlimited links",
        expiry: "No expiry",
        features: ["Login required", "Dedicated account manager"],
        ctaText: "Contact Sales",
    },
];

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
        return () => {
            mounted = false;
        };
    }, []);

    const formatPrice = (priceINR: number) => {
        const converted = priceINR * rates[currency];
        if (currency === "INR") return converted.toString();

        return Number(converted.toFixed(1)).toString();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <TopNavbar />

            <main className="flex-1 py-16 px-6 lg:px-8 flex flex-col items-center">
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
                    {/* Free Plan (Custom layout combining Guest and Account) */}
                    <motion.div
                        variants={cardVariants}
                        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col transition-all duration-[200ms] ease-out hover:-translate-y-2 hover:shadow-xl hover:border-slate-300 group-hover/cards:[&:not(:hover)]:opacity-90 relative"
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
                                    {["1 link", "Expires in 1 hour", "No login required"].map((feature, i) => (
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
                                    {["2 links", "Expires in 1 hour", "Login required"].map((feature, i) => (
                                        <li key={i} className="flex items-start">
                                            <Check className="h-5 w-5 text-emerald-500 shrink-0 mr-3" />
                                            <span className={`text-sm ${i === 0 ? "text-slate-900 font-semibold" : "text-slate-600"}`}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <Button className="w-full mt-8 bg-slate-900 text-white hover:bg-slate-800 transition-all duration-150 ease-out hover:scale-105 hover:brightness-95" asChild>
                            <Link href="/">Try Free</Link>
                        </Button>
                    </motion.div>

                    {/* Paid Plans */}
                    {tiers.map((tier) => (
                        <motion.div
                            key={tier.name}
                            variants={cardVariants}
                            className={`rounded-2xl border bg-white p-8 flex flex-col transition-all duration-[200ms] ease-out hover:-translate-y-2 hover:shadow-xl group-hover/cards:[&:not(:hover)]:opacity-90 relative ${tier.isPopular
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
                                className={`w-full mt-8 transition-all duration-150 ease-out hover:scale-105 ${tier.isPopular
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:brightness-95"
                                    : "bg-slate-100 text-slate-900 hover:bg-slate-200 hover:brightness-95"
                                    }`}
                                asChild
                            >
                                <Link href="/login">{tier.ctaText}</Link>
                            </Button>
                        </motion.div>
                    ))}
                </motion.div>
            </main>
        </div>
    );
}

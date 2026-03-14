"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight, Lock, ShieldCheck, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

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

const FREE_GUEST_FEATURES = [
    "1 link",
    "Expires in 5 minutes",
    "No login required",
    "Once per IP",
];

const FREE_ACCOUNT_FEATURES = [
    "1 link",
    "Expires in 10 minutes",
    "Login required",
    "24h cooldown",
    "3 uses max",
];

const FREE_FEATURE_SLIDES = [
    {
        id: "guest",
        title: "Guest Access",
        description: "One quick short link without creating an account.",
        features: FREE_GUEST_FEATURES,
    },
    {
        id: "account",
        title: "Free Account Access",
        description: "Sign in for a slightly longer expiry with simple usage limits.",
        features: FREE_ACCOUNT_FEATURES,
    },
];

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

const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
    starter: { description: "Personal use", features: ["Login required", "Custom aliases", "Analytics Dashboard"], ctaText: "Start" },
    pro: { description: "For power users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Priority support"], ctaText: "Go Pro" },
    business: { description: "Best value for heavy users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Priority support", "4× more links than Pro"], ctaText: "Get Business", comparisonHint: "Most Popular" },
    enterprise: { description: "Advanced link management", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Custom domains integration"], ctaText: "Go Enterprise" },
    bigenterprise: { description: "Maximum scale", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Dedicated account manager"], ctaText: "Go Big" },
};

function formatTtl(ttlMs: number): string {
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${Math.round(ttlMs / (60 * 1000))} minutes`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}

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

/* ── Cinematic scroll helper ── */
function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothScrollTo(el: HTMLElement, targetY: number, duration: number) {
    const startY = el.scrollTop;
    const distance = targetY - startY;
    let startTime: number | null = null;

    function step(timestamp: number) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        el.scrollTop = startY + distance * eased;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

export default function PricingPage() {
    const [currency, setCurrency] = useState<Currency>("INR");
    const [rates, setRates] = useState<Record<Currency, number>>(defaultExchangeRates);
    const [user, setUser] = useState<User | null>(null);
    const [currentPlan, setCurrentPlan] = useState<string>("free");
    const [freeSlideIndex, setFreeSlideIndex] = useState(0);
    const [isFreeCardHovered, setIsFreeCardHovered] = useState(false);
    const [freeSlideCycleKey, setFreeSlideCycleKey] = useState(0);

    const router = useRouter();
    const [focusPlan, setFocusPlan] = useState<string | null>(null);

    /* ── Cinematic intro scroll (every page visit) ── */
    useEffect(() => {
        const timer = setTimeout(() => {
            const root = document.getElementById("pricing-root");
            const cardsEl = document.getElementById("pricing-cards-grid");
            if (!root || !cardsEl) return;

            const target = cardsEl.offsetTop - 9.5;
            if (target <= 0) return;
            smoothScrollTo(root, target, 1400);
        }, 700);

        return () => clearTimeout(timer);
    }, []);

    /* ── focusPlan scroll ── */
    useEffect(() => {
        if (focusPlan) {
            const timer = setTimeout(() => {
                const root = document.getElementById("pricing-root");
                const element = document.getElementById(`plan-${focusPlan.toLowerCase()}`);
                if (element && root) {
                    const target = element.offsetTop - root.clientHeight / 2 + element.clientHeight / 2;
                    smoothScrollTo(root, target, 900);
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [focusPlan]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await ensureUserDocument(u);
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

        document.documentElement.style.setProperty("scrollbar-width", "none");
        document.body.style.setProperty("scrollbar-width", "none");
        const style = document.createElement("style");
        style.id = "hide-scrollbar-style";
        style.innerHTML = `::-webkit-scrollbar { display: none !important; }`;
        document.head.appendChild(style);

        return () => {
            mounted = false;
            document.documentElement.style.removeProperty("scrollbar-width");
            document.body.style.removeProperty("scrollbar-width");
            const styleElement = document.getElementById("hide-scrollbar-style");
            if (styleElement) styleElement.remove();
        };
    }, []);

    useEffect(() => {
        if (isFreeCardHovered) return;

        const intervalId = window.setInterval(() => {
            setFreeSlideIndex((prev) => (prev + 1) % FREE_FEATURE_SLIDES.length);
        }, 3600);

        return () => window.clearInterval(intervalId);
    }, [freeSlideCycleKey, isFreeCardHovered]);

    const formatPrice = (priceINR: number) => {
        const converted = priceINR * rates[currency];
        if (currency === "INR") return converted.toString();
        return Number(converted.toFixed(1)).toString();
    };

    const activeFreeSlide = FREE_FEATURE_SLIDES[freeSlideIndex];

    const resetFreeSlideTimer = useCallback(() => {
        setFreeSlideCycleKey((current) => current + 1);
    }, []);

    const handleFreeSlideSelect = useCallback(
        (nextIndex: number) => {
            setFreeSlideIndex(nextIndex);
            resetFreeSlideTimer();
        },
        [resetFreeSlideTimer]
    );

    const handleFreeSlideStep = useCallback(
        (direction: "prev" | "next") => {
            setFreeSlideIndex((current) => {
                if (direction === "prev") {
                    return (current - 1 + FREE_FEATURE_SLIDES.length) % FREE_FEATURE_SLIDES.length;
                }
                return (current + 1) % FREE_FEATURE_SLIDES.length;
            });
            resetFreeSlideTimer();
        },
        [resetFreeSlideTimer]
    );

    const handleUpgrade = (tierPlanId: string) => {
        router.push(`/login?plan=${tierPlanId}`);
    };

    const cardBase = "relative flex h-full flex-col rounded-2xl border bg-white p-8 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.22)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_26px_56px_-30px_rgba(15,23,42,0.3)]";
    const priceValueBase = "text-[52px] leading-none font-extrabold tracking-[-0.06em] text-slate-900";
    const featureItemBase = "flex items-start gap-3.5";
    const ctaBase = "mt-0 h-11 w-full rounded-xl text-[15px] font-semibold transition-all duration-200 ease-out active:scale-[0.99]";

    return (
        <div id="pricing-root" className="h-[100dvh] bg-slate-50 flex flex-col relative overflow-x-hidden overflow-y-auto">
            <Suspense fallback={null}>
                <SearchParamsReader onPlan={setFocusPlan} />
            </Suspense>
            <TopNavbar />

            <main className="flex-1 py-16 px-6 lg:px-8 flex flex-col items-center z-10">
                <div className="text-center max-w-3xl mb-12">
                    <h1 className="mb-4 text-[42px] font-extrabold tracking-[-0.055em] text-slate-900 sm:text-[56px]">
                        Simple, transparent pricing
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-600">
                        Choose the perfect plan for your link management needs. No hidden fees.
                    </p>
                </div>

                {/* ↓ id added for intro scroll targeting */}
                <motion.div
                    id="pricing-cards-grid"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-7xl w-full grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 group/cards"
                >
                    {/* Free Plan Card */}
                    <motion.div
                        id="plan-free"
                        variants={cardVariants}
                        onMouseEnter={() => setIsFreeCardHovered(true)}
                        onMouseLeave={() => setIsFreeCardHovered(false)}
                        className={cn(
                            cardBase,
                            "p-7 lg:p-6",
                            "group-hover/cards:[&:not(:hover)]:opacity-95",
                            focusPlan === "free"
                                ? "border-amber-400 ring-2 ring-amber-400/45 shadow-[0_24px_56px_-32px_rgba(251,191,36,0.38)]"
                                : "border-slate-200 hover:border-slate-300"
                        )}
                    >
                        <div className="mb-6">
                            <h3 className="mb-1.5 text-[30px] font-bold tracking-[-0.04em] text-slate-900">Free</h3>
                            <p className="text-[13px] leading-5 text-slate-500">Quick testing</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-[50px] font-extrabold leading-none tracking-[-0.065em] text-slate-900">Free</span>
                        </div>

                        <div className="flex-1">
                            <div className="flex h-full min-h-[252px] flex-col rounded-xl border border-slate-200/80 bg-slate-50/65 px-3.5 py-3.5">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">
                                            {activeFreeSlide.title}
                                        </h4>
                                        <p className="mt-1 text-[13px] leading-5 text-slate-500">
                                            {activeFreeSlide.description}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                                        {freeSlideIndex + 1}/{FREE_FEATURE_SLIDES.length}
                                    </span>
                                </div>

                                <div className="relative min-h-[168px] flex-1 overflow-hidden">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={activeFreeSlide.id}
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            transition={{ duration: 0.26, ease: "easeOut" }}
                                            className="absolute inset-0"
                                        >
                                            <ul className="space-y-3">
                                                {activeFreeSlide.features.map((feature, i) => (
                                                    <li key={i} className="flex items-start gap-3">
                                                        <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-500" />
                                                        <span className={i === 0 ? "text-[14px] font-semibold leading-5 text-slate-900" : "text-[14px] leading-5 text-slate-600"}>
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
                                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                                        {isFreeCardHovered ? "Paused" : "Auto sliding"}
                                    </span>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            aria-label="Show previous slide"
                                            onClick={() => handleFreeSlideStep("prev")}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>

                                        {FREE_FEATURE_SLIDES.map((slide, index) => (
                                            <button
                                                key={slide.id}
                                                type="button"
                                                aria-label={`Show ${slide.title}`}
                                                aria-pressed={freeSlideIndex === index}
                                                onClick={() => handleFreeSlideSelect(index)}
                                                className={cn(
                                                    "h-2.5 rounded-full transition-all duration-200",
                                                    freeSlideIndex === index
                                                        ? "w-6 bg-slate-900"
                                                        : "w-2.5 bg-slate-300 hover:bg-slate-400"
                                                )}
                                            />
                                        ))}

                                        <button
                                            type="button"
                                            aria-label="Show next slide"
                                            onClick={() => handleFreeSlideStep("next")}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 px-1">
                            <div className="flex items-start gap-3">
                                <Lock className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-300" />
                                <span className="text-[14px] leading-5 text-slate-400">Analytics Dashboard</span>
                            </div>
                        </div>

                        <div className="mt-8 border-t border-slate-100 pt-6">
                            <Button
                                className={cn(
                                    ctaBase,
                                    currentPlan === "free" && user
                                        ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500 shadow-none disabled:opacity-100"
                                        : "bg-slate-900 text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.48)] hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_20px_36px_-20px_rgba(15,23,42,0.54)]"
                                )}
                                onClick={() => router.push(user ? "/" : "/login?plan=free")}
                                disabled={currentPlan === "free" && user !== null}
                            >
                                {user ? (currentPlan === "free" ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Current Plan</span> : "Go to Dashboard") : "Try Free"}
                            </Button>
                        </div>
                    </motion.div>

                    {/* Paid Plans */}
                    {tiers.map((tier) => {
                        const isFocused = focusPlan === tier.planId;

                        return (
                            <motion.div
                                key={tier.planId}
                                id={`plan-${tier.planId}`}
                                variants={cardVariants}
                                className={cn(
                                    cardBase,
                                    "group-hover/cards:[&:not(:hover)]:opacity-95",
                                    isFocused
                                        ? "border-amber-400 ring-2 ring-amber-400/45 shadow-[0_24px_56px_-32px_rgba(251,191,36,0.38)]"
                                        : tier.isPopular
                                            ? "border-primary/40 bg-slate-50/50 ring-1 ring-primary/12 shadow-[0_22px_52px_-30px_rgba(15,23,42,0.34)] hover:border-primary/55 hover:shadow-[0_30px_64px_-28px_rgba(15,23,42,0.38)]"
                                            : "border-slate-200 hover:border-slate-300"
                                )}
                            >
                                {tier.isPopular && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                                        className="absolute -top-3.5 left-0 right-0 flex justify-center"
                                    >
                                        <span className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-[0_14px_28px_-20px_rgba(15,23,42,0.55)]">
                                            Most Popular
                                        </span>
                                    </motion.div>
                                )}

                                <div className="mb-7">
                                    <h3 className="mb-2 flex items-center gap-2 text-[32px] font-bold tracking-[-0.04em] text-slate-900">
                                        {tier.name}
                                        {tier.comparisonHint && (
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                                                {tier.comparisonHint}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="min-h-[48px] text-sm leading-6 text-slate-500">{tier.description}</p>
                                </div>

                               <div className="mb-8 flex items-center gap-3">
                                    <div className="flex items-end gap-1.5 text-slate-900">
                                        <span className="pb-1 text-[26px] font-bold tracking-[-0.04em]">{currencySymbols[currency]}</span>
                                        <motion.span
                                            key={currency}
                                            initial={{ opacity: 0, filter: "blur(4px)" }}
                                            animate={{ opacity: 1, filter: "blur(0px)" }}
                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                            className={priceValueBase}
                                        >
                                            {formatPrice(tier.priceINR)}
                                        </motion.span>
                                        <span className="pb-1.5 text-sm font-semibold text-slate-400">/mo</span>
                                    </div>
                                    <div className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                        {(["INR", "USD", "EUR"] as Currency[]).map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setCurrency(c)}
                                                aria-pressed={currency === c}
                                                className={cn(
                                                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
                                                    currency === c
                                                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                                        : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <ul className="space-y-4">
                                        <li className={featureItemBase}>
                                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />
                                            <span className="text-[15px] font-semibold leading-6 text-slate-900">{tier.links}</span>
                                        </li>
                                        <li className={featureItemBase}>
                                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />
                                            <span className="text-[15px] leading-6 text-slate-600">{tier.expiry}</span>
                                        </li>
                                        {tier.features?.map((feature, i) => (
                                            <li key={i} className={featureItemBase}>
                                                <Check className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                                                <span className="text-[15px] leading-6 text-slate-500">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-8 border-t border-slate-100 pt-6">
                                    <Button
                                        className={cn(
                                            ctaBase,
                                            tier.planId === currentPlan
                                                ? "border border-primary/20 bg-primary/10 text-primary shadow-none hover:-translate-y-0.5 hover:bg-primary/15"
                                                : tier.isPopular
                                                    ? "bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_hsl(var(--primary)/0.42)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_20px_36px_-18px_hsl(var(--primary)/0.48)]"
                                                    : "border border-slate-200 bg-slate-100 text-slate-900 shadow-none hover:-translate-y-0.5 hover:bg-slate-200"
                                        )}
                                        onClick={() => handleUpgrade(tier.planId)}
                                    >
                                        {tier.planId === currentPlan ? (
                                            <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> Renew / Repurchase</span>
                                        ) : (
                                            tier.ctaText
                                        )}
                                    </Button>
                                </div>
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
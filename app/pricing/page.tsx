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
import Link from "next/link";
import { formatTTLToText } from "@/lib/utils/format-time";

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

const getFreeGuestFeatures = (guestTtlMs?: number) => [
    "1 link",
    `Expires in ${guestTtlMs ? formatTTLToText(guestTtlMs) : "5 minutes"}`,
    "No login required",
    "Once per IP",
];

const getFreeAccountFeatures = (freeTtlMs?: number) => [
    "1 link",
    `Expires in ${freeTtlMs ? formatTTLToText(freeTtlMs) : "10 minutes"}`,
    "Login required",
    "24h cooldown",
    "3 uses max",
];

const getFreeFeatureSlides = (freeTtlMs?: number, guestTtlMs?: number) => [
    {
        id: "guest",
        title: "Guest Access",
        description: "One quick short link without creating an account.",
        features: getFreeGuestFeatures(guestTtlMs),
    },
    {
        id: "account",
        title: "Free Account Access",
        description: "Sign in for a slightly longer expiry with simple usage limits.",
        features: getFreeAccountFeatures(freeTtlMs),
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
    originalPriceINR?: number;
}

const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
    starter: { description: "Personal use", features: ["Login required", "Custom aliases", "Analytics Dashboard"], ctaText: "Start" },
    pro: { description: "For power users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Priority support"], ctaText: "Go Pro" },
    business: { description: "Best value for heavy users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "4× more links than Pro"], ctaText: "Get Business", comparisonHint: "Most Popular" },
    enterprise: { description: "Advanced link management", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Custom domains integration"], ctaText: "Go Enterprise" },
    bigenterprise: { description: "Maximum scale", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Dedicated account manager"], ctaText: "Go Big" },
};

function formatTtl(ttlMs: number): string {
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${formatTTLToText(ttlMs)}`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}

const generateTiers = (computedPlans?: any, bestOffer?: any): PricingTier[] => {
    return PAID_PLAN_ORDER.map((planId: PlanType) => {
        const cfg = computedPlans?.[planId] || PLAN_CONFIGS[planId];
        const defaultCfg = PLAN_CONFIGS[planId];
        const ui = PLAN_UI_META[planId] || { description: "", features: [], ctaText: defaultCfg.label };
        const activePrice = cfg.priceINR;

        let discountedPrice = activePrice;
        if (bestOffer) {
            if (bestOffer.type === "percentage") {
                discountedPrice = Math.max(0, activePrice * (1 - bestOffer.value / 100));
            } else if (bestOffer.type === "flat") {
                discountedPrice = Math.max(0, activePrice - bestOffer.value);
            }
        }

        return {
            name: defaultCfg.label,
            planId,
            description: ui.description,
            priceINR: discountedPrice,
            originalPriceINR: activePrice !== discountedPrice ? activePrice : undefined,
            links: `${cfg.limit} links`,
            expiry: formatTtl(cfg.ttlMs),
            isPopular: defaultCfg.badge === "MOST_POPULAR",
            features: ui.features,
            ctaText: ui.ctaText,
            comparisonHint: ui.comparisonHint,
        };
    });
};

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
        },
    },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 18,
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
    const [dynamicTiers, setDynamicTiers] = useState<PricingTier[]>(generateTiers());
    const [freeTtlMs, setFreeTtlMs] = useState<number | undefined>(undefined);
    const [guestTtlMs, setGuestTtlMs] = useState<number | undefined>(undefined);
    const [activeOffer, setActiveOffer] = useState<any>(null);
    const [isTourRunning, setIsTourRunning] = useState(false);

    const router = useRouter();
    const [focusPlan, setFocusPlan] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetch("/api/config/public")
            .then(res => res.json())
            .then(data => {
                if (!mounted || !data.config) return;
                const config = data.config;
                const now = Date.now();
                const validOffers = (config.offers || []).filter((o: any) => o.isActive && (!o.expiresAt || o.expiresAt > now));
                let best = null;
                const proxyPrice = data.computedPlans?.business?.priceINR ?? PLAN_CONFIGS.business.priceINR;
                let maxD = 0;
                for (const o of validOffers) {
                    const d = o.type === "percentage" ? proxyPrice * (o.value/100) : o.value;
                    if (d > maxD) { maxD = d; best = o; }
                }
                setActiveOffer(best);
                setFreeTtlMs(data.computedPlans?.free?.ttlMs);
                setGuestTtlMs(data.computedPlans?.guest?.ttlMs);
                setDynamicTiers(generateTiers(data.computedPlans, best));
            })
            .catch(console.error);
        return () => { mounted = false; };
    }, []);

    /* ── Automated Guided Tour ── */
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Mobile Safe Guard
        if (window.innerWidth <= 768) {
            // Basic scroll intro for mobile
            const timer = setTimeout(() => {
                const root = document.getElementById("pricing-root");
                const cardsEl = document.getElementById("pricing-cards-grid");
                if (root && cardsEl) {
                    const target = cardsEl.offsetTop - 9.5;
                    if (target > 0) smoothScrollTo(root, target, 1400);
                }
            }, 700);
            return () => clearTimeout(timer);
        }

        let tourAborted = false;
        
        const abortTour = () => {
            if (tourAborted) return;
            tourAborted = true;
            setIsTourRunning(false);
        };

        const handleInteraction = () => {
            abortTour();
        };

        window.addEventListener("wheel", handleInteraction, { passive: true });
        window.addEventListener("touchmove", handleInteraction, { passive: true });
        window.addEventListener("keydown", handleInteraction, { passive: true });

        const runSequence = async () => {
            if (tourAborted) return;
            const root = document.getElementById("pricing-root");
            const cardsEl = document.getElementById("pricing-cards-grid");
            if (!root || !cardsEl) return;

            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            setIsTourRunning(true);

            // 1. Scroll to Top Row
            const targetRow1 = cardsEl.offsetTop - 30;
            smoothScrollTo(root, targetRow1, 1000);
            await sleep(1800);
            if (tourAborted) return;

            // 2. Scroll to Bottom Row
            const entCard = document.getElementById("plan-business") || document.getElementById("plan-enterprise");
            if (entCard) {
                const targetRow2 = entCard.offsetTop - 30;
                smoothScrollTo(root, targetRow2, 1000);
                await sleep(1800);
            }
            if (tourAborted) return;

            // 3. Scroll to Feature Comparison
            const featureComp = document.getElementById("feature-comparison");
            if (featureComp) {
                const targetRow3 = featureComp.offsetTop - 30;
                smoothScrollTo(root, targetRow3, 1000);
                await sleep(1800);
            }
            if (tourAborted) return;

            // 4. Scroll back to top
            smoothScrollTo(root, 0, 1400);
            await sleep(1400);

            abortTour();
        };

        const handleManualReplay = () => {
            tourAborted = false;
            runSequence();
        };

        window.addEventListener("replay-pricing-tour", handleManualReplay);

        // Auto-play on first load
        const hasShownTour = sessionStorage.getItem('pricingTourShown');
        if (!hasShownTour) {
            sessionStorage.setItem('pricingTourShown', 'true');
            setTimeout(runSequence, 1000);
        }

        return () => {
            tourAborted = true;
            window.removeEventListener("wheel", handleInteraction);
            window.removeEventListener("touchmove", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
            window.removeEventListener("replay-pricing-tour", handleManualReplay);
        };
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

        const slides = getFreeFeatureSlides(freeTtlMs, guestTtlMs);
        const intervalId = window.setInterval(() => {
            setFreeSlideIndex((prev) => (prev + 1) % slides.length);
        }, 3600);

        return () => window.clearInterval(intervalId);
    }, [freeSlideCycleKey, isFreeCardHovered, freeTtlMs]);

    const formatPrice = (priceINR: number) => {
        const converted = priceINR * rates[currency];
        if (Number.isInteger(converted)) {
            return converted.toString();
        }
        return converted.toFixed(2);
    };

    const slides = getFreeFeatureSlides(freeTtlMs, guestTtlMs);
    const activeSlide = slides[freeSlideIndex];

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
                    return (current - 1 + slides.length) % slides.length;
                }
                return (current + 1) % slides.length;
            });
            resetFreeSlideTimer();
        },
        [resetFreeSlideTimer, slides.length]
    );

    const handleUpgrade = (tierPlanId: string) => {
        router.push(`/login?plan=${tierPlanId}`);
    };

    const cardBase = "relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.22)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_26px_56px_-30px_rgba(15,23,42,0.3)]";
    const priceValueBase = "text-[42px] leading-none font-extrabold tracking-[-0.06em] text-slate-900 pr-1 -mr-1";
    const featureItemBase = "flex items-start gap-3.5";
    const ctaBase = "mt-0 h-10 w-full rounded-xl text-[14px] font-semibold transition-all duration-200 ease-out active:scale-[0.99]";

    return (
        <div id="pricing-root" className="h-[100dvh] bg-slate-50 flex flex-col relative overflow-x-hidden overflow-y-auto">
            {/* Background glow effects */}
            <div className="absolute top-[-5%] right-[-10%] w-[60%] h-[40%] bg-fuchsia-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[30%] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />

            {/* Automated Tour Indicator */}
            <AnimatePresence>
                {isTourRunning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
                    >
                        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-slate-900/90 px-6 py-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl border border-slate-700/60 ring-1 ring-white/10">
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                                </div>
                                <span className="text-base font-bold tracking-tight text-white drop-shadow-md">Showing you our plans</span>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">Scroll to take control</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Suspense fallback={null}>
                <SearchParamsReader onPlan={setFocusPlan} />
            </Suspense>
            <TopNavbar />

            <main className="flex-1 py-10 px-6 lg:px-8 flex flex-col items-center z-10">
                <div className="text-center max-w-3xl mb-8 relative z-10">
                    <h1 className="mb-3 text-[36px] font-extrabold tracking-[-0.055em] sm:text-[46px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent pb-2">
                        Simple, transparent pricing
                    </h1>
                    <p className="mx-auto max-w-2xl text-base leading-7 text-slate-600">
                        Choose the perfect plan for your link management needs. No hidden fees.
                    </p>
                </div>

                <motion.div
                    id="pricing-cards-grid"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-7xl w-full grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 group/cards"
                >
                    <motion.div
                        id="plan-free"
                        variants={cardVariants}
                        onMouseEnter={() => {
                            setIsFreeCardHovered(true);
                            if (isTourRunning) setIsTourRunning(false);
                        }}
                        onMouseLeave={() => setIsFreeCardHovered(false)}
                        className={cn(
                            cardBase,
                            "p-7 lg:p-6",
                            "group-hover/cards:[&:not(:hover)]:opacity-95 transition-all duration-300",
                            focusPlan === "free"
                                ? "border-amber-400 ring-2 ring-amber-400/45 shadow-[0_24px_56px_-32px_rgba(251,191,36,0.38)]"
                                : "border-slate-200 hover:border-slate-300"
                        )}
                    >
                        <div className="mb-4">
                            <h3 className="mb-1 text-[26px] font-bold tracking-[-0.04em] text-slate-900">Free</h3>
                            <p className="text-[12px] leading-4 text-slate-500">Quick testing</p>
                        </div>
                        <div className="mb-5">
                            <span className="text-[42px] font-extrabold leading-none tracking-[-0.065em] text-slate-900">Free</span>
                        </div>

                        <div className="flex-1">
                            <div className="flex h-full min-h-[220px] flex-col rounded-xl border border-slate-200/80 bg-slate-50/65 px-3 py-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">
                                            {activeSlide.title}
                                        </h4>
                                        <p className="mt-1 text-[13px] leading-5 text-slate-500">
                                            {activeSlide.description}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                                        {freeSlideIndex + 1}/{slides.length}
                                    </span>
                                </div>

                                <div className="relative min-h-[168px] flex-1 overflow-hidden">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={activeSlide.id}
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            transition={{ duration: 0.26, ease: "easeOut" }}
                                            className="absolute inset-0"
                                        >
                                            <ul className="space-y-3">
                                                {activeSlide.features.map((feature, i) => (
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

                                        {slides.map((slide, index) => (
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

                        <div className="mt-2 px-1">
                            <div className="flex items-start gap-3">
                                <Lock className="mt-0.5 h-[16px] w-[16px] shrink-0 text-slate-300" />
                                <span className="text-[13px] leading-5 text-slate-400">Analytics Dashboard</span>
                            </div>
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-5">
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
                    {dynamicTiers.map((tier) => {
                        const isFocused = focusPlan === tier.planId;

                        return (
                            <motion.div
                                key={tier.planId}
                                id={`plan-${tier.planId}`}
                                variants={cardVariants}
                                onMouseEnter={() => { if (isTourRunning) setIsTourRunning(false); }}
                                className={cn(
                                    cardBase,
                                    "group-hover/cards:[&:not(:hover)]:opacity-95 transition-all duration-300",
                                    isFocused
                                        ? "border-amber-400 ring-2 ring-amber-400/45 shadow-[0_24px_56px_-32px_rgba(251,191,36,0.38)]"
                                        : tier.isPopular
                                            ? "border-primary/40 bg-slate-50/50 ring-1 ring-primary/12 shadow-[0_22px_52px_-30px_rgba(15,23,42,0.34)] hover:border-primary/55 hover:shadow-[0_30px_64px_-28px_rgba(15,23,42,0.38)]"
                                            : tier.originalPriceINR !== undefined
                                                ? "border-fuchsia-400 bg-white ring-2 ring-fuchsia-300/40 shadow-[0_0_35px_-5px_rgba(217,70,239,0.35)] hover:border-fuchsia-500 hover:shadow-[0_0_40px_-5px_rgba(217,70,239,0.5)]"
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

                                <div className="mb-4">
                                    {activeOffer && tier.originalPriceINR !== undefined && (
                                        <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow-[0_0_15px_-3px_rgba(217,70,239,0.5)] animate-pulse">
                                            🎪 {activeOffer.name} — {activeOffer.type === 'percentage' ? `${activeOffer.value}% OFF` : `₹${activeOffer.value} OFF`}
                                        </div>
                                    )}
                                    <h3 className="mb-1 flex items-center gap-2 text-[26px] font-bold tracking-[-0.04em] text-slate-900">
                                        {tier.name}
                                        {tier.comparisonHint && (
                                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                                                {tier.comparisonHint}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="min-h-[40px] text-[13px] leading-5 text-slate-500">{tier.description}</p>
                                </div>
                                <div className="mb-5 flex flex-col gap-1.5">
                                    {tier.originalPriceINR !== undefined && (
                                        <div className="inline-block">
                                            <span className="text-2xl font-bold text-slate-400 line-through decoration-rose-500/80 decoration-[3px]">
                                                {currencySymbols[currency]}{formatPrice(tier.originalPriceINR)}
                                            </span>
                                            <span className="ml-1 text-lg font-semibold text-slate-400 line-through decoration-rose-500/80 decoration-[3px]">/mo</span>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex flex-wrap items-end gap-1.5 text-slate-900">
                                            <span className="pb-1 text-[26px] font-bold tracking-[-0.04em]">{currencySymbols[currency]}</span>
                                            <motion.span
                                                key={currency + tier.priceINR}
                                                initial={{ opacity: 0, filter: "blur(4px)" }}
                                                animate={{ opacity: 1, filter: "blur(0px)" }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className={cn(
                                                    priceValueBase,
                                                    tier.originalPriceINR !== undefined ? "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent drop-shadow-sm" : ""
                                                )}
                                            >
                                                {formatPrice(tier.priceINR)}
                                            </motion.span>
                                            <span className="pb-1.5 text-sm font-semibold text-slate-400">/mo</span>
                                        </div>
                                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                            {(["INR", "USD", "EUR"] as Currency[]).map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setCurrency(c)}
                                                    className={cn(
                                                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                                                        currency === c
                                                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                                            : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                                                    )}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <ul className="space-y-3">
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

                                <div className="mt-5 border-t border-slate-100 pt-5">
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

                <div id="feature-comparison" className="mt-12 w-full max-w-7xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900">Feature comparison</h2>
                            <p className="mt-1 text-sm text-slate-500">Quick plan-by-plan visibility for developer access.</p>
                        </div>
                        <Link href="/documentation/api" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline">
                            Open API documentation
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="border-b border-slate-200 text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Feature</th>
                                    <th className="px-4 py-3 font-medium">Free</th>
                                    <th className="px-4 py-3 font-medium">Starter</th>
                                    <th className="px-4 py-3 font-medium">Pro</th>
                                    <th className="px-4 py-3 font-medium">Business</th>
                                    <th className="px-4 py-3 font-medium">Enterprise</th>
                                    <th className="px-4 py-3 font-medium">Big Enterprise</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                <tr>
                                    <td className="px-4 py-4 font-semibold text-slate-900">
                                        <Link href="/documentation/api" className="underline decoration-slate-300 underline-offset-4 hover:text-slate-700">
                                            API Access
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4 text-slate-400">No</td>
                                    <td className="px-4 py-4 text-slate-400">No</td>
                                    <td className="px-4 py-4 text-slate-400">No</td>
                                    <td className="px-4 py-4 font-semibold text-emerald-600">Yes</td>
                                    <td className="px-4 py-4 font-semibold text-emerald-600">Yes</td>
                                    <td className="px-4 py-4 font-semibold text-emerald-600">Yes</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4 font-semibold text-slate-900">Included API quota</td>
                                    <td className="px-4 py-4 text-slate-400">-</td>
                                    <td className="px-4 py-4 text-slate-400">-</td>
                                    <td className="px-4 py-4 text-slate-400">-</td>
                                    <td className="px-4 py-4 text-slate-700">500 requests</td>
                                    <td className="px-4 py-4 text-slate-700">5000 requests</td>
                                    <td className="px-4 py-4 text-slate-700">5000 requests</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-16 mb-8 flex items-center justify-center gap-2 text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Secure checkout powered by Razorpay</span>
                </div>
            </main>
        </div>
    );
}

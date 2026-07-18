"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
// Framer motion not needed because we are using native CSS snap scrolling
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { Check, ChevronLeft, ShieldCheck, Zap } from "lucide-react";
import { PLAN_CONFIGS, PAID_PLAN_ORDER, PlanType } from "@/lib/plans";

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

const FREE_FEATURES = [
    "1 link for Guests",
    "Expires in 5 minutes (Guest)",
    "Login for 10-minute expiry",
    "Analytics Dashboard"
];

const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
    starter: { description: "Personal use", features: ["Login required", "Custom aliases", "Analytics Dashboard"], ctaText: "Start" },
    pro: { description: "For power users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Priority support"], ctaText: "Go Pro" },
    business: { description: "Best value for heavy users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "4× more links than Pro"], ctaText: "Get Business", comparisonHint: "Most Popular" },
    enterprise: { description: "Advanced link management", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Custom domains integration"], ctaText: "Go Enterprise" },
    bigenterprise: { description: "Maximum scale", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Dedicated account manager"], ctaText: "Go Big" },
};

function formatTtl(ttlMs: number): string {
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${Math.round(ttlMs / (60 * 1000))} minutes`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}

const tiers = PAID_PLAN_ORDER.map((planId: PlanType) => {
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


/* ── Cinematic scroll helper ── */
function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cinematicScroll(el: HTMLElement, targetValue: number, duration: number, isHorizontal: boolean) {
    const startValue = isHorizontal ? el.scrollLeft : el.scrollTop;
    const distance = targetValue - startValue;
    let startTime: number | null = null;

    function step(timestamp: number) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        if (isHorizontal) {
            el.scrollLeft = startValue + distance * eased;
        } else {
            el.scrollTop = startValue + distance * eased;
        }
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

export default function MobilePlanClient() {
    const [currency, setCurrency] = useState<Currency>("INR");
    const [rates, setRates] = useState<Record<Currency, number>>(defaultExchangeRates);
    const [user, setUser] = useState<User | null>(null);
    const [currentPlan, setCurrentPlan] = useState<string>("free");
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusPlan = searchParams.get("plan");
    const scrollRef = useRef<HTMLDivElement>(null);
    const horizontalScrollRef = useRef<HTMLDivElement>(null);

    /* ── Cinematic intro scroll and swipe hint (every page visit) ── */
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!scrollRef.current || !horizontalScrollRef.current) return;
            
            if (horizontalScrollRef.current) {
                // Scroll down so the cards and currency selector are fully in view
                cinematicScroll(scrollRef.current, horizontalScrollRef.current.offsetTop - 80, 1200, false);
            }

            setTimeout(() => {
                if (!horizontalScrollRef.current) return;
                
                const originalClasses = horizontalScrollRef.current.className;
                horizontalScrollRef.current.classList.remove('snap-mandatory');
                horizontalScrollRef.current.classList.remove('snap-x');
                
                cinematicScroll(horizontalScrollRef.current, 80, 800, true);
                
                setTimeout(() => {
                    if (!horizontalScrollRef.current) return;
                    cinematicScroll(horizontalScrollRef.current, 0, 800, true);
                    
                    setTimeout(() => {
                        if (horizontalScrollRef.current) {
                            horizontalScrollRef.current.className = originalClasses;
                        }
                    }, 850);
                }, 1000);
            }, 800);
        }, 700);

        return () => clearTimeout(timer);
    }, []);


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
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (focusPlan) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`plan-${focusPlan.toLowerCase()}`);
                if (element && scrollRef.current) {
                    const target = element.offsetLeft - scrollRef.current.clientWidth / 2 + element.clientWidth / 2;
                    scrollRef.current.scrollTo({ left: target, behavior: "smooth" });
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [focusPlan]);

    const formatPrice = (priceINR: number) => {
        const converted = priceINR * rates[currency];
        if (currency === "INR") return converted.toString();
        return Number(converted.toFixed(1)).toString();
    };

    const handleUpgrade = (tierPlanId: string) => {
        router.push(`/login?plan=${tierPlanId}`);
    };

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[30%] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-5%] left-[-10%] w-[50%] h-[30%] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <TopNavbar />

            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                <div className="px-6 pt-8 pb-4 text-center">
                    <h2 id="mobile-pricing-title" className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
                        Transparent Pricing
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Unlock premium features tailored for mobile power users.
                    </p>

                    <div className="mt-6 mx-auto inline-flex items-center gap-1 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-md border border-white/20">
                        {(["INR", "USD", "EUR"] as Currency[]).map((c) => (
                            <button
                                key={c}
                                onClick={() => setCurrency(c)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200",
                                    currency === c 
                                        ? "bg-white dark:bg-slate-900 text-foreground shadow-sm" 
                                        : "text-muted-foreground"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <div ref={horizontalScrollRef} className="flex overflow-x-auto snap-x snap-mandatory px-6 pb-12 pt-4 gap-4 hide-scrollbar">
                    {/* Free Plan */}
                    <div id="plan-free" className="snap-center shrink-0 w-[85vw] max-w-[320px] rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/20 p-6 shadow-xl flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-300" />
                        <h3 className="text-2xl font-bold mb-1">Free</h3>
                        <p className="text-xs text-muted-foreground mb-4">Great for quick testing.</p>
                        <div className="mb-6 flex items-baseline">
                            <span className="text-4xl font-extrabold tracking-tight">Free</span>
                        </div>
                        <ul className="space-y-3 mb-6 flex-1">
                            {FREE_FEATURES.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />
                                    <span className="text-sm font-medium text-muted-foreground">{feat}</span>
                                </li>
                            ))}
                        </ul>
                        <Button 
                            className={cn(
                                "w-full rounded-xl py-6 font-semibold transition-all",
                                currentPlan === "free" && user 
                                    ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed" 
                                    : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg hover:opacity-90"
                            )}
                            onClick={() => { triggerHaptic(40); router.push(user ? "/mobile" : "/login?plan=free"); }}
                            disabled={currentPlan === "free" && user !== null}
                        >
                            {user ? (currentPlan === "free" ? "Current Plan" : "Try Free") : "Try Free"}
                        </Button>
                    </div>

                    {/* Paid Plans */}
                    {tiers.map(tier => {
                        const isFocused = focusPlan === tier.planId;
                        return (
                            <div key={tier.planId} id={`plan-${tier.planId}`} className={cn(
                                "snap-center shrink-0 w-[85vw] max-w-[320px] rounded-3xl backdrop-blur-2xl border p-6 shadow-xl flex flex-col relative overflow-hidden transition-all duration-300",
                                tier.isPopular 
                                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                                    : "bg-white/70 dark:bg-slate-900/70 border-white/20",
                                isFocused && "ring-2 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.3)]"
                            )}>
                                {tier.isPopular && (
                                    <div className="absolute top-0 left-0 w-full bg-primary py-1 text-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                                            Most Popular
                                        </span>
                                    </div>
                                )}
                                {!tier.isPopular && <div className="absolute top-0 left-0 w-full h-1 bg-slate-300" />}

                                <div className={cn("mb-4", tier.isPopular ? "mt-4" : "")}>
                                    <h3 className="text-2xl font-bold mb-1">{tier.name}</h3>
                                    <p className="text-xs text-muted-foreground min-h-[32px]">{tier.description}</p>
                                </div>
                                <div className="mb-6 flex items-baseline gap-1">
                                    <span className="text-xl font-bold">{currencySymbols[currency]}</span>
                                    <span className="text-5xl font-extrabold tracking-tight">{formatPrice(tier.priceINR)}</span>
                                    <span className="text-sm font-semibold text-muted-foreground ml-1">/mo</span>
                                </div>
                                <ul className="space-y-3 mb-6 flex-1">
                                    <li className="flex items-start gap-3">
                                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-foreground" />
                                        <span className="text-sm font-bold">{tier.links}</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-foreground" />
                                        <span className="text-sm font-medium">{tier.expiry}</span>
                                    </li>
                                    {tier.features?.map((feat, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />
                                            <span className="text-sm font-medium text-muted-foreground">{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button 
                                    className={cn(
                                        "w-full rounded-xl py-6 font-semibold transition-all shadow-xl",
                                        tier.planId === currentPlan 
                                            ? "bg-primary/20 text-primary border border-primary/30" 
                                            : tier.isPopular 
                                                ? "bg-primary text-primary-foreground hover:opacity-90" 
                                                : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
                                    )}
                                    onClick={() => { triggerHaptic(40); handleUpgrade(tier.planId); }}
                                >
                                    {tier.planId === currentPlan ? (
                                        <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Renew</span>
                                    ) : tier.ctaText}
                                </Button>
                            </div>
                        )
                    })}
                </div>

                <div className="pb-12 pt-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ShieldCheck className="w-5 h-5 opacity-70" />
                    <span className="text-xs font-medium">Secure checkout powered by Razorpay</span>
                </div>
            </div>

            <MobileFooter />
            
            <style jsx global>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

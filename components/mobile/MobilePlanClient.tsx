"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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
import { formatTTLToText } from "@/lib/utils/format-time";

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

function formatTtl(ttlMs: number): string {
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${formatTTLToText(ttlMs)}`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}



export default function MobilePlanClient() {
    const [currency, setCurrency] = useState<Currency>("INR");
    const [rates, setRates] = useState<Record<Currency, number>>(defaultExchangeRates);
    const [user, setUser] = useState<User | null>(null);
    const [currentPlan, setCurrentPlan] = useState<string>("free");
    const [isSnapping, setIsSnapping] = useState(true);
    
    const [dynamicTiers, setDynamicTiers] = useState<any[]>([]);
    const [freeTTL, setFreeTTL] = useState("10 minutes");
    const [guestTTL, setGuestTTL] = useState("5 minutes");
    const [activeOffer, setActiveOffer] = useState<any>(null);

    const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
        starter: { description: "Personal use", features: ["Login required", "Custom aliases", "Analytics Dashboard"], ctaText: "Start" },
        pro: { description: "For power users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Priority support"], ctaText: "Go Pro" },
        business: { description: "Best value for heavy users", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "4× more links than Pro"], ctaText: "Get Business", comparisonHint: "Most Popular" },
        enterprise: { description: "Advanced link management", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Custom domains integration"], ctaText: "Go Enterprise" },
        bigenterprise: { description: "Maximum scale", features: ["Login required", "Custom aliases", "Analytics Dashboard", "Developer API access", "Dedicated account manager"], ctaText: "Go Big" },
    };

    useEffect(() => {
        let mounted = true;
        // cache-busting to ensure we always get fresh config like desktop
        fetch(`/api/config/public?_t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (!mounted) return;
                const config = data?.config;
                const computedPlans = data?.computedPlans || PLAN_CONFIGS;
                
                if (computedPlans.free?.ttlMs) setFreeTTL(formatTTLToText(computedPlans.free.ttlMs));
                if (computedPlans.guest?.ttlMs) setGuestTTL(formatTTLToText(computedPlans.guest.ttlMs));

                let best = null;
                if (config?.offers) {
                    const now = Date.now();
                    const validOffers = config.offers.filter((o: any) => o.isActive && (!o.expiresAt || o.expiresAt > now));
                    const proxyPrice = computedPlans.business?.priceINR ?? PLAN_CONFIGS.business.priceINR;
                    let maxD = 0;
                    for (const o of validOffers) {
                        const d = o.type === "percentage" ? proxyPrice * (o.value / 100) : o.value;
                        if (d > maxD) { maxD = d; best = o; }
                    }
                }
                setActiveOffer(best);

                const generatedTiers = PAID_PLAN_ORDER.map((planId: PlanType) => {
                    const cfg = computedPlans[planId] || PLAN_CONFIGS[planId];
                    const ui = PLAN_UI_META[planId] || { description: "", features: [], ctaText: cfg.label };
                    const activePrice = cfg.priceINR;
                    let discountedPrice = activePrice;
                    if (best) {
                        if (best.type === "percentage") {
                            discountedPrice = Math.max(0, activePrice * (1 - best.value / 100));
                        } else if (best.type === "flat") {
                            discountedPrice = Math.max(0, activePrice - best.value);
                        }
                    }
                    return {
                        name: cfg.label,
                        planId,
                        description: ui.description,
                        priceINR: discountedPrice,
                        originalPriceINR: activePrice !== discountedPrice ? activePrice : undefined,
                        links: `${cfg.limit} links`,
                        expiry: formatTtl(cfg.ttlMs),
                        isPopular: cfg.badge === "MOST_POPULAR",
                        features: ui.features,
                        ctaText: ui.ctaText,
                        comparisonHint: ui.comparisonHint,
                    };
                });
                setDynamicTiers(generatedTiers);
            })
            .catch(console.error);
        return () => { mounted = false; };
    }, []);

    const FREE_FEATURES = [
        "1 link for Guests",
        `Expires in ${guestTTL} (Guest)`,
        `Login for ${freeTTL} expiry`,
        "Analytics Dashboard"
    ];
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusPlan = searchParams.get("plan");
    const scrollRef = useRef<HTMLDivElement>(null);
    const horizontalScrollRef = useRef<HTMLDivElement>(null);

    /* ── Native cinematic intro scroll and swipe hint ── */
    useEffect(() => {
        if (dynamicTiers.length === 0) return; // Wait until plans are actually loaded

        let active = true;
        const sequence = async () => {
            if (!scrollRef.current || !horizontalScrollRef.current) return;
            
            // 1. Wait a moment for layout to settle
            await new Promise(r => setTimeout(r, 600));
            if (!active) return;
            
            // 2. Scroll down to focus on cards (scroll up effect so cards are at the top)
            horizontalScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            await new Promise(r => setTimeout(r, 800));
            if (!active) return;
            
            // 3. Disable snapping so the horizontal scroll animation doesn't fight the snap points
            setIsSnapping(false);
            await new Promise(r => setTimeout(r, 100)); // wait for React render
            if (!active || !horizontalScrollRef.current) return;
            
            // 4. Scroll right to show it's swipeable
            horizontalScrollRef.current.scrollTo({ left: 120, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 600));
            if (!active || !horizontalScrollRef.current) return;
            
            // 5. Scroll back left
            horizontalScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 600));
            if (!active) return;
            
            // 6. Re-enable snapping for the user
            setIsSnapping(true);
        };

        sequence();
        return () => { active = false; };
    }, [dynamicTiers.length]);


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
        if (Number.isInteger(converted)) {
            return converted.toString();
        }
        return converted.toFixed(2);
    };

    const handleUpgrade = (tierPlanId: string) => {
        router.push(`/login?plan=${tierPlanId}`);
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-5%] right-[-10%] w-[60%] h-[40%] bg-fuchsia-500/25 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[30%] bg-amber-500/25 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />
            
            <TopNavbar />

            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                <div className="px-6 pt-8 pb-4 text-center relative z-10">
                    <h2 id="mobile-pricing-title" className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent mb-2 pb-1">
                        Transparent Pricing
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Unlock premium features tailored for mobile power users.
                    </p>

                    <div className="mt-6 mx-auto inline-flex items-center gap-1 p-1 bg-white/80 dark:bg-slate-900/80 rounded-2xl backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        {(["INR", "USD", "EUR"] as Currency[]).map((c) => (
                            <button
                                key={c}
                                onClick={() => {
                                    triggerHaptic(20);
                                    setCurrency(c);
                                }}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 active:scale-95",
                                    currency === c 
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md" 
                                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <div 
                    ref={horizontalScrollRef} 
                    className={cn(
                        "flex overflow-x-auto px-6 pb-12 pt-4 gap-4 hide-scrollbar",
                        isSnapping ? "snap-x snap-mandatory" : ""
                    )}
                >
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
                    {dynamicTiers.map(tier => {
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
                                    {activeOffer && tier.originalPriceINR !== undefined && (
                                        <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow-[0_0_15px_-3px_rgba(217,70,239,0.5)] animate-pulse">
                                            🎪 {activeOffer.name} — {activeOffer.type === 'percentage' ? `${activeOffer.value}% OFF` : `₹${activeOffer.value} OFF`}
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold mb-1">{tier.name}</h3>
                                    <p className="text-xs text-muted-foreground min-h-[32px]">{tier.description}</p>
                                </div>
                                <div className="mb-6 flex flex-col gap-1.5">
                                    {tier.originalPriceINR !== undefined && (
                                        <div className="inline-block">
                                            <span className="text-xl font-bold text-slate-400 line-through decoration-rose-500/80 decoration-[3px]">
                                                {currencySymbols[currency]}{formatPrice(tier.originalPriceINR)}
                                            </span>
                                            <span className="ml-1 text-sm font-semibold text-slate-400 line-through decoration-rose-500/80 decoration-[3px]">/mo</span>
                                        </div>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-bold">{currencySymbols[currency]}</span>
                                        <span className={cn(
                                            "text-5xl font-extrabold tracking-tight",
                                            tier.originalPriceINR !== undefined ? "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent" : ""
                                        )}>{formatPrice(tier.priceINR)}</span>
                                        <span className="text-sm font-semibold text-muted-foreground ml-1">/mo</span>
                                    </div>
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
                                    {tier.features?.map((feat: string, idx: number) => (
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
            
            <style dangerouslySetInnerHTML={{ __html: `
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}

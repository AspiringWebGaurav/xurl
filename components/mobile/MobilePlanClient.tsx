"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { 
    Check, 
    ShieldCheck, 
    Zap, 
    Sparkles, 
    Send, 
    CheckCircle2, 
    Loader2, 
    ChevronDown, 
    ChevronUp, 
    Lock,
    SlidersHorizontal,
    ArrowRight,
    Clock,
    XCircle,
    Mail,
    CreditCard
} from "lucide-react";
import { motion } from "framer-motion";
import { PLAN_CONFIGS, PAID_PLAN_ORDER, PlanType } from "@/lib/plans";
import { formatTTLToText } from "@/lib/utils/format-time";
import type { PartialOffer } from "@/services/partial-offers";
import { toast } from "sonner";

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
    if (!ttlMs || ttlMs <= 0) return "Permanent (Never Expires)";
    const hours = ttlMs / (60 * 60 * 1000);
    if (hours < 1) return `Expires in ${formatTTLToText(ttlMs)}`;
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
}

function formatApiQuota(quota?: number): string {
    if (!quota) return "No API Access";
    if (quota >= 1_000_000) return `${(quota / 1_000_000).toLocaleString()}M calls/mo`;
    if (quota >= 1_000) return `${(quota / 1_000).toLocaleString()}K calls/mo`;
    return `${quota} calls (Sandbox)`;
}

const PLAN_UI_META: Record<string, { description: string; features: string[]; ctaText: string; comparisonHint?: string }> = {
    starter: { 
        description: "Personal & side projects", 
        features: ["25 Permanent Links (Banked)", "2,500 API calls/mo", "Custom aliases & QR codes", "Real-time analytics"], 
        ctaText: "Start" 
    },
    pro: { 
        description: "For creators & power users", 
        features: ["100 Permanent Links (Banked)", "15,000 API calls/mo", "Custom aliases & QR codes", "CSV export & UTM tracking", "Priority support"], 
        ctaText: "Go Pro" 
    },
    business: { 
        description: "Best value for scaling businesses", 
        features: ["500 Permanent Links (Banked)", "60,000 API calls/mo", "Full Developer API access", "Advanced UTM & CSV export", "5× more links than Pro"], 
        ctaText: "Get Business", 
        comparisonHint: "Most Popular" 
    },
    enterprise: { 
        description: "High-volume link infrastructure", 
        features: ["2,500 Permanent Links (Banked)", "300,000 API calls/mo", "High-throughput Developer API", "Custom domains integration", "Dedicated support"], 
        ctaText: "Go Enterprise" 
    },
    bigenterprise: { 
        description: "Massive scale & enterprise workloads", 
        features: ["10,000 Permanent Links (Banked)", "1,000,000 API calls/mo", "Enterprise API throughput", "Full data export & SLA", "Dedicated account manager"], 
        ctaText: "Go Big" 
    },
};

export default function MobilePlanClient() {
    const [currency, setCurrency] = useState<Currency>("INR");
    const [rates, setRates] = useState<Record<Currency, number>>(defaultExchangeRates);
    const [user, setUser] = useState<User | null>(null);
    const [currentPlan, setCurrentPlan] = useState<string>("free");
    const [isSnapping, setIsSnapping] = useState(true);
    
    const [dynamicTiers, setDynamicTiers] = useState<any[]>([]);
    const [activeOffer, setActiveOffer] = useState<any>(null);
    const [targetedOffer, setTargetedOffer] = useState<PartialOffer | null>(null);
    const [userCustomRequest, setUserCustomRequest] = useState<any>(null);
    const [showComparison, setShowComparison] = useState(false);

    // Custom Pricing Proposal Presets & State
    const ENTERPRISE_PRESETS = [
        {
            id: "scale",
            name: "Scale-Up",
            badge: "Popular",
            links: 50000,
            apiCalls: 2000000,
            price: 1499,
            description: "50K · 2M API",
        },
        {
            id: "growth",
            name: "Hyper-Growth",
            badge: "🔥 Best",
            links: 200000,
            apiCalls: 10000000,
            price: 3999,
            description: "200K · 10M API",
        },
        {
            id: "enterprise",
            name: "Enterprise",
            badge: "Custom SLA",
            links: 1000000,
            apiCalls: 50000000,
            price: 9999,
            description: "1M · 50M API",
        },
    ];

    const [customEmail, setCustomEmail] = useState("");
    const [customCompany, setCustomCompany] = useState("");
    const [customLinks, setCustomLinks] = useState<number | "">(50000);
    const [customApiCalls, setCustomApiCalls] = useState<number | "">(2000000);
    const [customProposedPrice, setCustomProposedPrice] = useState<number | "">(1499);
    const [customNotes, setCustomNotes] = useState("");
    const [customSubmitting, setCustomSubmitting] = useState(false);
    const [customSubmitted, setCustomSubmitted] = useState(false);
    const [activePreset, setActivePreset] = useState<string | null>("scale");

    const applyPreset = (preset: typeof ENTERPRISE_PRESETS[0]) => {
        triggerHaptic(20);
        setActivePreset(preset.id);
        setCustomLinks(preset.links);
        setCustomApiCalls(preset.apiCalls);
        setCustomProposedPrice(preset.price);
    };

    const numericLinks = typeof customLinks === "number" ? customLinks : parseInt(String(customLinks), 10) || 0;
    const numericApiCalls = typeof customApiCalls === "number" ? customApiCalls : parseInt(String(customApiCalls), 10) || 0;
    const numericPrice = typeof customProposedPrice === "number" ? customProposedPrice : parseInt(String(customProposedPrice), 10) || 0;

    const costPer1k = numericLinks > 0 && numericPrice > 0 ? ((numericPrice / numericLinks) * 1000).toFixed(1) : null;
    const bitlyEstMonthly = numericLinks > 0 ? Math.max(9999, Math.round((numericLinks / 1000) * 150)) : 9999;
    const savingsPercent = numericPrice > 0 && bitlyEstMonthly > numericPrice 
        ? Math.min(95, Math.max(40, Math.round(((bitlyEstMonthly - numericPrice) / bitlyEstMonthly) * 100))) 
        : 80;

    const router = useRouter();
    const searchParams = useSearchParams();
    const focusPlan = searchParams.get("plan");
    const scrollRef = useRef<HTMLDivElement>(null);
    const horizontalScrollRef = useRef<HTMLDivElement>(null);
    const customPricingRef = useRef<HTMLDivElement>(null);

    // Set initial custom email when user logs in
    useEffect(() => {
        if (user?.email && !customEmail) {
            setCustomEmail(user.email);
        }
    }, [user, customEmail]);

    useEffect(() => {
        let mounted = true;
        // Cache-busting to ensure fresh plan config
        fetch(`/api/config/public?_t=${Date.now()}`, { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                if (!mounted) return;
                const config = data?.config;
                const computedPlans = data?.computedPlans || PLAN_CONFIGS;

                let best: { name?: string; type?: string; value?: number } | null = null;
                if (config?.offers) {
                    const now = Date.now();
                    const validOffers = (config.offers as Array<{ name?: string; isActive?: boolean; expiresAt?: number | null; type?: string; value?: number }>).filter(
                        (o) => o.isActive && (!o.expiresAt || o.expiresAt > now)
                    );
                    const proxyPrice = computedPlans.business?.priceINR ?? PLAN_CONFIGS.business.priceINR;
                    let maxD = 0;
                    for (const o of validOffers) {
                        const val = o.value || 0;
                        const d = o.type === "percentage" ? proxyPrice * (val / 100) : val;
                        if (d > maxD) {
                            maxD = d;
                            best = o;
                        }
                    }
                }
                setActiveOffer(best);

                const generatedTiers = PAID_PLAN_ORDER.map((planId: PlanType) => {
                    const cfg = computedPlans[planId] || PLAN_CONFIGS[planId];
                    const ui = PLAN_UI_META[planId] || { description: "", features: [], ctaText: cfg.label };
                    const activePrice = cfg.priceINR;
                    let discountedPrice = activePrice;
                    if (best) {
                        const val = best.value || 0;
                        if (best.type === "percentage") {
                            discountedPrice = Math.max(0, activePrice * (1 - val / 100));
                        } else if (best.type === "flat") {
                            discountedPrice = Math.max(0, activePrice - val);
                        }
                    }
                    return {
                        name: cfg.label,
                        planId,
                        description: ui.description,
                        priceINR: discountedPrice,
                        originalPriceINR: activePrice !== discountedPrice ? activePrice : undefined,
                        links: `${cfg.limit.toLocaleString()} permanent links`,
                        expiry: formatTtl(cfg.ttlMs),
                        apiQuotaTotal: cfg.apiQuotaTotal || 0,
                        apiQuotaFormatted: formatApiQuota(cfg.apiQuotaTotal),
                        isPopular: cfg.badge === "MOST_POPULAR",
                        features: ui.features,
                        ctaText: ui.ctaText,
                        comparisonHint: ui.comparisonHint,
                    };
                });
                setDynamicTiers(generatedTiers);
            })
            .catch(console.error);
        return () => {
            mounted = false;
        };
    }, []);

    const FREE_FEATURES = [
        "5 Permanent Links (Banked)",
        "50 Sandbox API calls",
        "Custom aliases & QR codes",
        "7-Day Analytics Dashboard",
        "1 Guest Link (Instant edge)",
    ];

    /* ── Native cinematic swipe hint ── */
    useEffect(() => {
        if (dynamicTiers.length === 0) return;

        let active = true;
        const sequence = async () => {
            if (!scrollRef.current || !horizontalScrollRef.current) return;
            await new Promise((r) => setTimeout(r, 600));
            if (!active) return;

            horizontalScrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            await new Promise((r) => setTimeout(r, 800));
            if (!active) return;

            setIsSnapping(false);
            await new Promise((r) => setTimeout(r, 100));
            if (!active || !horizontalScrollRef.current) return;

            horizontalScrollRef.current.scrollTo({ left: 120, behavior: "smooth" });
            await new Promise((r) => setTimeout(r, 600));
            if (!active || !horizontalScrollRef.current) return;

            horizontalScrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
            await new Promise((r) => setTimeout(r, 600));
            if (!active) return;

            setIsSnapping(true);
        };

        sequence();
        return () => {
            active = false;
        };
    }, [dynamicTiers.length]);

    const fetchUserState = useCallback(async (u: User) => {
        try {
            const token = await u.getIdToken(true);
            const [resLinks, resOffers, resCustom] = await Promise.all([
                fetch("/api/links?pageSize=1", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/user/partial-offers", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/custom-pricing-request", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
            ]);
            const dataLinks = await resLinks.json();
            if (dataLinks.plan) {
                setCurrentPlan(dataLinks.plan);
            }
            const dataOffers = await resOffers.json();
            if (resOffers.ok && Array.isArray(dataOffers.offers) && dataOffers.offers.length > 0) {
                setTargetedOffer(dataOffers.offers[0]);
            } else {
                setTargetedOffer(null);
            }
            if (resCustom && resCustom.ok) {
                const dataCustom = await resCustom.json();
                if (Array.isArray(dataCustom.requests) && dataCustom.requests.length > 0) {
                    setUserCustomRequest(dataCustom.requests[0]);
                } else {
                    setUserCustomRequest(null);
                }
            }
        } catch (err) {
            console.error("Failed to fetch user state", err);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                await ensureUserDocument(u);
                fetchUserState(u);
            } else {
                setCurrentPlan("free");
                setTargetedOffer(null);
            }
        });
        return () => unsubscribe();
    }, [fetchUserState]);

    useEffect(() => {
        const handleProfileUpdated = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.plan) {
                setCurrentPlan(customEvent.detail.plan);
            }
            if (auth.currentUser) {
                fetchUserState(auth.currentUser);
            }
        };

        window.addEventListener("userProfileUpdated", handleProfileUpdated);
        window.addEventListener("linkGenerated", handleProfileUpdated);
        return () => {
            window.removeEventListener("userProfileUpdated", handleProfileUpdated);
            window.removeEventListener("linkGenerated", handleProfileUpdated);
        };
    }, [fetchUserState]);

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

    useEffect(() => {
        if (focusPlan) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`plan-${focusPlan.toLowerCase()}`);
                if (element && horizontalScrollRef.current) {
                    const target = element.offsetLeft - horizontalScrollRef.current.clientWidth / 2 + element.clientWidth / 2;
                    horizontalScrollRef.current.scrollTo({ left: target, behavior: "smooth" });
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

    const scrollToCustomPricing = () => {
        triggerHaptic(30);
        if (customPricingRef.current) {
            customPricingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    const handleCustomPricingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        triggerHaptic(40);
        const emailToUse = customEmail.trim() || user?.email || "";
        if (!emailToUse || !emailToUse.includes("@")) {
            toast.error("Please enter a valid email address.");
            return;
        }
        if (!numericPrice || numericPrice <= 0) {
            toast.error("Please provide a valid proposed budget in Rupees (₹).");
            return;
        }
        if (!numericLinks || numericLinks <= 0) {
            toast.error("Please specify how many permanent links you need.");
            return;
        }

        setCustomSubmitting(true);
        try {
            let token = "";
            if (user) {
                token = await user.getIdToken();
            }
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/custom-pricing-request", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    email: emailToUse,
                    companyName: customCompany.trim() || null,
                    linksNeeded: numericLinks,
                    apiQuotaNeeded: numericApiCalls || 10000,
                    proposedPriceINR: numericPrice,
                    notes: customNotes.trim(),
                }),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Custom pricing proposal submitted!", {
                    description: "Our admin team will review your proposal and curate your plan directly onto your account.",
                });
                setCustomSubmitted(true);
            } else {
                toast.error(data.message || "Failed to submit proposal.");
            }
        } catch {
            toast.error("Network error while submitting proposal.");
        } finally {
            setCustomSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-5%] right-[-10%] w-[60%] h-[40%] bg-fuchsia-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[30%] bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />
            
            <TopNavbar />

            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                {/* Header & Currency Switcher */}
                <div className="px-6 pt-7 pb-3 text-center relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3 shadow-xs">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Transparent & Flexible Plans</span>
                    </div>

                    <h2 id="mobile-pricing-title" className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent mb-1.5 pb-0.5">
                        Simple, Honest Pricing
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Permanent banked links & high-speed API quota for developers and mobile power users.
                    </p>

                    {/* Currency Selector */}
                    <div className="mt-4 mx-auto inline-flex items-center gap-1 p-1 bg-white/80 dark:bg-slate-900/80 rounded-2xl backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
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

                {/* Targeted VIP Admin Offer Banner (If Active) */}
                {targetedOffer && (
                    <div className="px-4 mb-4 relative z-20">
                        <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500/60 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-4 shadow-xl">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600/25 via-purple-600/15 to-transparent pointer-events-none" />
                            <div className="relative z-10 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30 animate-pulse">
                                        <Zap className="h-3 w-3 fill-amber-300" />
                                        VIP Admin Offer
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                        {targetedOffer.discountType === "percentage"
                                            ? `${targetedOffer.discountValue}% OFF`
                                            : targetedOffer.discountType === "flat"
                                            ? `₹${targetedOffer.discountValue} OFF`
                                            : `₹${targetedOffer.discountValue} Fixed Price`}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-white leading-snug">
                                        {targetedOffer.title}
                                    </h3>
                                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                                        {targetedOffer.description || "You have been granted an exclusive custom discount on your plan upgrades."}
                                    </p>
                                </div>

                                {/* Eligible Plan Deals with Price Badges */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">
                                        Tap to 1-Click Upgrade:
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {PAID_PLAN_ORDER.filter(p => targetedOffer.plans.includes("all") || targetedOffer.plans.includes(p)).map((planKey) => {
                                            const baseINR = PLAN_CONFIGS[planKey as keyof typeof PLAN_CONFIGS]?.priceINR || 0;
                                            let finalINR = baseINR;
                                            if (targetedOffer.discountType === "percentage") {
                                                finalINR = baseINR * (1 - targetedOffer.discountValue / 100);
                                            } else if (targetedOffer.discountType === "flat") {
                                                finalINR = Math.max(0, baseINR - targetedOffer.discountValue);
                                            } else if (targetedOffer.discountType === "custom_price") {
                                                finalINR = Math.max(0, targetedOffer.discountValue);
                                            }
                                            finalINR = Math.round(finalINR * 100) / 100;
                                            const planLabel = PLAN_CONFIGS[planKey as keyof typeof PLAN_CONFIGS]?.label || planKey;

                                            return (
                                                <button
                                                    key={planKey}
                                                    type="button"
                                                    onClick={() => {
                                                        triggerHaptic(30);
                                                        handleUpgrade(planKey);
                                                    }}
                                                    className="flex items-center gap-1.5 rounded-xl bg-indigo-500/30 border border-indigo-400/50 active:scale-95 hover:bg-indigo-500/50 px-2.5 py-1 text-[11px] transition-all"
                                                >
                                                    <span className="font-bold text-white">{planLabel}:</span>
                                                    <span className="text-[10px] text-slate-400 line-through">₹{baseINR}</span>
                                                    <span className="font-black text-emerald-300">
                                                        {finalINR === 0 ? "FREE" : `₹${finalINR}`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                                    <span className="font-mono truncate">
                                        {user?.email || targetedOffer.targetEmail}
                                    </span>
                                    {targetedOffer.expiresAt ? (
                                        <span className="text-amber-300 font-medium shrink-0">
                                            Expires: {new Date(targetedOffer.expiresAt).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" /> Active
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Horizontal Snap Carousel for Plans */}
                <div 
                    ref={horizontalScrollRef} 
                    className={cn(
                        "flex overflow-x-auto px-6 pb-6 pt-2 gap-4 hide-scrollbar",
                        isSnapping ? "snap-x snap-mandatory" : ""
                    )}
                >
                    {/* Free Plan */}
                    <div id="plan-free" className="snap-center shrink-0 w-[85vw] max-w-[320px] rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-300 dark:bg-slate-700" />
                        
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-2xl font-bold">Free</h3>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                Starter
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Great for quick testing & personal links.</p>
                        
                        <div className="mb-4 flex items-baseline">
                            <span className="text-4xl font-extrabold tracking-tight">Free</span>
                        </div>

                        {/* API Quota Callout */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold mb-4 border border-slate-200 dark:border-slate-700">
                            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>50 Sandbox API calls</span>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1">
                            {FREE_FEATURES.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-2.5">
                                    <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{feat}</span>
                                </li>
                            ))}
                        </ul>

                        <Button 
                            className={cn(
                                "w-full rounded-xl py-5 font-semibold transition-all text-xs",
                                currentPlan === "free" && user 
                                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed" 
                                    : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md hover:opacity-90"
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
                        const isTargetedPlan = Boolean(
                            targetedOffer && (targetedOffer.plans.includes("all") || targetedOffer.plans.includes(tier.planId.toLowerCase()))
                        );

                        let displayPriceINR = tier.priceINR;
                        let strikePriceINR: number | undefined = tier.originalPriceINR;

                        if (isTargetedPlan && targetedOffer) {
                            strikePriceINR = tier.priceINR;
                            if (targetedOffer.discountType === "percentage") {
                                displayPriceINR = tier.priceINR * (1 - targetedOffer.discountValue / 100);
                            } else if (targetedOffer.discountType === "flat") {
                                displayPriceINR = Math.max(0, tier.priceINR - targetedOffer.discountValue);
                            } else if (targetedOffer.discountType === "custom_price") {
                                displayPriceINR = Math.max(0, targetedOffer.discountValue);
                            }
                            displayPriceINR = Math.round(displayPriceINR * 100) / 100;
                        }

                        return (
                            <div key={tier.planId} id={`plan-${tier.planId}`} className={cn(
                                "snap-center shrink-0 w-[85vw] max-w-[320px] rounded-3xl backdrop-blur-2xl border p-6 shadow-xl flex flex-col relative overflow-hidden transition-all duration-300",
                                isTargetedPlan
                                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                    : tier.isPopular 
                                        ? "bg-primary/5 dark:bg-primary/10 border-primary/40 ring-1 ring-primary/20" 
                                        : "bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800",
                                isFocused && "ring-2 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.3)]"
                            )}>
                                {tier.isPopular && !isTargetedPlan && (
                                    <div className="absolute top-0 left-0 w-full bg-primary py-1 text-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                                            Most Popular
                                        </span>
                                    </div>
                                )}
                                {isTargetedPlan && targetedOffer && (
                                    <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 py-1 text-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white animate-pulse">
                                            🎉 Special Deal ({targetedOffer.discountType === "percentage" ? `${targetedOffer.discountValue}% OFF` : `₹${targetedOffer.discountValue} OFF`})
                                        </span>
                                    </div>
                                )}
                                {!tier.isPopular && !isTargetedPlan && <div className="absolute top-0 left-0 w-full h-1 bg-slate-300 dark:bg-slate-700" />}

                                <div className={cn("mb-3", tier.isPopular || isTargetedPlan ? "mt-3" : "")}>
                                    {activeOffer && tier.originalPriceINR !== undefined && !isTargetedPlan && (
                                        <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow-[0_0_15px_-3px_rgba(217,70,239,0.5)] animate-pulse">
                                            🎪 {activeOffer.name} — {activeOffer.type === 'percentage' ? `${activeOffer.value}% OFF` : `₹${activeOffer.value} OFF`}
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold mb-0.5 flex items-center justify-between">
                                        <span>{tier.name}</span>
                                        {tier.comparisonHint && !isTargetedPlan && (
                                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                {tier.comparisonHint}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-muted-foreground min-h-[28px]">{tier.description}</p>
                                </div>

                                {/* Price Section */}
                                <div className="mb-3 flex flex-col gap-1">
                                    {strikePriceINR !== undefined && (
                                        <div className="inline-block">
                                            <span className="text-lg font-bold text-slate-400 line-through decoration-rose-500/80 decoration-[2.5px]">
                                                {currencySymbols[currency]}{formatPrice(strikePriceINR)}
                                            </span>
                                            <span className="ml-1 text-xs font-semibold text-slate-400 line-through decoration-rose-500/80 decoration-[2.5px]">/mo</span>
                                        </div>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-bold">{currencySymbols[currency]}</span>
                                        <span className={cn(
                                            "text-4xl font-black tracking-tight",
                                            isTargetedPlan 
                                                ? "text-emerald-600 dark:text-emerald-400" 
                                                : strikePriceINR !== undefined 
                                                ? "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent" 
                                                : ""
                                        )}>{formatPrice(displayPriceINR)}</span>
                                        <span className="text-xs font-semibold text-muted-foreground ml-1">/mo</span>
                                    </div>
                                </div>

                                {/* High-Visibility API Quota Pill */}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-4 border border-emerald-500/25">
                                    <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                                    <span>⚡ {tier.apiQuotaFormatted}</span>
                                </div>

                                <ul className="space-y-2.5 mb-6 flex-1">
                                    <li className="flex items-start gap-2.5">
                                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-foreground font-bold" />
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{tier.links}</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tier.expiry}</span>
                                    </li>
                                    {tier.features?.map((feat: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button 
                                    className={cn(
                                        "w-full rounded-xl py-5 font-semibold transition-all shadow-md text-xs",
                                        tier.planId === currentPlan 
                                            ? "bg-primary/20 text-primary border border-primary/30" 
                                            : tier.isPopular 
                                                ? "bg-primary text-primary-foreground hover:opacity-90" 
                                                : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
                                    )}
                                    onClick={() => { triggerHaptic(40); handleUpgrade(tier.planId); }}
                                >
                                    {tier.planId === currentPlan ? (
                                        <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Renew / Active</span>
                                    ) : tier.ctaText}
                                </Button>
                            </div>
                        );
                    })}

                    {/* 7th Card: Custom Enterprise & Tailored Scale */}
                    <div id="plan-custom" className="snap-center shrink-0 w-[85vw] max-w-[320px] rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border border-indigo-500/40 p-6 shadow-xl flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
                        
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-2xl font-bold">Custom Plan</h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Tailored
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mb-3">High-volume links, dedicated API quota, or custom budget.</p>
                        
                        <div className="mb-4 flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold tracking-tight text-amber-300">Flexible</span>
                            <span className="text-xs text-slate-400 font-semibold">/₹ proposed</span>
                        </div>

                        {/* API Quota Callout */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-4 border border-indigo-400/30">
                            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span>⚡ 2M+ Dedicated API Calls</span>
                        </div>

                        <ul className="space-y-2.5 mb-6 flex-1">
                            <li className="flex items-start gap-2.5">
                                <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400 font-bold" />
                                <span className="text-xs font-bold text-white">50K+ Permanent Banked Links</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400" />
                                <span className="text-xs font-medium text-slate-200">High-concurrency Developer API</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400" />
                                <span className="text-xs font-medium text-slate-200">Rendered directly onto your account</span>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Check className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400" />
                                <span className="text-xs font-medium text-slate-200">Propose your budget in INR (₹)</span>
                            </li>
                        </ul>

                        <Button 
                            className="w-full rounded-xl py-5 font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg transition-all"
                            onClick={scrollToCustomPricing}
                        >
                            Propose Custom Plan <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                    </div>
                </div>

                {/* Collapsible Feature Comparison Accordion */}
                <div className="px-5 mb-8">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic(20);
                            setShowComparison(!showComparison);
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-left"
                    >
                        <div className="flex items-center gap-2.5">
                            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">Compare Plan Limits & API Quotas</span>
                        </div>
                        {showComparison ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {showComparison && (
                        <div className="mt-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-md space-y-3 overflow-x-auto text-xs">
                            <table className="w-full min-w-[320px] text-left">
                                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                                    <tr>
                                        <th className="py-2 pr-2">Plan</th>
                                        <th className="py-2 px-2">Links</th>
                                        <th className="py-2 px-2">API Quota</th>
                                        <th className="py-2 pl-2">Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    <tr>
                                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">Free</td>
                                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">5 links</td>
                                        <td className="py-2 px-2 text-amber-600 dark:text-amber-400">50 (Sandbox)</td>
                                        <td className="py-2 pl-2 font-bold">₹0</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">Starter</td>
                                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">25 links</td>
                                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-semibold">2.5K/mo</td>
                                        <td className="py-2 pl-2 font-bold">₹29/mo</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">Pro</td>
                                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">100 links</td>
                                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-semibold">15K/mo</td>
                                        <td className="py-2 pl-2 font-bold">₹79/mo</td>
                                    </tr>
                                    <tr className="bg-primary/5">
                                        <td className="py-2 pr-2 font-bold text-primary">Business ★</td>
                                        <td className="py-2 px-2 font-semibold">500 links</td>
                                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-bold">60K/mo</td>
                                        <td className="py-2 pl-2 font-black text-primary">₹149/mo</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">Enterprise</td>
                                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">2,500 links</td>
                                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-semibold">300K/mo</td>
                                        <td className="py-2 pl-2 font-bold">₹299/mo</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">Big Enterprise</td>
                                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">10,000 links</td>
                                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-semibold">1,000,000/mo</td>
                                        <td className="py-2 pl-2 font-bold">₹699/mo</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="text-[11px] text-muted-foreground pt-1 italic">
                                All paid plans include permanent link retention (never expires) and high-concurrency API credentials.
                            </p>
                        </div>
                    )}
                </div>

                {/* Custom Pricing Proposal Section */}
                <div ref={customPricingRef} id="custom-pricing-section" className="px-5 mb-10">
                    <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-white via-slate-50/90 to-emerald-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20 p-6 shadow-lg backdrop-blur-xl">
                        <div className="space-y-3 mb-5">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                                <Sparkles className="h-3 w-3 text-emerald-600" />
                                <span>Custom Enterprise Packages</span>
                            </div>
                            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                Want custom scale or tailored pricing?
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                Need massive API quota or higher link limits? Propose your requirements and tailored monthly budget. We&apos;ll curate a plan rendered directly to your account for 1-click checkout.
                            </p>
                        </div>

                        {customSubmitted ? (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="p-5 text-center space-y-4 bg-white/95 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md"
                            >
                                {/* Animated Celebratory Badge */}
                                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0.5 }}
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                                        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                                        className="absolute inset-0 rounded-full bg-emerald-500/25 blur-lg pointer-events-none"
                                    />
                                    <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center ring-4 ring-emerald-500/20">
                                        <CheckCircle2 className="h-8 w-8 text-white" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                        <Sparkles className="h-3 w-3 text-emerald-600" />
                                        <span>Proposal Logged & Active</span>
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900 dark:text-white">
                                        Proposal Submitted! 🎉
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                                        Requirements for <strong className="text-slate-900 dark:text-white">{numericLinks.toLocaleString()} links</strong> at <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹{numericPrice.toLocaleString()}/mo</strong> received.
                                    </p>
                                </div>

                                {/* 3-Step Lifecycle Workflow Card */}
                                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-left space-y-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-emerald-600" />
                                        <span>What Happens Next (Lifecycle)</span>
                                    </h5>

                                    <div className="space-y-2.5">
                                        {/* Step 1 */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-5 w-5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0 border border-emerald-500/30 mt-0.5">
                                                1
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-indigo-500" />
                                                    <span>Email Approval Notice</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                                                    When approved, confirmation will be emailed to <strong className="text-slate-900 dark:text-white font-mono">{customEmail || user?.email}</strong>.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-5 w-5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-500/30 mt-0.5">
                                                2
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                    <span>Curated Plan Rendered Here</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                                                    Your curated tier will appear live on this <strong className="text-slate-900 dark:text-white">Plan Page</strong> & your <strong className="text-slate-900 dark:text-white">Dashboard</strong> with an <strong className="text-emerald-600 dark:text-emerald-400 font-bold">&apos;Approved&apos;</strong> tag.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 3 */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-5 w-5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
                                                3
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                                    <CreditCard className="w-3 h-3 text-emerald-500" />
                                                    <span>1-Click Buy via Razorpay</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                                                    Simply tap <strong className="text-slate-900 dark:text-white">&apos;Claim Plan&apos;</strong> to complete payment via Razorpay as usual and activate your banked links.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            triggerHaptic(20);
                                            setCustomSubmitted(false);
                                        }}
                                        className="w-full text-xs h-9 rounded-xl font-bold"
                                    >
                                        Submit Another Proposal
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                            triggerHaptic(20);
                                            if (scrollRef.current) {
                                                scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
                                            }
                                        }}
                                        className="w-full text-xs h-9 rounded-xl font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                    >
                                        Browse Standard Plans ↑
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="space-y-3.5">
                                {/* User Proposal Lifecycle Status Banner */}
                                {userCustomRequest && (
                                    <div className="mb-2">
                                        {userCustomRequest.status === "curated" && (
                                            <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span>Proposal Approved!</span>
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold uppercase">
                                                        Ready
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                                                    Admin curated your plan at <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹{(userCustomRequest.curatedPriceINR || userCustomRequest.proposedPriceINR)?.toLocaleString()}/mo</strong> for <strong className="text-slate-900 dark:text-white">{(userCustomRequest.curatedLinks || userCustomRequest.linksNeeded)?.toLocaleString()} links</strong> & <strong className="text-slate-900 dark:text-white">{(userCustomRequest.curatedApiQuota || userCustomRequest.apiQuotaNeeded)?.toLocaleString()} API calls</strong>.
                                                </p>
                                                {userCustomRequest.adminNotes && (
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-emerald-500/20">
                                                        &ldquo;{userCustomRequest.adminNotes}&rdquo;
                                                    </p>
                                                )}
                                                <Button
                                                    size="sm"
                                                    type="button"
                                                    onClick={() => {
                                                        triggerHaptic(40);
                                                        if (targetedOffer && targetedOffer.plans && targetedOffer.plans.length > 0) {
                                                            const targetPlan = targetedOffer.plans[0] === "all" ? "enterprise" : targetedOffer.plans[0];
                                                            handleUpgrade(targetPlan);
                                                        } else {
                                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                                        }
                                                    }}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl cursor-pointer mt-1 shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5"
                                                >
                                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                                    <span>1-Click Upgrade to Curated Plan</span>
                                                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                                                </Button>
                                            </div>
                                        )}

                                        {userCustomRequest.status === "pending" && (
                                            <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        <span>Proposal Under Review</span>
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold uppercase">
                                                        Pending
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                                                    Your request for <strong className="text-slate-900 dark:text-white">{userCustomRequest.linksNeeded?.toLocaleString()} links</strong> at <strong className="text-emerald-600 dark:text-emerald-400">₹{userCustomRequest.proposedPriceINR?.toLocaleString()}/mo</strong> is being reviewed.
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                    ⚡ Curated plans are typically rendered within 2 hours.
                                                </p>
                                            </div>
                                        )}

                                        {userCustomRequest.status === "rejected" && (
                                            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-xs space-y-1">
                                                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                                                    <XCircle className="h-3.5 w-3.5 text-slate-500" />
                                                    <span>Previous Proposal Closed</span>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 text-[10px]">
                                                    Admin note: &ldquo;{userCustomRequest.adminNotes || "Proposal could not be accommodated as submitted."}&rdquo;
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <form onSubmit={handleCustomPricingSubmit} className="space-y-3.5">
                                {/* Quick Enterprise Presets */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                            <Zap className="h-3 w-3 text-amber-500" />
                                            <span>Quick Enterprise Presets</span>
                                        </label>
                                        <span className="text-[10px] text-slate-400">Tap to auto-fill</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ENTERPRISE_PRESETS.map((preset) => {
                                            const isSelected = activePreset === preset.id;
                                            return (
                                                <motion.button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => applyPreset(preset)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.96 }}
                                                    className={cn(
                                                        "relative text-left p-2 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
                                                        isSelected
                                                            ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 ring-1 ring-emerald-500"
                                                            : "border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70"
                                                    )}
                                                >
                                                    {preset.badge && (
                                                        <span className={cn(
                                                            "inline-block px-1 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider mb-0.5",
                                                            isSelected ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                        )}>
                                                            {preset.badge}
                                                        </span>
                                                    )}
                                                    <div className="font-bold text-[11px] text-slate-900 dark:text-white leading-tight">{preset.name}</div>
                                                    <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{preset.description}</div>
                                                    <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹{preset.price.toLocaleString()}/mo</div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Company / Project (Optional)</label>
                                    <input
                                        type="text"
                                        value={customCompany}
                                        onChange={(e) => setCustomCompany(e.target.value)}
                                        placeholder="Acme Corp"
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Permanent Links</label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            placeholder="e.g. 50,000"
                                            value={customLinks}
                                            onChange={(e) => {
                                                setActivePreset(null);
                                                const val = e.target.value;
                                                setCustomLinks(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                                            }}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Monthly API Calls</label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            placeholder="e.g. 2,000,000"
                                            value={customApiCalls}
                                            onChange={(e) => {
                                                setActivePreset(null);
                                                const val = e.target.value;
                                                setCustomApiCalls(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                                            }}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                        <span>Proposed Budget</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">(₹/mo)</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">₹</span>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            placeholder="e.g. 1,499"
                                            value={customProposedPrice}
                                            onChange={(e) => {
                                                setActivePreset(null);
                                                const val = e.target.value;
                                                setCustomProposedPrice(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                                            }}
                                            className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                        />
                                    </div>
                                </div>

                                {/* Live Value & Savings Pill Card */}
                                <motion.div
                                    layout
                                    className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] dark:bg-emerald-500/10 text-xs text-slate-700 dark:text-slate-200 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-900 dark:text-white">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span>
                                                {numericLinks > 0 && numericPrice > 0 ? (
                                                    <>Rate: <strong className="text-emerald-600 dark:text-emerald-400">~₹{costPer1k}/1K links</strong></>
                                                ) : (
                                                    "Enterprise High-Throughput Tier"
                                                )}
                                            </span>
                                        </div>
                                        {numericPrice > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                                                Save ~{savingsPercent}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                        <span>⚡ Fast-track review (under 2h)</span>
                                        <span>🛡️ High-concurrency SLA</span>
                                    </div>
                                </motion.div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Notes / Requirements (Optional)</label>
                                    <textarea
                                        rows={2}
                                        value={customNotes}
                                        onChange={(e) => setCustomNotes(e.target.value)}
                                        placeholder="Traffic details, SLA, or integration notes..."
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                    />
                                </div>

                                <div className="space-y-2 pt-1">
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={customSubmitting}
                                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 relative overflow-hidden group"
                                    >
                                        {/* Shimmer sweep effect */}
                                        <span className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />
                                        
                                        {customSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Submitting Proposal...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                                <span>
                                                    Submit Proposal · Lock In {numericPrice > 0 ? `₹${numericPrice.toLocaleString()}/mo` : "Custom Rate"}
                                                </span>
                                            </>
                                        )}
                                    </motion.button>
                                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium text-center">
                                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>No upfront payment · Reviewed & curated onto your account</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                    </div>
                </div>

                <div className="pb-12 pt-2 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 opacity-70" />
                    <span className="text-[11px] font-medium">Secure checkout powered by Razorpay</span>
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

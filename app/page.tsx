"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { TiltedCarousel } from "@/components/content/tilted-carousel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PLAN_CONFIGS, PlanConfig } from "@/lib/plans";
import { Logo } from "@/components/ui/Logo";

// Hook to detect low-end devices and mobile screens
function useDeviceCapabilities() {
    const [isMobile, setIsMobile] = useState(false);
    const [isLowEnd] = useState(() => {
        if (typeof window === "undefined") return false;
        const cores = navigator.hardwareConcurrency || 4;
        // @ts-expect-error deviceMemory is non-standard
        const memory = navigator.deviceMemory || 4;
        return cores <= 4 || memory <= 4;
    });
    const [isMounted] = useState(() => typeof window !== "undefined");

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return { isMobile, isLowEnd, isMounted };
}

// A component that renders a plan card and animates its currency
function AnimatedPlanCard({ plan, activeCurrency }: { plan: PlanConfig, activeCurrency: { code: string; symbol: string; rate: number } }) {
    const price = Math.round(plan.priceINR * activeCurrency.rate);
    const ttlDays = plan.ttlMs / (1000 * 60 * 60 * 24);
    const ttlText = ttlDays >= 1 ? `${ttlDays} days expiry` : `${plan.ttlMs / (1000 * 60 * 60)} hours expiry`;

    return (
        <div className="w-full h-full bg-white p-6 md:p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <div className="w-32 h-32 rounded-full bg-emerald-500 blur-2xl" style={{ transform: 'translate3d(0,0,0)' }} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 capitalize mb-2 relative z-10">{plan.label}</h3>
            
            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeCurrency.code}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-baseline gap-1 mb-6 relative z-10"
                >
                    <span className="text-3xl md:text-4xl font-black text-emerald-600">
                        {activeCurrency.symbol}{price}
                    </span>
                    <span className="text-slate-500 font-medium">/mo</span>
                </motion.div>
            </AnimatePresence>
            
            <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{plan.limit} Links</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{ttlText}</span>
                </div>
                {plan.apiAccess && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Developer API Access</span>
                    </div>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="w-full py-2 bg-slate-50 rounded-md flex items-center justify-center text-sm font-semibold text-slate-400">
                    Select Plan
                </div>
            </div>
        </div>
    );
}

import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";

export default function LandingPage() {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);
    const { isMobile, isLowEnd, isMounted } = useDeviceCapabilities();
    const [user, setUser] = useState<User | null>(null);
    const [userPlan, setUserPlan] = useState<string>("guest");

    useEffect(() => {
        const fetchPlan = async (u: User) => {
            try {
                const token = await u.getIdToken(true);
                const res = await fetch("/api/links?pageSize=1", { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.plan) {
                    setUserPlan(data.plan.toLowerCase());
                } else {
                    setUserPlan("free");
                }
            } catch {
                setUserPlan("free");
            }
        };

        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                fetchPlan(u);
            } else {
                setUserPlan("guest");
            }
        });

        const handleRealtimeUpdate = () => {
            if (auth.currentUser) {
                fetchPlan(auth.currentUser);
            }
        };

        window.addEventListener("userProfileUpdated", handleRealtimeUpdate);
        window.addEventListener("linkGenerated", handleRealtimeUpdate);

        return () => {
            unsub();
            window.removeEventListener("userProfileUpdated", handleRealtimeUpdate);
            window.removeEventListener("linkGenerated", handleRealtimeUpdate);
        };
    }, []);

    // Hoisted Currency State (runs only 1 timer instead of 80+)
    const currencies = [
        { code: "USD", symbol: "$", rate: 0.012 },
        { code: "INR", symbol: "₹", rate: 1 },
        { code: "EUR", symbol: "€", rate: 0.011 },
    ];
    const [currencyIndex, setCurrencyIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrencyIndex((prev) => (prev + 1) % currencies.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [currencies.length]);

    const activeCurrency = currencies[currencyIndex];

    const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        setIsNavigating(true);
        router.push(href);
    };

    // Filter out free and guest plans
    const paidPlans = Object.entries(PLAN_CONFIGS)
        .filter(([key]) => key !== "free" && key !== "guest")
        .map(([, plan]) => plan);

    // For low-end devices or mobile, we drastically reduce the duplication to save DOM nodes and RAM
    const isConstrained = isMobile || isLowEnd;
    const basePlans = [
        ...paidPlans.map((plan, i) => <AnimatedPlanCard key={`plan-1-${i}`} plan={plan} activeCurrency={activeCurrency} />),
    ];
    // If not constrained, we duplicate the base plans once for a denser carousel
    const items: React.ReactNode[] = isConstrained ? basePlans : [
        ...basePlans,
        ...paidPlans.map((plan, i) => <AnimatedPlanCard key={`plan-2-${i}`} plan={plan} activeCurrency={activeCurrency} />),
    ];

    return (
        <div className="relative flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50">
            {/* Navigation Overlay Loader */}
            <AnimatePresence>
                {isNavigating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-white/80 backdrop-blur-sm"
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.05, 1],
                                    opacity: [0.8, 1, 0.8]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="drop-shadow-lg"
                            >
                                <Logo size="lg" />
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Navbar */}
            <div className="absolute top-0 inset-x-0 z-50">
                <TopNavbar />
            </div>

            {/* Main Hero Area */}
            <main className="w-full h-[100dvh] pt-14 pb-8 sm:pb-0 relative overflow-hidden flex flex-col items-center justify-between sm:justify-center">
                {/* Silent Drifting Animated Background Orbs */}
                <motion.div
                    animate={{
                        x: [0, 40, -30, 0],
                        y: [0, -35, 30, 0],
                        scale: [1, 1.15, 0.9, 1],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 16,
                        ease: "easeInOut",
                    }}
                    className="absolute top-1/4 -left-24 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-gradient-to-br from-emerald-400/20 via-teal-400/15 to-cyan-400/15 rounded-full blur-[90px] sm:blur-[100px] pointer-events-none z-0"
                />
                <motion.div
                    animate={{
                        x: [0, -45, 35, 0],
                        y: [0, 40, -30, 0],
                        scale: [1, 0.85, 1.1, 1],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 20,
                        ease: "easeInOut",
                    }}
                    className="absolute bottom-1/4 -right-24 w-[380px] sm:w-[480px] h-[380px] sm:h-[480px] bg-gradient-to-tr from-indigo-400/20 via-purple-400/15 to-emerald-400/15 rounded-full blur-[100px] sm:blur-[110px] pointer-events-none z-0"
                />

                {/* Background 3D Carousel */}
                <div className="absolute inset-0 z-0 flex items-center justify-center opacity-60 sm:opacity-65">
                    {isMounted && (
                        <TiltedCarousel 
                            className="bg-slate-50" 
                            items={items} 
                            pauseOnHover={false} 
                            speed={45} 
                            preset={isMobile ? "cinematic" : "isometric"} // Less extreme 3D angle on mobile
                            multiplier={isConstrained ? 4 : 8}            // Half the clones on low-end/mobile
                            rows={isMobile ? 3 : 4}                       // Less rows on mobile
                        />
                    )}
                    {/* Gradient Overlay for readability and premium feel */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/80 to-slate-50/40 z-10 pointer-events-none" />
                    {/* Radial gradient to focus on the center */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_0%,rgba(248,250,252,0.95)_100%)] z-10" />
                </div>

                {/* Desktop Hero Content */}
                <div className="hidden sm:flex relative z-20 flex-col items-center text-center px-6 max-w-5xl mx-auto my-auto w-full">
                    {/* Unique Magic Badge with Pulsing Live Status */}
                    <div className="relative inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-emerald-500/30 text-emerald-700 text-xs font-semibold mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)] group transition-all duration-300 hover:scale-105 cursor-default">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="relative z-10 tracking-wide">The Ultimate URL Shortener</span>
                        <ArrowRight className="w-3.5 h-3.5 relative z-10 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    
                    <h1 className="text-6xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tighter mb-4 drop-shadow-xl leading-[1.1]">
                        Shorten your URL, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
                            Expand your reach.
                        </span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl leading-relaxed drop-shadow-sm font-medium">
                        Turn long URLs into clean, shareable links with custom aliases and analytics.
                    </p>

                    {/* Glowing High-Impact Desktop Action Button Row */}
                    {(() => {
                        const primaryBtn = (!user || userPlan === "guest")
                            ? { labelDesktop: "Shorten URL Free", labelMobile: "Shorten Free", href: "/app" }
                            : userPlan === "free"
                            ? { labelDesktop: "Create Short Link", labelMobile: "Create Link", href: "/app" }
                            : { labelDesktop: `Create ${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Link`, labelMobile: `Create ${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}`, href: "/app" };

                        const secondaryBtn = (!user || userPlan === "guest" || userPlan === "free")
                            ? { label: "View Pricing", href: "/pricing" }
                            : { label: "View Analytics", href: "/analytics" };

                        return (
                            <div className="flex flex-row items-center gap-4 w-auto justify-center mb-8">
                                <Link href={primaryBtn.href} onClick={(e) => handleNavigation(e, primaryBtn.href)}>
                                    <Button
                                        size="lg"
                                        className="relative h-14 px-9 text-base font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white rounded-full shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:shadow-[0_0_50px_rgba(16,185,129,0.75)] hover:scale-105 active:scale-95 transition-all duration-300 group flex items-center justify-center gap-2 overflow-hidden border border-emerald-400/40"
                                    >
                                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                                        <span className="relative z-10 flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                                            </span>
                                            <span>{primaryBtn.labelDesktop}</span>
                                        </span>
                                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1.5 transition-transform duration-200" />
                                    </Button>
                                </Link>
                                <Link href={secondaryBtn.href} onClick={(e) => handleNavigation(e, secondaryBtn.href)}>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="h-14 px-9 text-base font-semibold bg-white/90 text-slate-700 border-slate-200/80 rounded-full shadow-sm hover:shadow-md hover:text-slate-900 hover:bg-white hover:scale-102 transition-all duration-200 active:scale-95"
                                    >
                                        {secondaryBtn.label}
                                    </Button>
                                </Link>
                            </div>
                        );
                    })()}

                    {/* Live Trust & Performance Stats */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs font-semibold text-slate-600 bg-white/70 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200/70 shadow-sm">
                        <span className="flex items-center gap-1.5"><span className="text-amber-500">⚡</span> 5M+ Shortened</span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1.5"><span className="text-emerald-500">🔒</span> 99.99% Uptime</span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1.5"><span className="text-indigo-500">🚀</span> Instant Redirects</span>
                    </div>
                </div>

                {/* Dedicated Mobile Hero Content */}
                <div className="flex sm:hidden relative z-20 flex-col items-center justify-center text-center px-4 pt-14 pb-12 w-full h-[calc(100dvh-3.5rem)] gap-4 mx-auto my-auto overflow-hidden">
                    {/* Unique Magic Badge */}
                    <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-emerald-500/30 text-emerald-700 text-[10px] font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span className="relative z-10 tracking-wide">The Ultimate URL Shortener</span>
                        <ArrowRight className="w-3 h-3 text-emerald-600" />
                    </div>
                    
                    <h1 className="text-2xl min-[375px]:text-3xl font-black text-slate-900 tracking-tighter leading-[1.15]">
                        Shorten your URL, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
                            Expand your reach.
                        </span>
                    </h1>
                    
                    <p className="text-xs text-slate-600 font-medium max-w-[270px] leading-relaxed">
                        Turn long URLs into clean, shareable links with custom aliases and analytics.
                    </p>

                    {/* Mobile Action Button Row */}
                    {(() => {
                        const primaryBtn = (!user || userPlan === "guest")
                            ? { labelMobile: "Shorten Free", href: "/app" }
                            : userPlan === "free"
                            ? { labelMobile: "Create Link", href: "/app" }
                            : { labelMobile: `Create ${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}`, href: "/app" };

                        const secondaryBtn = (!user || userPlan === "guest" || userPlan === "free")
                            ? { label: "View Pricing", href: "/pricing" }
                            : { label: "Analytics", href: "/analytics" };

                        return (
                            <div className="flex flex-row items-center gap-2 w-full max-w-[320px] justify-center mt-1">
                                <Link href={primaryBtn.href} onClick={(e) => handleNavigation(e, primaryBtn.href)} className="flex-1">
                                    <Button
                                        size="sm"
                                        className="w-full h-10 px-3 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-1"
                                    >
                                        <span>{primaryBtn.labelMobile}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                </Link>
                                <Link href={secondaryBtn.href} onClick={(e) => handleNavigation(e, secondaryBtn.href)} className="flex-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-10 px-3 text-xs font-semibold bg-white/90 text-slate-700 border-slate-200/80 rounded-full shadow-sm active:scale-95"
                                    >
                                        {secondaryBtn.label}
                                    </Button>
                                </Link>
                            </div>
                        );
                    })()}

                    {/* Mobile Live Trust Stats */}
                    <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-600 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/70 shadow-sm mt-1">
                        <span className="flex items-center gap-1"><span className="text-amber-500">⚡</span> 5M+ Shortened</span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1"><span className="text-emerald-500">🔒</span> 99.99% Uptime</span>
                    </div>
                </div>
            </main>

            {/* OG Blended Home Footer */}
            <div className="relative z-50 shrink-0">
                <HomeFooter />
            </div>
        </div>
    );
}

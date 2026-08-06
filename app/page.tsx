"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { TiltedCarousel } from "@/components/content/tilted-carousel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Link2, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PLAN_CONFIGS, PlanConfig } from "@/lib/plans";
import { Logo } from "@/components/ui/Logo";

// Hook to detect low-end devices and mobile screens
function useDeviceCapabilities() {
    const [isMobile, setIsMobile] = useState(false);
    const [isLowEnd, setIsLowEnd] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Detect low-end based on hardware concurrency (cores) or device memory
        const cores = navigator.hardwareConcurrency || 4;
        // @ts-ignore
        const memory = navigator.deviceMemory || 4;
        if (cores <= 4 || memory <= 4) {
            setIsLowEnd(true);
        }

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

export default function LandingPage() {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);
    const { isMobile, isLowEnd, isMounted } = useDeviceCapabilities();

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
        .map(([_, plan]) => plan);

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
            <main className="w-full h-full pt-14 relative overflow-hidden flex flex-col items-center justify-center">
                {/* Background 3D Carousel (Only renders once capability check is mounted to prevent hydration mismatch) */}
                <div className="absolute inset-0 z-0 flex items-center justify-center opacity-70">
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
                    {/* Gradient Overlay for readability and premium feel (Light mode version) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/80 to-slate-50/40 z-10 pointer-events-none" />
                    {/* Radial gradient to focus on the center */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_0%,rgba(248,250,252,0.95)_100%)] z-10" />
                </div>

                {/* Hero Content */}
                <div className="relative z-20 flex flex-col items-center text-center px-4 sm:px-6 max-w-5xl mx-auto -mt-12 sm:-mt-10">
                    
                    {/* Unique Magic Badge (Light Mode) */}
                    <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-slate-200/60 text-emerald-600 text-sm font-medium mb-8 overflow-hidden shadow-lg group">
                        <div className="absolute inset-0 backdrop-blur-md" />
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                        <Link2 className="w-4 h-4 relative z-10 text-emerald-500 group-hover:rotate-12 transition-transform duration-300" />
                        <span className="relative z-10 tracking-wide text-slate-700">The Ultimate URL Shortener</span>
                        <div className="absolute inset-x-0 -bottom-px h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
                    </div>
                    
                    <h1 className="text-[2.5rem] leading-[1.1] min-[375px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tighter mb-6 drop-shadow-xl">
                        Shorten your URL, <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
                            Expand your reach.
                        </span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed drop-shadow-sm font-medium">
                        Turn long URLs into clean, shareable links with powerful analytics and optional custom aliases in a few quick steps.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link href="/app" onClick={(e) => handleNavigation(e, '/app')} className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold bg-emerald-600 text-white rounded-full shadow-[0_4px_14px_0_rgba(5,150,105,0.39)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.23)] hover:bg-emerald-700 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 group flex items-center justify-center gap-1.5">
                                <span>Create Free Link Now</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                            </Button>
                        </Link>
                        <Link href="/pricing" onClick={(e) => handleNavigation(e, '/pricing')} className="w-full sm:w-auto">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold bg-white text-slate-700 border-slate-200 rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:text-slate-900 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-200 active:scale-95">
                                View Pricing
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>

            {/* Blended Footer (Light Mode) */}
            <footer className="absolute bottom-0 inset-x-0 z-50 px-4 py-4 sm:px-6 sm:py-6 bg-transparent pointer-events-none">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                    <div className="text-[11px] sm:text-xs font-medium text-slate-900/30 hidden sm:block pointer-events-auto">
                        &copy; {new Date().getFullYear()} XURL. All rights reserved.
                    </div>
                    <div className="flex items-center justify-center gap-6 text-[11px] sm:text-xs font-medium text-slate-900/40 w-full sm:w-auto pointer-events-auto">
                        <Link href="/terms" target="_blank" className="hover:text-slate-900/80 transition-colors duration-300">Terms</Link>
                        <Link href="/privacy" target="_blank" className="hover:text-slate-900/80 transition-colors duration-300">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

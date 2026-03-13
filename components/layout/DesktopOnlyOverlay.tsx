"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DesktopOnlyOverlayProps {
    children: React.ReactNode;
}

const emptySubscribe = () => () => {};

export function DesktopOnlyOverlay({ children }: DesktopOnlyOverlayProps) {
    const [isDesktop, setIsDesktop] = useState(true);
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);

        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    if (!isClient) {
        // Render nothing during SSR to avoid hydration mismatch, let the layout handle children normally.
        // Once hydrated, if it's not desktop, it'll swap to the overlay.
        return <>{children}</>;
    }

    return (
        <AnimatePresence mode="wait">
            {!isDesktop ? (
                <motion.div
                    key="desktop-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center"
                >
                    {/* Premium glass/glow background effects */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-[20%] -left-[10%] h-[50vh] w-[50vw] rounded-full bg-primary/20 blur-[120px]" />
                        <div className="absolute top-[60%] -right-[10%] h-[40vh] w-[40vw] rounded-full bg-blue-500/10 blur-[100px]" />

                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-3xl" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                        className="relative z-10 flex flex-col items-center max-w-md w-full"
                    >
                        {/* Glowing icon container */}
                        <div className="relative mb-8 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
                                <Monitor className="h-10 w-10 text-white opacity-90" strokeWidth={1.5} />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold tracking-tight text-white mb-4">
                            Desktop version only
                        </h1>

                        <div className="space-y-4 text-slate-300">
                            <p className="text-[16px] leading-relaxed">
                                This application is currently optimized for desktop screens.
                            </p>
                            <p className="text-[16px] leading-relaxed">
                                Mobile support will be available soon.
                                <br />
                                Our developers are actively working on it.
                            </p>
                        </div>

                        <div className="mt-12 pt-8 border-t border-white/10 w-full">
                            <p className="text-xs uppercase tracking-widest text-slate-500 font-medium">
                                Best experienced on screens wider than 1024px
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <>{children}</>
            )}
        </AnimatePresence>
    );
}

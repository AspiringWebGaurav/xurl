"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { motion } from "framer-motion";

export function DesktopOnlyWrapper({ children }: { children: React.ReactNode }) {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const checkViewport = () => {
            // Common breakpoint for desktop is 1024px. Using 900px as a reasonable
            // threshold to allow large tablets in landscape.
            setIsDesktop(window.innerWidth >= 900);
        };

        // Initial check
        checkViewport();

        // Listen for resize
        window.addEventListener("resize", checkViewport);
        return () => window.removeEventListener("resize", checkViewport);
    }, []);

    if (!isDesktop) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 p-6 text-zinc-50 z-[9999]">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-md space-y-6"
                >
                    <div className="mx-auto w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                        <Monitor className="w-8 h-8 text-zinc-400" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-medium tracking-tight">Desktop Only</h1>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            XURL is currently optimized for desktop.
                            Mobile support will be introduced in the future.
                        </p>
                    </div>
                    <p className="text-xs text-zinc-500 pt-4">
                        Please resize your window or switch to a larger device.
                    </p>
                </motion.div>
            </div>
        );
    }

    return <>{children}</>;
}

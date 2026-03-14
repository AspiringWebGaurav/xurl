"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { HomeFooter } from "@/components/layout/HomeFooter";
import Link from "next/link";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function RedirectClient({ dest }: { dest: string }) {
    const [isRedirecting, setIsRedirecting] = useState(false);
    const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    useEffect(() => {
        if (!dest) {
            window.location.replace("/expired");
            return;
        }

        // Delay 2500ms, then trigger fade out and redirect
        const timer = setTimeout(() => {
            setIsRedirecting(true);
            setTimeout(() => {
                window.location.replace(dest);
            }, 200); // fade out duration
        }, 2500);

        return () => clearTimeout(timer);
    }, [dest]);

    const domain = (() => {
        try {
            return dest ? new URL(dest).hostname : "External Site";
        } catch {
            return "External Site";
        }
    })();

    // Growth URL
    const shortDomain = mounted ? buildShortUrl("").replace(/^https?:\/\//, '').replace(/\/$/, '') : "xurl.eu.cc";

    if (!mounted) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <main className="flex-1 flex flex-col justify-center items-center w-full px-6 py-12">
                <AnimatePresence>
                    {!isRedirecting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15, ease: "easeInOut" }}
                            className="w-full max-w-[720px] mx-auto flex flex-col items-center text-center space-y-8"
                        >
                            <div className="space-y-3 mb-4">
                                <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground/90">
                                    Opening link&hellip;
                                </h1>
                                <a href={dest} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/40 hover:bg-muted/60 transition-colors border border-border/40 text-sm md:text-base cursor-pointer">
                                    <span className="text-muted-foreground">Destination:</span>
                                    <span className="font-medium text-foreground">{domain}</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 -mr-1.5" />
                                </a>
                            </div>

                            <div className="flex items-center justify-center gap-3 py-4">
                                <Loader2 className="w-6 h-6 text-emerald-500 animate-[spin_1s_linear_infinite]" />
                                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground tracking-wide">
                                    Redirecting securely
                                </span>
                            </div>

                            <div className="pt-16 flex flex-col items-center gap-3">
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.2em]">
                                    Powered by XURL
                                </p>
                                <Link
                                    href="/"
                                    className="group text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors py-1.5 px-3 rounded-md hover:bg-muted/40"
                                >
                                    Create your own short links
                                    <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                    <span className="text-foreground font-medium flex items-center gap-1">
                                        {shortDomain}
                                        <ExternalLink className="w-3 h-3 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                                    </span>
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <HomeFooter />
        </div>
    );
}

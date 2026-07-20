"use client";

import Link from "next/link";
import { Compass, Home, Plus } from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { motion } from "framer-motion";

export default function NotFound() {
    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <TopNavbar />

            <main className="flex-1 flex flex-col w-full px-6 md:px-8 py-16 md:py-24 overflow-x-hidden justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center md:items-start text-center md:text-left"
                >
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 w-full">
                        {/* Icon aligned left on desktop, centered on mobile */}
                        <div className="shrink-0 flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-muted/50 border border-border/60 text-muted-foreground shadow-sm">
                            <Compass className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col items-center md:items-start gap-6 max-w-2xl">
                            <div className="flex flex-col gap-3">
                                <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Error 404</h2>
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
                                    Page not found
                               </h1>
                                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                                    We couldn't find the page or link you were looking for. It might have been moved, deleted, or perhaps you mistyped the URL.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2 w-full sm:w-auto">
                                <Link
                                    href="/"
                                    className="h-12 px-8 flex items-center justify-center gap-2 rounded-lg shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium text-sm transition-all hover:shadow-md w-full sm:w-auto"
                                >
                                    <Home className="w-4 h-4" />
                                    Return to Home
                                </Link>
                                <Link
                                    href="/"
                                    className="h-12 px-8 flex items-center justify-center gap-2 rounded-lg shadow-sm bg-background border border-border text-foreground hover:bg-muted font-medium text-sm transition-all hover:shadow-md w-full sm:w-auto"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create a New Link
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>

            <HomeFooter />
        </div>
    );
}

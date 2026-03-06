"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { motion } from "framer-motion";

export default function ExpiredPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <TopNavbar />

            <main className="flex-1 flex flex-col w-full px-6 md:px-8 py-16 md:py-24 overflow-x-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center md:items-start text-center md:text-left"
                >
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 w-full">
                        {/* Icon aligned left on desktop, centered on mobile */}
                        <div className="shrink-0 flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-muted/50 border border-border/60 text-muted-foreground shadow-sm">
                            <Clock className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col items-center md:items-start gap-6 max-w-2xl">
                            <div className="flex flex-col gap-3">
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
                                    Link expired or no longer available
                                </h1>
                                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                                    The shortened URL you attempted to access has expired, been removed by its creator, or never existed in the first place.
                                </p>
                            </div>

                            <Link
                                href="/"
                                className="mt-2 h-12 px-8 inline-flex items-center justify-center rounded-lg shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium text-sm transition-all hover:shadow-md"
                            >
                                Create a new link
                            </Link>

                            <div className="mt-8 pt-8 border-t border-border/40 w-full">
                                <h3 className="text-sm font-medium text-foreground mb-2">Expiration Policy</h3>
                                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4 marker:text-muted-foreground/50">
                                    <li>Links created by guests automatically expire after 2 hours.</li>
                                    <li>Links created by signed-in users automatically expire after 12 hours.</li>
                                    <li>Once a link expires, its destination cannot be recovered.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>

            <footer className="shrink-0 text-center py-4 text-xs text-muted-foreground border-t border-border bg-background">
                XURL &middot; Minimal URL Shortener
            </footer>
        </div>
    );
}

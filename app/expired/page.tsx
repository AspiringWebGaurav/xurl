"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, ShieldX } from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { motion } from "framer-motion";

export default function ExpiredPage() {
    const searchParams = useSearchParams();
    const isSuspended = searchParams.get("reason") === "suspended";

    const Icon = isSuspended ? ShieldX : Clock;
    const title = isSuspended
        ? "Link suspended"
        : "Link expired or no longer available";
    const description = isSuspended
        ? "This link has been suspended and is temporarily unavailable. If you believe this is a mistake, please contact the link owner."
        : "The shortened URL you attempted to access has expired, been removed by its creator, or never existed in the first place.";

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
                            <Icon className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col items-center md:items-start gap-6 max-w-2xl">
                            <div className="flex flex-col gap-3">
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
                                    {title}
                                </h1>
                                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                                    {description}
                                </p>
                            </div>

                            <Link
                                href="/"
                                className="mt-2 h-12 px-8 inline-flex items-center justify-center rounded-lg shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium text-sm transition-all hover:shadow-md"
                            >
                                Create a new link
                            </Link>

                            {!isSuspended && (
                                <div className="mt-8 pt-8 border-t border-border/40 w-full">
                                    <h3 className="text-sm font-medium text-foreground mb-2">Expiration Policy</h3>
                                    <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4 marker:text-muted-foreground/50">
                                        <li>Guest links expire after 5 minutes.</li>
                                        <li>Free account links expire after 10 minutes.</li>
                                        <li>Paid plan links expire between 2–24 hours depending on your plan.</li>
                                        <li>Once a link expires, its destination cannot be recovered.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </main>

            <HomeFooter />
        </div>
    );
}

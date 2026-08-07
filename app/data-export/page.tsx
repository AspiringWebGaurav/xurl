"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { 
    Download, 
    FileArchive, 
    Lock, 
    Loader2, 
    Clock, 
    FileText, 
    ArrowRight,
    ChevronDown,
    Check,
    Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const RANGE_OPTIONS = [
    { value: "all", label: "All Time (Everything)" },
    { value: "30d", label: "Past 30 Days" },
    { value: "7d", label: "Past 7 Days" },
    { value: "24h", label: "Past 24 Hours" },
    { value: "1h", label: "Past 1 Hour" },
] as const;

export default function DataExportPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Export Controls
    const [format, setFormat] = useState<"json" | "html">("html");
    const [range, setRange] = useState<"all" | "30d" | "7d" | "24h" | "1h">("all");
    const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");

    const [isGenerating, setIsGenerating] = useState(false);
    const [progressStage, setProgressStage] = useState<string>("");

    // Custom Dropdown Open State
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInPlaceDownload = async () => {
        if (!user || isGenerating) return;

        setIsGenerating(true);
        setProgressStage("Authenticating session...");

        try {
            const token = await user.getIdToken();
            setProgressStage("Querying data records...");

            const response = await fetch(`/api/user/data-export?format=${format}&range=${range}&quality=${quality}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to generate data export.");
            }

            setProgressStage("Compiling package...");

            const disposition = response.headers.get("content-disposition");
            let filename = format === "html" ? "XURL_Data_Report.html" : "XURL_Data_Export.zip";

            if (disposition && disposition.includes("filename=")) {
                const matches = /filename="([^"]+)"/.exec(disposition);
                if (matches?.[1]) {
                    filename = matches[1];
                }
            }

            setProgressStage("Downloading file...");

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const isMobileDevice = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;

            if (isMobileDevice) {
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }

            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
                window.URL.revokeObjectURL(blobUrl);
            }, isMobileDevice ? 10000 : 1500);

            toast.custom((t) => (
                <div className="flex items-center gap-2.5 sm:gap-3 bg-card/95 backdrop-blur-xl border border-emerald-500/30 p-3 sm:p-3.5 rounded-2xl shadow-2xl w-[calc(100vw-2.5rem)] sm:w-full sm:max-w-sm">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] sm:text-xs font-bold text-foreground tracking-tight">Data Archive Downloaded!</p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono truncate mt-0.5">{filename}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toast.dismiss(t)}
                        className="text-muted-foreground hover:text-foreground text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-lg bg-muted/50 hover:bg-muted transition shrink-0"
                    >
                        Dismiss
                    </button>
                </div>
            ), { position: "top-center", duration: 4000 });
        } catch (err: unknown) {
            console.error("Data export error:", err);
            const errMsg = err instanceof Error ? err.message : "Failed to download data archive. Please try again.";
            toast.error(errMsg);
        } finally {
            setIsGenerating(false);
            setProgressStage("");
        }
    };

    const selectedRangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label || "All Time (Everything)";

    return (
        <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-background text-foreground selection:bg-primary selection:text-white">
            <div className="shrink-0">
                <TopNavbar isCreateDisabled={false} />
            </div>

            <main className="flex-1 min-h-0 w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col justify-center overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Checking session...</p>
                    </div>
                ) : !user ? (
                    /* 🔒 GUEST ACCESS NOTICE */
                    <motion.div 
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl space-y-4 max-w-xl mx-auto text-center"
                    >
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                            <Lock className="h-6 w-6" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
                                Sign In to Download Your Data
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                Guest sessions are temporary. To save and download a full report of your links and analytics, please log in or create a free XURL account.
                            </p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-sm transition shadow-lg"
                            >
                                Sign In / Register Free
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/guest-policy"
                                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-2xl border border-border bg-background hover:bg-muted font-bold text-xs sm:text-sm text-foreground transition"
                            >
                                View Guest Policy
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    /* 📦 AUTHENTICATED DATA PORTAL (Broad Responsive Executive Card) */
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl p-4 sm:p-8 lg:p-10 shadow-2xl space-y-4 sm:space-y-6 my-auto overflow-hidden"
                    >
                        {/* Friendly Page Header */}
                        <div className="border-b border-border/60 pb-3 sm:pb-5 flex flex-row items-center justify-between gap-3">
                            <div>
                                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground">
                                    Download Your Data
                                </h1>
                                <p className="text-xs sm:text-base text-muted-foreground mt-1 line-clamp-1 sm:line-clamp-none">
                                    Get a complete machine-readable archive of your links, click stats, and account records.
                                </p>
                            </div>
                            <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border shrink-0 font-mono w-fit max-w-[160px] sm:max-w-none truncate font-semibold">
                                {user.email}
                            </span>
                        </div>

                        {/* Broad 2-Column Options Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-4 items-stretch">
                            {/* LEFT COLUMN: File Format & Date Range */}
                            <div className="md:col-span-6 space-y-2 sm:space-y-3.5 flex flex-col justify-between">
                                {/* Format Segment Control */}
                                <div className="rounded-xl sm:rounded-2xl border border-border bg-muted/30 p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                    <label className="text-[11px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                                        File Format
                                    </label>
                                    <div className="relative grid grid-cols-2 gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-muted border border-border">
                                        <button
                                            type="button"
                                            onClick={() => setFormat("html")}
                                            className={`relative z-10 h-7.5 sm:h-9 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap px-2 cursor-pointer ${
                                                format === "html" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {format === "html" && (
                                                <motion.div
                                                    layoutId="activeFormatPill"
                                                    className="absolute inset-0 rounded-md sm:rounded-lg bg-background shadow-sm border border-border/50"
                                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                                />
                                            )}
                                            <FileText className="relative z-10 h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                            <span className="relative z-10">HTML</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormat("json")}
                                            className={`relative z-10 h-7.5 sm:h-9 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap px-2 cursor-pointer ${
                                                format === "json" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {format === "json" && (
                                                <motion.div
                                                    layoutId="activeFormatPill"
                                                    className="absolute inset-0 rounded-md sm:rounded-lg bg-background shadow-sm border border-border/50"
                                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                                />
                                            )}
                                            <FileArchive className="relative z-10 h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                            <span className="relative z-10">JSON</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Date Range Dropdown */}
                                <div className="rounded-xl sm:rounded-2xl border border-border bg-muted/30 p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2 relative" ref={dropdownRef}>
                                    <label className="text-[11px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                                        Date Range
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="w-full h-8.5 sm:h-10 rounded-lg sm:rounded-xl bg-background border border-border px-3 text-[11px] sm:text-xs font-semibold text-foreground hover:border-primary/50 transition-all duration-200 flex items-center justify-between shadow-sm cursor-pointer"
                                    >
                                        <span className="truncate">{selectedRangeLabel}</span>
                                        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    <AnimatePresence>
                                        {dropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                transition={{ duration: 0.18, ease: "easeOut" }}
                                                className="absolute bottom-full left-0 right-0 mb-1.5 sm:top-full sm:bottom-auto sm:mt-1.5 z-50 rounded-xl bg-card border border-border shadow-xl p-1 overflow-hidden"
                                            >
                                                {RANGE_OPTIONS.map((opt) => {
                                                    const active = range === opt.value;
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setRange(opt.value);
                                                                setDropdownOpen(false);
                                                            }}
                                                            className={`w-full h-8 sm:h-9 px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors duration-150 flex items-center justify-between text-left cursor-pointer ${
                                                                active 
                                                                    ? "bg-primary/10 text-primary" 
                                                                    : "text-foreground hover:bg-muted"
                                                            }`}
                                                        >
                                                            <span>{opt.label}</span>
                                                            {active && <Check className="h-3.5 w-3.5 text-primary" />}
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Media Quality & Download Action */}
                            <div className="md:col-span-6 space-y-2 sm:space-y-3.5 flex flex-col justify-between">
                                {/* Media Quality Segment Control */}
                                <div className="rounded-xl sm:rounded-2xl border border-border bg-muted/30 p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                                            Media Quality
                                        </label>
                                        <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                                            {quality === "low" ? "150px (Small)" : quality === "medium" ? "300px (HD)" : "600px (Print)"}
                                        </span>
                                    </div>
                                    <div className="relative grid grid-cols-3 gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-muted border border-border">
                                        {(["low", "medium", "high"] as const).map((q) => (
                                            <button
                                                key={q}
                                                type="button"
                                                onClick={() => setQuality(q)}
                                                className={`relative z-10 h-7.5 sm:h-9 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold capitalize transition-colors duration-200 flex items-center justify-center gap-1 whitespace-nowrap px-1.5 sm:px-2 cursor-pointer ${
                                                    quality === q ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {quality === q && (
                                                    <motion.div
                                                        layoutId="activeQualityPill"
                                                        className="absolute inset-0 rounded-md sm:rounded-lg bg-background shadow-sm border border-border/50"
                                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                                    />
                                                )}
                                                <span className="relative z-10">{q}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Download Action Button */}
                                <div className="space-y-1.5 sm:space-y-2">
                                    {isGenerating && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 text-[11px] sm:text-xs font-semibold text-primary flex items-center gap-2"
                                        >
                                            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin shrink-0" />
                                            <span>{progressStage}</span>
                                        </motion.div>
                                    )}

                                    <motion.button
                                        type="button"
                                        onClick={handleInPlaceDownload}
                                        disabled={isGenerating}
                                        whileHover={{ scale: 1.015 }}
                                        whileTap={{ scale: 0.985 }}
                                        className="w-full h-10 sm:h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-base transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                <span>Downloading File...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                                                <span>Download My Data File</span>
                                            </>
                                        )}
                                    </motion.button>

                                    <p className="text-center text-[10px] sm:text-[11px] text-muted-foreground flex items-center justify-center gap-1 flex-wrap">
                                        <span>Instant direct download • Safe & private •</span>
                                        <Link href="/privacy" className="text-primary underline underline-offset-2 font-semibold hover:text-primary/80">
                                            GDPR & CCPA Policy (Max 3/hr)
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Viewport Parity */}
            <div className="shrink-0 hidden md:block">
                <HomeFooter />
            </div>
            <div className="shrink-0 block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}

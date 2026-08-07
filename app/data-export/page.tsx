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
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`Data archive downloaded: ${filename}`);
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
        <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-background text-foreground selection:bg-primary selection:text-white">
            <TopNavbar isCreateDisabled={false} />

            <main className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-4 sm:px-6 py-4 md:py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground">Checking session...</p>
                    </div>
                ) : !user ? (
                    /* 🔒 GUEST ACCESS NOTICE (Animated & Responsive) */
                    <motion.div 
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5 max-w-lg mx-auto text-center my-auto"
                    >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Lock className="h-7 w-7" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                Sign In to Download Your Data
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                Guest sessions are temporary. To save and download a full report of your links and analytics, please log in or create a free XURL account.
                            </p>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm transition shadow-sm"
                            >
                                Sign In / Register Free
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/guest-policy"
                                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-sm text-foreground transition"
                            >
                                View Guest Policy
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    /* 📦 AUTHENTICATED DATA DOWNLOAD PORTAL (Smooth Micro-Animations & Responsive) */
                    <motion.div 
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-5 my-auto"
                    >
                        {/* Friendly Page Header */}
                        <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    Download Your Data
                                </h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                    Get a complete copy of your XURL links, click statistics, and account details.
                                </p>
                            </div>
                            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border shrink-0 font-mono">
                                {user.email}
                            </span>
                        </div>

                        {/* Simple Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Animated Format Segment Control */}
                            <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-primary" />
                                    File Format
                                </label>
                                <div className="relative grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setFormat("html")}
                                        className={`relative z-10 h-9 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap px-2 ${
                                            format === "html" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {format === "html" && (
                                            <motion.div
                                                layoutId="activeFormatPill"
                                                className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                            />
                                        )}
                                        <FileText className="relative z-10 h-3.5 w-3.5 shrink-0" />
                                        <span className="relative z-10">HTML</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormat("json")}
                                        className={`relative z-10 h-9 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap px-2 ${
                                            format === "json" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {format === "json" && (
                                            <motion.div
                                                layoutId="activeFormatPill"
                                                className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                            />
                                        )}
                                        <FileArchive className="relative z-10 h-3.5 w-3.5 shrink-0" />
                                        <span className="relative z-10">JSON</span>
                                    </button>
                                </div>
                            </div>

                            {/* Custom Smooth Animated Dropdown */}
                            <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2 relative" ref={dropdownRef}>
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    Date Range
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="w-full h-10 rounded-xl bg-background border border-border px-3.5 text-xs font-semibold text-foreground hover:border-primary/50 transition-all duration-200 flex items-center justify-between shadow-sm cursor-pointer"
                                >
                                    <span className="truncate">{selectedRangeLabel}</span>
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                                </button>

                                <AnimatePresence>
                                    {dropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                            transition={{ duration: 0.18, ease: "easeOut" }}
                                            className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-card border border-border shadow-xl p-1 overflow-hidden"
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
                                                        className={`w-full h-9 px-3 rounded-lg text-xs font-semibold transition-colors duration-150 flex items-center justify-between text-left ${
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

                        {/* Media & Asset Quality Option (Facebook-style) */}
                        <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <ImageIcon className="h-4 w-4 text-primary" />
                                    Media & Image Quality
                                </label>
                                <span className="text-[11px] text-muted-foreground">
                                    {quality === "low" ? "150px (Small Size)" : quality === "medium" ? "300px (Standard HD)" : "600px (Print Ready)"}
                                </span>
                            </div>
                            <div className="relative grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted border border-border">
                                <button
                                    type="button"
                                    onClick={() => setQuality("low")}
                                    className={`relative z-10 h-9 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 whitespace-nowrap px-2 cursor-pointer ${
                                        quality === "low" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {quality === "low" && (
                                        <motion.div
                                            layoutId="activeQualityPill"
                                            className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10">Low</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setQuality("medium")}
                                    className={`relative z-10 h-9 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 whitespace-nowrap px-2 cursor-pointer ${
                                        quality === "medium" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {quality === "medium" && (
                                        <motion.div
                                            layoutId="activeQualityPill"
                                            className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10">Medium</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setQuality("high")}
                                    className={`relative z-10 h-9 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 whitespace-nowrap px-2 cursor-pointer ${
                                        quality === "high" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {quality === "high" && (
                                        <motion.div
                                            layoutId="activeQualityPill"
                                            className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10">High</span>
                                </button>
                            </div>
                        </div>

                        {/* Animated Download Action Button */}
                        <div className="pt-2 space-y-2">
                            {isGenerating && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary flex items-center gap-2.5"
                                >
                                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                    <span>{progressStage}</span>
                                </motion.div>
                            )}

                            <motion.button
                                type="button"
                                onClick={handleInPlaceDownload}
                                disabled={isGenerating}
                                whileHover={{ scale: 1.015 }}
                                whileTap={{ scale: 0.985 }}
                                className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm sm:text-base transition-all duration-200 shadow-md flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Downloading File...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-5 w-5" />
                                        <span>Download My Data File</span>
                                    </>
                                )}
                            </motion.button>

                            <p className="text-center text-[11px] text-muted-foreground">
                                Instant direct download • Safe & private
                            </p>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Viewport Parity: HomeFooter on Desktop, MobileFooter on Mobile */}
            <div className="hidden md:block">
                <HomeFooter />
            </div>
            <div className="block md:hidden">
                <MobileFooter />
            </div>
        </div>
    );
}



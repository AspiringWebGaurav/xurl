"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface ConfirmLinkModalProps {
    confirmLink: string | null;
    setConfirmLink: (link: string | null) => void;
}

export function ConfirmLinkModal({ confirmLink, setConfirmLink }: ConfirmLinkModalProps) {
    const router = useRouter();

    const handleCancel = () => {
        setConfirmLink(null);
    };

    const handleConfirmNewTab = () => {
        if (confirmLink) {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([30, 50, 30]);
            }
            window.open(confirmLink, "_blank", "noopener,noreferrer");
            setConfirmLink(null);
        }
    };

    const handleConfirmSameTab = () => {
        if (confirmLink) {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([30]);
            }
            router.push(confirmLink);
            setConfirmLink(null);
        }
    };

    return (
        <AnimatePresence>
            {confirmLink && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 dark:bg-black/70 backdrop-blur-md p-5"
                    onClick={handleCancel}
                >
                    <motion.div
                        initial={{ scale: 0.94, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.94, opacity: 0, y: 15 }}
                        transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                        className="w-full max-w-[340px] bg-card/85 dark:bg-card/75 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_-15px_rgba(16,185,129,0.25)] p-6 flex flex-col gap-5 overflow-hidden relative transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex flex-col items-center text-center gap-3 relative z-10">
                            <div className="w-14 h-14 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-sm mb-1 text-emerald-600 dark:text-emerald-400">
                                <ExternalLink className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                                Open Link
                            </h3>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                                How would you like to open this link?
                            </p>
                        </div>

                        <div className="flex flex-col gap-2.5 mt-1 relative z-10">
                            <button
                                onClick={handleConfirmNewTab}
                                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-[0_8px_25px_-6px_rgba(16,185,129,0.45)] hover:shadow-[0_12px_30px_-5px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                            >
                                Open in New Tab
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 h-11 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold text-sm hover:bg-slate-200/90 dark:hover:bg-slate-700/90 transition-all active:scale-[0.97] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSameTab}
                                    className="flex-1 h-11 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 font-semibold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all active:scale-[0.97] cursor-pointer"
                                >
                                    Open Here
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

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
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-5"
                    onClick={handleCancel}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 15 }}
                        transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                        className="w-full max-w-[320px] bg-card border border-border rounded-[24px] shadow-2xl p-6 flex flex-col gap-5 overflow-hidden relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex flex-col items-center text-center gap-3 relative z-10">
                            <div className="w-14 h-14 bg-emerald-50/80 rounded-full flex items-center justify-center border border-emerald-100/50 shadow-sm mb-1">
                                <ExternalLink className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight text-foreground">
                                Open Link
                            </h3>
                            <p className="text-[13px] text-muted-foreground leading-relaxed px-2">
                                How would you like to open this link?
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 mt-1 relative z-10">
                            <button
                                onClick={handleConfirmNewTab}
                                className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-[0_4px_14px_0_rgba(5,150,105,0.39)] transition-all active:scale-[0.97]"
                            >
                                Open in New Tab
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 h-11 rounded-xl bg-muted/80 text-muted-foreground font-semibold text-sm hover:bg-muted transition-colors active:scale-[0.97]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSameTab}
                                    className="flex-1 h-11 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition-colors active:scale-[0.97]"
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

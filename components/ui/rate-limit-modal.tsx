"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface RateLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    retryAfterSeconds?: number;
}

export function RateLimitModal({ isOpen, onClose, retryAfterSeconds = 60 }: RateLimitModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border shadow-xl rounded-xl">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col w-full"
                        >
                            {/* Header Section */}
                            <div className="relative w-full h-32 bg-amber-50/50 flex flex-col items-center justify-center overflow-hidden border-b border-border">
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-100/40 via-transparent to-amber-50/20" />
                                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl" />
                                <div className="relative w-14 h-14 rounded-2xl bg-white border border-amber-200 shadow-sm flex items-center justify-center">
                                    <ShieldAlert className="w-7 h-7 text-amber-500" />
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="p-6 md:p-8 flex flex-col items-center text-center">
                                <h3 className="text-xl font-semibold text-foreground tracking-tight mb-2">
                                    Whoa there, slow down!
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                    We've detected an unusually high number of requests from your network. To protect our service, we've temporarily paused link creation.
                                </p>

                                {/* Cooldown Indicator */}
                                <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-muted/50 rounded-lg border border-border mb-6">
                                    <Clock className="w-4 h-4 text-emerald-600" />
                                    <span className="text-sm font-medium text-foreground">
                                        Please try again in about {retryAfterSeconds} seconds
                                    </span>
                                </div>

                                <Button
                                    onClick={onClose}
                                    className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium rounded-lg shadow-sm"
                                >
                                    Understood
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}

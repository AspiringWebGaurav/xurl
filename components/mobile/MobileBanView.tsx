"use client";

import { ShieldAlert, Send, Loader2 } from "lucide-react";
import { User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

interface MobileBanViewProps {
    banReason: string;
    user?: User | null;
    appealText?: string;
    setAppealText?: (text: string) => void;
    appealLoading?: boolean;
    hasPendingAppeal?: boolean;
    submitAppeal?: () => Promise<void>;
}

export function MobileBanView({
    banReason,
    user,
    appealText = "",
    setAppealText,
    appealLoading = false,
    hasPendingAppeal = false,
    submitAppeal
}: MobileBanViewProps) {
    return (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-rose-950 overflow-hidden h-[100dvh]">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

            <div className="flex-1 flex flex-col w-full max-w-sm mx-auto px-5 py-4 relative z-10">

                {/* Header - Compact */}
                <div className="text-center mb-4 mt-2 flex flex-col items-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 shadow-inner border border-rose-500/20 mb-3">
                        <ShieldAlert className="h-6 w-6 text-rose-500" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">
                        Account Suspended
                    </h1>
                    <p className="text-xs text-rose-200/90 leading-relaxed px-4">
                        Your access is restricted due to policy violations.
                    </p>
                </div>

                {/* Ban Reason - Compact */}
                {banReason && (
                    <div className="mb-4 rounded-xl border border-rose-800/60 bg-rose-950/60 p-3 backdrop-blur-sm">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-1">Reason</p>
                        <p className="text-xs font-medium text-rose-50 line-clamp-2">{banReason}</p>
                    </div>
                )}

                {/* Appeals Section - Takes remaining space */}
                <div className="flex-1 min-h-0 flex flex-col bg-black/30 rounded-2xl p-4 border border-white/5 shadow-inner mb-4">
                    <div className="mb-3 shrink-0">
                        <h2 className="text-lg font-semibold text-white mb-1">Submit an Appeal</h2>
                        <p className="text-[11px] text-rose-200/60 leading-relaxed">
                            Think this is an error? Submit an appeal for manual review.
                        </p>
                    </div>

                    {hasPendingAppeal ? (
                        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 shadow-inner flex-1 flex flex-col justify-center text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-sm font-medium text-emerald-400">Appeal Under Review</p>
                            </div>
                            <p className="text-xs text-emerald-500/90 leading-relaxed px-2">
                                Your appeal is pending manual review by our team.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 flex flex-col min-h-0 mb-3">
                                <textarea
                                    value={appealText}
                                    onChange={(e) => setAppealText?.(e.target.value)}
                                    placeholder="Explain why your account should be reinstated..."
                                    className={`w-full flex-1 rounded-xl border bg-black/50 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 transition-all resize-none shadow-inner ${(() => {
                                            const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;
                                            const hasAbuse = abusePattern.test(appealText);
                                            if (hasAbuse) return 'border-red-500 focus:border-red-500 focus:ring-red-500';
                                            return 'border-white/10 focus:border-rose-500 focus:ring-rose-500';
                                        })()
                                        }`}
                                />
                                <div className="mt-1.5 flex justify-between items-center text-[9px] px-1 shrink-0">
                                    {(() => {
                                        const minLength = 20;
                                        const currentLength = appealText.trim().length;
                                        const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;

                                        if (abusePattern.test(appealText)) {
                                            return <span className="text-red-400 font-medium">Inappropriate language.</span>;
                                        } else if (currentLength > 0 && currentLength < minLength) {
                                            return <span className="text-amber-400/80">Min {minLength} chars ({currentLength}/{minLength}).</span>;
                                        } else {
                                            return <span className="text-rose-200/40">Be specific.</span>;
                                        }
                                    })()}
                                </div>
                            </div>
                            <button
                                onClick={submitAppeal}
                                disabled={
                                    appealLoading ||
                                    appealText.trim().length < 20 ||
                                    /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i.test(appealText)
                                }
                                className="shrink-0 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-rose-950 transition active:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {appealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Submit Appeal</>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Bottom Actions - Sticky at bottom */}
                <div className="shrink-0 pt-3 border-t border-rose-900/50">
                    {user && (
                        <button
                            onClick={async () => {
                                await signOut(auth);
                                window.location.href = "/";
                            }}
                            className="w-full rounded-xl border border-rose-800/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-rose-200 transition active:bg-rose-950/50 active:text-white"
                        >
                            Sign out of this account
                        </button>
                    )}
                    <p className="text-[9px] text-center text-rose-300/40 mt-3 px-2 leading-relaxed">
                        Zero-tolerance policy for abuse & TOS violations.
                    </p>
                </div>

            </div>
        </div>
    );
}

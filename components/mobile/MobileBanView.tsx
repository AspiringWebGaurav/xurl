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
        <div className="fixed inset-0 z-[99999] flex flex-col bg-rose-950 overflow-y-auto">
            <div className="flex-1 flex flex-col px-5 py-8 relative min-h-screen">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                
                <div className="w-full max-w-sm mx-auto relative z-10 flex flex-col h-full">
                    
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 shadow-inner border border-rose-500/20 mb-6">
                            <ShieldAlert className="h-8 w-8 text-rose-500" />
                        </div>
                        
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
                            Account Suspended
                        </h1>
                        <p className="text-sm text-rose-200/90 leading-relaxed">
                            Your access to XURL has been strictly restricted by an administrator due to violations of our policies.
                        </p>
                    </div>
                    
                    {/* Ban Reason */}
                    {banReason && (
                        <div className="mb-8 rounded-2xl border border-rose-800/60 bg-rose-950/60 p-5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-2">Reason for Suspension</p>
                            <p className="text-sm font-medium text-rose-50">{banReason}</p>
                        </div>
                    )}

                    {/* Appeals Section */}
                    <div className="mb-8 bg-black/30 rounded-3xl p-5 border border-white/5 shadow-inner">
                        <div className="mb-5">
                            <h2 className="text-xl font-semibold text-white mb-2">Submit an Appeal</h2>
                            <p className="text-xs text-rose-200/60 leading-relaxed">
                                If you believe this was an error, you may submit a formal appeal. Our trust and safety team reviews appeals manually.
                            </p>
                        </div>

                        {hasPendingAppeal ? (
                            <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 shadow-inner">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <p className="text-sm font-medium text-emerald-400">Appeal Under Review</p>
                                </div>
                                <p className="text-xs text-emerald-500/90 leading-relaxed">
                                    Your appeal has been successfully submitted and is currently pending manual review.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <textarea
                                        value={appealText}
                                        onChange={(e) => setAppealText?.(e.target.value)}
                                        placeholder="Explain why your account should be reinstated..."
                                        className={`w-full rounded-xl border bg-black/50 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 transition-all resize-none shadow-inner min-h-[120px] ${
                                            (() => {
                                                const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;
                                                const hasAbuse = abusePattern.test(appealText);
                                                if (hasAbuse) return 'border-red-500 focus:border-red-500 focus:ring-red-500';
                                                return 'border-white/10 focus:border-rose-500 focus:ring-rose-500';
                                            })()
                                        }`}
                                    />
                                    <div className="mt-2 flex justify-between items-center text-[10px] px-1">
                                        {(() => {
                                            const minLength = 20;
                                            const currentLength = appealText.trim().length;
                                            const abusePattern = /(?:fuck|shit|bitch|cunt|asshole|bastard|dick|slut|whore)/i;
                                            const hasAbuse = abusePattern.test(appealText);
                                            
                                            if (hasAbuse) {
                                                return <span className="text-red-400 font-medium">Inappropriate language detected.</span>;
                                            } else if (currentLength > 0 && currentLength < minLength) {
                                                return <span className="text-amber-400/80">Minimum {minLength} chars ({currentLength}/{minLength}).</span>;
                                            } else {
                                                return <span className="text-rose-200/40">Be detailed and specific.</span>;
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
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-950 transition active:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {appealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Submit Appeal</>}
                                </button>
                            </div>
                        )}
                    </div>


                    {/* Bottom Actions */}
                    <div className="mt-auto pt-6 border-t border-rose-900/50">
                        {user ? (
                            <button 
                                onClick={async () => {
                                    await signOut(auth);
                                    window.location.href = "/";
                                }}
                                className="w-full rounded-xl border border-rose-800/50 bg-transparent px-5 py-3 text-sm font-semibold text-rose-200 transition active:bg-rose-950/50 active:text-white"
                            >
                                Sign out of this account
                            </button>
                        ) : (
                            <button 
                                onClick={() => {
                                    window.location.href = "/";
                                }}
                                className="w-full rounded-xl border border-rose-800/50 bg-transparent px-5 py-3 text-sm font-semibold text-rose-200 transition active:bg-rose-950/50 active:text-white"
                            >
                                Back to Home
                            </button>
                        )}
                        <p className="text-[10px] text-center text-rose-300/40 mt-4 px-4 leading-relaxed">
                            XURL maintains a zero-tolerance policy for abuse, malicious links, and violations of our Terms of Service.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}

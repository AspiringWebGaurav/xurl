"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Copy, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/config";
import { getDeviceFingerprint, getOrCreateGuestSessionId } from "@/lib/utils/fingerprint";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { getPlanConfig } from "@/lib/plans";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onLinksChange?: (count: number) => void;
}

interface LinkItem {
    slug: string;
    originalUrl: string;
    createdAt: number;
    expiresAt: number | null;
}

export function HistorySidebar({ isOpen, onClose, userId, onLinksChange }: HistorySidebarProps) {
    const pathname = usePathname();
    const isAdminPage = pathname?.startsWith("/admin");
    const [mounted, setMounted] = useState(false);
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [userPlan, setUserPlan] = useState<string | null>(null);
    const [userLimit, setUserLimit] = useState<number | null>(null);
    const [forceSync, setForceSync] = useState(0);
    const [dynamicConfig, setDynamicConfig] = useState<any>(null);
    const linksRef = useRef<LinkItem[]>([]);
    
    useEffect(() => {
        setMounted(true);
        let isSubscribed = true;
        fetch("/api/config/public")
            .then(res => res.json())
            .then(data => {
                if (isSubscribed && data.config) setDynamicConfig(data.config);
            })
            .catch(console.error);
        return () => { isSubscribed = false; };
    }, []);

    const baseConfig = getPlanConfig(userPlan);
    const currentPlanConfig = {
        ...baseConfig,
        ...(dynamicConfig?.plans?.[userPlan || "free"] || {})
    };

    useEffect(() => {
        linksRef.current = links;
    }, [links]);

    useEffect(() => {
        let unsub = () => {};
        
        const setupSync = async () => {
            setLoading(true);
            try {
                const currentUser = auth.currentUser;
                const { collection, query, where, orderBy, limit, onSnapshot, getFirestore } = await import("firebase/firestore");
                const db = getFirestore();
                
                if (currentUser) {
                    const token = await currentUser.getIdToken();
                    
                    // Fetch primary verified links & plan metadata from server API endpoint
                    try {
                        const apiRes = await fetch(`/api/links?pageSize=50`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const apiData = await apiRes.json();
                        if (apiData.plan) {
                            setUserPlan(apiData.plan.toLowerCase());
                        }
                        if (typeof apiData.limit === "number") {
                            setUserLimit(apiData.limit);
                        }
                        if (Array.isArray(apiData.links)) {
                            const apiLinks: LinkItem[] = apiData.links.map((link: any) => ({
                                slug: link.slug,
                                originalUrl: link.originalUrl,
                                createdAt: link.createdAt,
                                expiresAt: link.expiresAt || null,
                            }));
                            setLinks(apiLinks);
                            onLinksChange?.(apiLinks.length);
                        }
                    } catch (err) {
                        console.error("API links fetch error:", err);
                    }
                    
                    // Setup real-time listener for newly added links
                    const q = query(
                        collection(db, "links"),
                        where("userId", "==", currentUser.uid),
                        orderBy("createdAt", "desc"),
                        limit(50)
                    );
                    
                    unsub = onSnapshot(q, (snapshot) => {
                        const newLinks = snapshot.docs.map(doc => ({
                            slug: doc.id,
                            originalUrl: doc.data().originalUrl,
                            createdAt: doc.data().createdAt,
                            expiresAt: doc.data().expiresAt || null
                        }));
                        setLinks(newLinks);
                        onLinksChange?.(newLinks.length);
                        setLoading(false);
                    }, (err) => {
                        console.error("History sync error:", err);
                        setLoading(false);
                    });
                } else {
                    setUserPlan("guest");
                    setUserLimit(currentPlanConfig.limit || 1);
                    try {
                        const rawHistory = localStorage.getItem("xurl_guest_link_history_v2");
                        if (rawHistory) {
                            const parsed = JSON.parse(rawHistory);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setLinks(parsed);
                                onLinksChange?.(parsed.length);
                            } else {
                                setLinks([]);
                                onLinksChange?.(0);
                            }
                        } else {
                            setLinks([]);
                            onLinksChange?.(0);
                        }
                    } catch (e) {
                        console.error("Guest history parse error:", e);
                        setLinks([]);
                        onLinksChange?.(0);
                    }
                    setLoading(false);
                }
            } catch (e) {
                console.error("Failed to setup history sync:", e);
                setLoading(false);
            }
        };

        if (isOpen) {
            void setupSync();
        }

        return () => unsub();
    }, [isOpen, userId, onLinksChange, forceSync, isAdminPage]);

    // Listen for new links generated in the background
    useEffect(() => {
        const handleLinkGenerated = () => {
            setForceSync(f => f + 1);
        };

        window.addEventListener("linkGenerated", handleLinkGenerated);
        return () => window.removeEventListener("linkGenerated", handleLinkGenerated);
    }, []);

    const handleCopy = async (slug: string) => {
        const url = `${window.location.origin}/${slug}`;
        await navigator.clipboard.writeText(url);
        setCopied(slug);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!mounted || isAdminPage) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm pointer-events-auto"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-[10000] flex h-full h-screen max-h-screen w-full max-w-md flex-col border-l border-slate-200 bg-white text-slate-900 shadow-[0_0_60px_rgba(0,0,0,0.25)] pointer-events-auto overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
                            <div>
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Recent Links</h2>
                                {userPlan && userPlan !== "guest" && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                            userPlan === "free" ? "bg-slate-100 text-slate-700 border border-slate-200" :
                                            "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                                        }`}>
                                            {currentPlanConfig.label || userPlan} PLAN
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-500">
                                            {links.length} / {userLimit !== null ? userLimit : (currentPlanConfig.limit || "∞")} links
                                        </span>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide bg-slate-50/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {loading ? (
                                <div className="flex flex-col justify-center items-center h-full gap-2 text-slate-400 font-bold text-xs">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                    <span>Syncing link history…</span>
                                </div>
                            ) : links.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600 shadow-inner">
                                        <ExternalLink className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-base font-black text-slate-900 mb-1">
                                        {userPlan === "guest" ? "No links found" : "Ready to shorten links?"}
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-500 mb-6 max-w-[220px] leading-relaxed">
                                        {userPlan === "guest" ? `Guests can create ${currentPlanConfig.limit} free temporary link. Try it out!` :
                                         userPlan === "free" ? `You have ${currentPlanConfig.maxUses || currentPlanConfig.limit} free links available on Free plan.` :
                                         `You have ${currentPlanConfig.limit} links capacity on your active ${currentPlanConfig.label} plan.`}
                                    </p>
                                    <Button 
                                        onClick={() => {
                                            onClose();
                                            if (window.location.pathname !== "/") {
                                                window.location.href = "/?focus=true";
                                            } else {
                                                window.dispatchEvent(new Event("focusUrlInput"));
                                            }
                                        }}
                                        className={`rounded-2xl h-11 px-5 text-xs font-black shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                            userPlan === "guest" ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300" :
                                            userPlan === "free" ? "bg-slate-900 hover:bg-slate-800 text-white" :
                                            "bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white shadow-indigo-500/20"
                                        }`}
                                    >
                                        {userPlan === "guest" ? "Create your free link" :
                                         userPlan === "free" ? `Create ${currentPlanConfig.maxUses || currentPlanConfig.limit} free links` :
                                         `Create custom ${currentPlanConfig.label} link`}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3.5">
                                    {links.map((link) => {
                                        const fullShortUrl = buildShortUrl(link.slug);
                                        const shortUrlDisplay = fullShortUrl.replace(/^https?:\/\//, '');
                                        const isExpired = link.expiresAt && link.expiresAt < Date.now();

                                        return (
                                            <div key={link.slug} className={`group relative p-4 rounded-2xl border transition-all duration-200 hover:shadow-md ${isExpired ? 'border-red-200 bg-red-50/60 opacity-80' : 'border-slate-200/90 bg-white hover:border-indigo-300 shadow-2xs'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <a href={`/${link.slug}`} target="_blank" rel="noreferrer" className="text-xs font-black text-indigo-950 truncate mr-2 transition-colors group-hover:text-indigo-600">
                                                        {shortUrlDisplay}
                                                    </a>
                                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="outline" size="icon" className="h-7 w-7 bg-slate-50 border-slate-200 rounded-lg hover:bg-slate-100" asChild>
                                                            <a href={`/${link.slug}`} target="_blank" rel="noreferrer" title="Open link">
                                                                <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                                                            </a>
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-7 w-7 bg-slate-50 border-slate-200 rounded-lg hover:bg-slate-100" onClick={() => handleCopy(link.slug)}>
                                                            {copied === link.slug ? <span className="text-[10px] text-emerald-600 font-black">✓</span> : <Copy className="h-3.5 w-3.5 text-slate-600" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center text-[11px] font-medium text-slate-500 gap-1.5 mb-2.5 truncate">
                                                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                                                    <a href={`/r?dest=${encodeURIComponent(link.originalUrl)}`} target="_blank" rel="noreferrer" className="truncate text-slate-600 hover:text-slate-900 transition-colors">
                                                        {link.originalUrl}
                                                    </a>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-2 border-t border-slate-100">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-slate-400" />
                                                        {new Date(link.createdAt).toLocaleDateString()}
                                                    </span>
                                                    {isExpired ? (
                                                        <span className="text-red-600 font-black">Expired</span>
                                                    ) : (
                                                        <span>{link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : <span className="flex items-center gap-1 text-emerald-600 font-bold">Never expires ∞</span>}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {userPlan === "guest" && (
                                <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                                    <p className="text-[11px] font-semibold text-slate-400">
                                        Review our <a href="/guest-policy" className="text-indigo-600 font-bold hover:underline underline-offset-2 transition-colors">Guest Policy</a>
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

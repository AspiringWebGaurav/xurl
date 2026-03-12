"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Copy, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/config";
import { getDeviceFingerprint } from "@/lib/utils/fingerprint";
import { buildShortUrl } from "@/lib/utils/url-builder";

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

interface LinkItem {
    slug: string;
    originalUrl: string;
    createdAt: number;
    expiresAt: number | null;
}

export function HistorySidebar({ isOpen, onClose, userId }: HistorySidebarProps) {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [userPlan, setUserPlan] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchLinks();
        }
    }, [isOpen, userId]);

    // Listen for new links generated in the background
    useEffect(() => {
        const handleLinkGenerated = () => fetchLinks(false);

        window.addEventListener("linkGenerated", handleLinkGenerated);
        return () => window.removeEventListener("linkGenerated", handleLinkGenerated);
    }, [userId]);

    const fetchLinks = async (isLoadMore = false) => {
        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        try {
            const currentUser = auth.currentUser;
            let fetchedLinks: LinkItem[] = [];
            let fetchedHasMore = false;

            const cursorParam = isLoadMore && links.length > 0 ? `&cursor=${links[links.length - 1].createdAt}` : "";

            if (currentUser) {
                const token = await currentUser.getIdToken();
                const res = await fetch(`/api/links?pageSize=25${cursorParam}`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.links) {
                    fetchedLinks = data.links;
                }
                if (data.hasMore !== undefined) {
                    fetchedHasMore = data.hasMore;
                }
                if (data.plan) {
                    setUserPlan(data.plan);
                } else {
                    setUserPlan("free");
                }
            } else {
                if (!isLoadMore) {
                    // Fetch live server state for unauthenticated guest
                    setUserPlan("guest");
                    const fp = await getDeviceFingerprint();
                    const res = await fetch("/api/guest-status", {
                        headers: { "x-device-fingerprint": fp },
                    });
                    const data = await res.json();

                    if (data.active && data.slug) {
                        fetchedLinks.push({
                            slug: data.slug,
                            originalUrl: data.originalUrl || "Original URL hidden for guests",
                            createdAt: data.createdAt || Date.now(),
                            expiresAt: Date.now() + (data.expiresIn * 1000)
                        });
                    }
                }
            }

            if (isLoadMore) {
                setLinks(prev => [...prev, ...fetchedLinks]);
            } else {
                setLinks(fetchedLinks);
            }
            setHasMore(fetchedHasMore);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleCopy = async (slug: string) => {
        const url = `${window.location.origin}/${slug}`;
        await navigator.clipboard.writeText(url);
        setCopied(slug);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 pointer-events-auto"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full max-w-sm bg-card border-l border-border shadow-2xl z-50 flex flex-col pointer-events-auto"
                    >
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <h2 className="text-lg font-semibold tracking-tight">Recent Links</h2>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : links.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                                        <ExternalLink className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-900 mb-1">
                                        {userPlan === "guest" ? "No links found" : 
                                         userPlan === "free" ? "Ready to create?" : 
                                         "Your dashboard is empty"}
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-6 max-w-[200px]">
                                        {userPlan === "guest" ? "Guests can create 1 free temporary link. Try it out!" :
                                         userPlan === "free" ? "You have 1 free permanent link available. Create it now!" :
                                         `Make the most of your ${userPlan} plan by creating your first custom link!`}
                                    </p>
                                    <Button 
                                        onClick={() => {
                                            onClose();
                                            // Handle cross-page navigation focus vs same-page focus
                                            if (window.location.pathname !== "/") {
                                                window.location.href = "/?focus=true";
                                            } else {
                                                window.dispatchEvent(new Event("focusUrlInput"));
                                            }
                                        }}
                                        className={`rounded-lg shadow-sm font-medium ${
                                            userPlan === "guest" ? "bg-amber-100 hover:bg-amber-200 text-amber-900" :
                                            userPlan === "free" ? "bg-slate-900 hover:bg-slate-800 text-white" :
                                            "bg-emerald-600 hover:bg-emerald-700 text-white"
                                        }`}
                                    >
                                        {userPlan === "guest" ? "Create your free link" :
                                         userPlan === "free" ? "Create 1 free link" :
                                         `Create ${userPlan} link`}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {links.map((link) => {
                                        const fullShortUrl = buildShortUrl(link.slug);
                                        const shortUrlDisplay = fullShortUrl.replace(/^https?:\/\//, '');
                                        const isExpired = link.expiresAt && link.expiresAt < Date.now();

                                        return (
                                            <div key={link.slug} className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${isExpired ? 'border-red-100 bg-red-50/50 opacity-75' : 'border-border bg-background hover:bg-muted/30 hover:border-foreground/20'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <a href={`/${link.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-foreground truncate mr-2 transition-colors group-hover:text-emerald-600">
                                                        {shortUrlDisplay}
                                                    </a>
                                                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="outline" size="icon" className="h-7 w-7 bg-background shadow-sm hover:bg-muted" asChild>
                                                            <a href={`/${link.slug}`} target="_blank" rel="noreferrer" title="Open link">
                                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                                            </a>
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-7 w-7 bg-background shadow-sm hover:bg-muted" onClick={() => handleCopy(link.slug)}>
                                                            {copied === link.slug ? <span className="text-[10px] text-emerald-500 font-bold">✓</span> : <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center text-xs text-muted-foreground gap-1.5 mb-2 truncate">
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                    <a href={`/r?dest=${encodeURIComponent(link.originalUrl)}`} target="_blank" rel="noreferrer" className="truncate text-foreground/70 transition-colors hover:text-foreground">
                                                        {link.originalUrl}
                                                    </a>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 mt-3 border-t border-border/50 pt-2">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(link.createdAt).toLocaleDateString()}
                                                    </span>
                                                    {isExpired ? (
                                                        <span className="text-red-500 font-medium">Expired</span>
                                                    ) : (
                                                        <span>{link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Never expires'}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {hasMore && (
                                        <div className="pt-2 pb-6 flex justify-center">
                                            <Button 
                                                variant="outline" 
                                                className="w-full bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium disabled:opacity-50"
                                                onClick={() => fetchLinks(true)}
                                                disabled={loadingMore}
                                            >
                                                {loadingMore ? (
                                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
                                                ) : "Load More"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

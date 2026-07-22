"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Loader2, Save, IndianRupee, Link2, Clock } from "lucide-react";
import { PLAN_CONFIGS, PAID_PLAN_ORDER, PlanType } from "@/lib/plans";
import { auth } from "@/lib/firebase/config";

const fetcher = async (url: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    return data.config;
};

interface DynamicConfig {
    plans: Record<string, { priceINR?: number; limit?: number; ttlMs?: number }>;
    offers: any[];
}

export default function PlansConfigPage() {
    const { data: remoteConfig, error, isLoading, mutate } = useSWR<DynamicConfig>("/api/admin/config", fetcher);
    
    // We maintain a local copy of config for editing, which syncs with remote data when loaded
    const [localConfig, setLocalConfig] = useState<DynamicConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState("");

    // Sync remote data to local state when it loads
    if (remoteConfig && !localConfig) {
        setLocalConfig(remoteConfig);
    }

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const user = auth.currentUser;
            if (!user) return;
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ config: localConfig })
            });
            
            if (res.ok) {
                setMessage("Plans configuration saved successfully! Synchronizing system TTLs...");
                mutate(localConfig || undefined); // Update SWR cache locally
                
                // Trigger background TTL sync
                setSyncing(true);
                try {
                    const syncRes = await fetch("/api/admin/sync-ttl", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const syncData = await syncRes.json();
                    if (syncRes.ok) {
                        setMessage(`Plans configuration saved! ${syncData.message}`);
                    } else {
                        setMessage("Configuration saved, but TTL sync encountered an error.");
                    }
                } catch (e) {
                    console.error(e);
                    setMessage("Configuration saved, but TTL sync failed.");
                } finally {
                    setSyncing(false);
                }
            } else {
                setMessage("Failed to save configuration.");
            }
        } catch (e) {
            console.error(e);
            setMessage("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    const updatePlan = (plan: string, field: string, value: number) => {
        setLocalConfig(prev => {
            if (!prev) return prev;
            const newPlans = { ...prev.plans };
            if (!newPlans[plan]) newPlans[plan] = {};
            (newPlans[plan] as any)[field] = value;
            return { ...prev, plans: newPlans };
        });
    };

    if (isLoading || !localConfig) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Plan Configuration</h1>
                    <p className="text-sm text-slate-500">Dynamically override base prices and limits for all plans.</p>
                </div>
                <Button onClick={handleSave} disabled={saving || syncing} className="bg-emerald-600 hover:bg-emerald-700">
                    {(saving || syncing) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {syncing ? "Syncing TTLs..." : saving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            {message && (
                <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
                    {message}
                </div>
            )}

            <div className="grid gap-6">
                {["guest", "free", ...PAID_PLAN_ORDER].map(planKey => {
                    const defaultCfg = PLAN_CONFIGS[planKey as PlanType];
                    const override = localConfig.plans[planKey] || {};
                    
                    return (
                        <div key={planKey} className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
                            <h2 className="text-xl font-bold capitalize text-slate-900 mb-6">{defaultCfg.label} Plan</h2>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700">Price (INR)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                            <IndianRupee className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input 
                                            type="number" 
                                            value={override.priceINR !== undefined ? override.priceINR : defaultCfg.priceINR}
                                            onChange={(e) => updatePlan(planKey, "priceINR", Number(e.target.value))}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[15px] font-medium text-slate-900 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                                        />
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-500">Default: ₹{defaultCfg.priceINR}</p>
                                </div>
                                
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700">Active Links Limit</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                            <Link2 className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input 
                                            type="number" 
                                            value={override.limit !== undefined ? override.limit : defaultCfg.limit}
                                            onChange={(e) => updatePlan(planKey, "limit", Number(e.target.value))}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[15px] font-medium text-slate-900 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                                        />
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-500">Default: {defaultCfg.limit}</p>
                                </div>
                                
                                {(() => {
                                    const ttlMs = override.ttlMs !== undefined ? override.ttlMs : defaultCfg.ttlMs;
                                    const totalSeconds = Math.floor(ttlMs / 1000);
                                    const h = Math.floor(totalSeconds / 3600);
                                    const m = Math.floor((totalSeconds % 3600) / 60);
                                    const s = totalSeconds % 60;
                                    
                                    const updateTTL = (newH: number, newM: number, newS: number) => {
                                        const newMs = (newH * 3600 + newM * 60 + newS) * 1000;
                                        updatePlan(planKey, "ttlMs", newMs);
                                    };

                                    return (
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-slate-700">Link Expiry (TTL)</label>
                                            <div className="relative flex items-center h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 transition-colors focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10">
                                                <div className="flex items-center pl-1 pr-2 pointer-events-none">
                                                    <Clock className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={h}
                                                    onChange={(e) => updateTTL(Number(e.target.value), m, s)}
                                                    className="w-12 bg-transparent text-center text-[15px] font-medium text-slate-900 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                                                />
                                                <span className="text-slate-400 text-sm mr-2 font-medium">h</span>
                                                <span className="text-slate-300">:</span>
                                                
                                                <input 
                                                    type="number" 
                                                    min="0" max="59"
                                                    value={m}
                                                    onChange={(e) => updateTTL(h, Number(e.target.value), s)}
                                                    className="w-10 bg-transparent text-center text-[15px] font-medium text-slate-900 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                                                />
                                                <span className="text-slate-400 text-sm mr-2 font-medium">m</span>
                                                <span className="text-slate-300">:</span>
                                                
                                                <input 
                                                    type="number" 
                                                    min="0" max="59"
                                                    value={s}
                                                    onChange={(e) => updateTTL(h, m, Number(e.target.value))}
                                                    className="w-10 bg-transparent text-center text-[15px] font-medium text-slate-900 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                                                />
                                                <span className="text-slate-400 text-sm pr-1 font-medium">s</span>
                                            </div>
                                            <p className="text-[13px] font-medium text-slate-500">
                                                Default: {Math.floor(defaultCfg.ttlMs / 3600000)}h {Math.floor((defaultCfg.ttlMs % 3600000) / 60000)}m {(defaultCfg.ttlMs % 60000) / 1000}s
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

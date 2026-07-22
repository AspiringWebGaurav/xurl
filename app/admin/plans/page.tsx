"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { PLAN_CONFIGS, PAID_PLAN_ORDER, PlanType } from "@/lib/plans";
import { auth } from "@/lib/firebase/config";

interface DynamicConfig {
    plans: Record<string, { priceINR?: number; limit?: number; ttlMs?: number }>;
    offers: any[];
}

export default function PlansConfigPage() {
    const [config, setConfig] = useState<DynamicConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/config", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setConfig(data.config);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

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
                body: JSON.stringify({ config })
            });
            
            if (res.ok) {
                setMessage("Plans configuration saved successfully!");
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
        setConfig(prev => {
            if (!prev) return prev;
            const newPlans = { ...prev.plans };
            if (!newPlans[plan]) newPlans[plan] = {};
            (newPlans[plan] as any)[field] = value;
            return { ...prev, plans: newPlans };
        });
    };

    if (loading || !config) {
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
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            {message && (
                <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
                    {message}
                </div>
            )}

            <div className="grid gap-6">
                {PAID_PLAN_ORDER.map(planKey => {
                    const defaultCfg = PLAN_CONFIGS[planKey as PlanType];
                    const override = config.plans[planKey] || {};
                    
                    return (
                        <div key={planKey} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold capitalize text-slate-900 mb-4">{defaultCfg.label} Plan</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Price (INR)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={override.priceINR !== undefined ? override.priceINR : defaultCfg.priceINR}
                                            onChange={(e) => updatePlan(planKey, "priceINR", Number(e.target.value))}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400">Default: ₹{defaultCfg.priceINR}</p>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Active Links Limit</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={override.limit !== undefined ? override.limit : defaultCfg.limit}
                                            onChange={(e) => updatePlan(planKey, "limit", Number(e.target.value))}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400">Default: {defaultCfg.limit}</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">TTL (Milliseconds)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={override.ttlMs !== undefined ? override.ttlMs : defaultCfg.ttlMs}
                                            onChange={(e) => updatePlan(planKey, "ttlMs", Number(e.target.value))}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400">Default: {defaultCfg.ttlMs} ms</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

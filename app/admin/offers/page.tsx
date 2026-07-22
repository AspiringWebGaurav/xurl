"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase/config";

interface GlobalOffer {
    id: string;
    name: string;
    type: "percentage" | "flat";
    value: number;
    isActive: boolean;
    expiresAt: number | null;
}

interface DynamicConfig {
    plans: Record<string, any>;
    offers: GlobalOffer[];
}

export default function OffersConfigPage() {
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
                setMessage("Global offers published! Changes are now live across all APIs and the pricing page.");
            } else {
                setMessage("Failed to publish offers.");
            }
        } catch (e) {
            console.error(e);
            setMessage("An error occurred while publishing.");
        } finally {
            setSaving(false);
        }
    };

    const formatDateForInput = (timestamp: number | null) => {
        if (!timestamp) return "";
        const d = new Date(timestamp);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const handleDateChange = (val: string) => {
        if (!val) return null;
        return new Date(val).getTime();
    };

    const addOffer = () => {
        setConfig(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                offers: [
                    ...prev.offers,
                    {
                        id: Math.random().toString(36).substring(7),
                        name: "New Offer",
                        type: "percentage",
                        value: 10,
                        isActive: false,
                        expiresAt: null
                    }
                ]
            };
        });
    };

    const updateOffer = (index: number, field: keyof GlobalOffer, value: any) => {
        setConfig(prev => {
            if (!prev) return prev;
            const newOffers = [...prev.offers];
            newOffers[index] = { ...newOffers[index], [field]: value };
            return { ...prev, offers: newOffers };
        });
    };

    const removeOffer = (index: number) => {
        setConfig(prev => {
            if (!prev) return prev;
            const newOffers = [...prev.offers];
            newOffers.splice(index, 1);
            return { ...prev, offers: newOffers };
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Global Offers</h1>
                    <p className="text-sm text-slate-500">Run platform-wide discount campaigns.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={addOffer} variant="outline" className="border-slate-300">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Offer
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Publish Live
                    </Button>
                </div>
            </div>

            {message && (
                <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
                    {message}
                </div>
            )}

            <div className="grid gap-6">
                {config.offers.map((offer, index) => (
                    <div key={offer.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm relative">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-600"
                            onClick={() => removeOffer(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Campaign Name</label>
                                <input 
                                    type="text" 
                                    value={offer.name}
                                    onChange={(e) => updateOffer(index, "name", e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Campaign Status</label>
                                <div className="flex items-center gap-3 mt-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={offer.isActive}
                                            onChange={(e) => updateOffer(index, "isActive", e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                    <span className="text-sm font-medium text-slate-600">
                                        {offer.isActive ? "Live" : "Draft"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Discount Type</label>
                                <select 
                                    value={offer.type}
                                    onChange={(e) => updateOffer(index, "type", e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="flat">Flat Amount (₹)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Discount Value</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <span className="text-slate-500 text-sm font-medium">
                                            {offer.type === "percentage" ? "%" : "₹"}
                                        </span>
                                    </div>
                                    <input 
                                        type="number" 
                                        value={offer.value || ""}
                                        onChange={(e) => updateOffer(index, "value", e.target.value ? Number(e.target.value) : 0)}
                                        className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                                        placeholder="e.g. 10"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Expiry Date (Optional)</label>
                                <input 
                                    type="datetime-local" 
                                    value={formatDateForInput(offer.expiresAt)}
                                    onChange={(e) => updateOffer(index, "expiresAt", handleDateChange(e.target.value))}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                    </div>
                ))}
                
                {config.offers.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                        <h3 className="text-sm font-medium text-slate-900">No active offers</h3>
                        <p className="mt-1 text-sm text-slate-500">Create a global campaign to offer discounts across all plans.</p>
                        <Button onClick={addOffer} variant="outline" className="mt-4 border-slate-300">
                            <Plus className="mr-2 h-4 w-4" />
                            New Campaign
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

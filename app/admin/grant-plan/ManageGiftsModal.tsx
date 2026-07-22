"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Gift, Clock, Trash2, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { emitAdminRefresh } from "@/lib/admin/admin-events";

type GiftQuota = {
    id: string;
    amount: number;
    used?: number;
    expiresAt: number | null;
};

export function ManageGiftsModal({ 
    open, 
    onOpenChange, 
    userId,
    userEmail,
    adminUser 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void;
    userId: string;
    userEmail: string;
    adminUser: User | null;
}) {
    const [gifts, setGifts] = useState<GiftQuota[]>([]);
    const [giftUsageCount, setGiftUsageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [confirmAction, setConfirmAction] = useState<{
        grantId: string;
        action: "revoke" | "update_expiry" | "custom_expiry";
        newExpiryMs?: number | null;
    } | null>(null);
    const [customDays, setCustomDays] = useState("30");
    const router = useRouter();

    useEffect(() => {
        if (open && userId && adminUser) {
            fetchGifts();
        }
    }, [open, userId, adminUser]);

    const fetchGifts = async () => {
        setLoading(true);
        setError("");
        try {
            const token = await adminUser!.getIdToken();
            const res = await fetch(`/api/admin/grants/manage?userId=${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setGifts(data.giftQuotas || []);
                setGiftUsageCount(data.giftUsageCount || 0);
            } else {
                setError(data.message || "Failed to load gifts.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const executeAction = async (grantId: string, action: "revoke" | "update_expiry", newExpiryMs?: number | null) => {
        setActionLoading(grantId);
        setError("");
        setConfirmAction(null);
        try {
            const token = await adminUser!.getIdToken();
            const res = await fetch(`/api/admin/grants/manage`, {
                method: "POST",
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ userId, grantId, action, newExpiryMs })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to update gift");
            }
            await fetchGifts();
            emitAdminRefresh(router);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Gifts for {userEmail}</DialogTitle>
                    <DialogDescription>
                        View, revoke, or modify expiry dates for the user's active gift quotas.
                    </DialogDescription>
                </DialogHeader>

                {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm">{error}</div>}

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : gifts.length === 0 ? (
                    <div className="text-center p-8 text-slate-500">No active gifts found for this user.</div>
                ) : (
                    <>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-indigo-900">Total Granted</div>
                                <div className="text-2xl font-bold text-indigo-700">{gifts.reduce((sum, g) => sum + g.amount, 0)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-indigo-900">Total Used</div>
                                <div className="text-2xl font-bold text-indigo-700">
                                    {gifts.some(g => g.used !== undefined) 
                                        ? gifts.reduce((sum, g) => sum + (g.used || 0), 0)
                                        : giftUsageCount}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-indigo-900">Total Remaining</div>
                                <div className="text-2xl font-bold text-fuchsia-600">
                                    {gifts.some(g => g.used !== undefined)
                                        ? gifts.reduce((sum, g) => sum + Math.max(0, g.amount - (g.used || 0)), 0)
                                        : Math.max(0, gifts.reduce((sum, g) => sum + g.amount, 0) - giftUsageCount)}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 mt-4">
                        {gifts.map(gift => (
                            <div key={gift.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50">
                                <div>
                                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Gift className="w-4 h-4 text-fuchsia-500" /> 
                                        {gift.used !== undefined ? (
                                            <span>
                                                <span className="text-fuchsia-600">{Math.max(0, gift.amount - gift.used)}</span> 
                                                <span className="text-slate-400 font-normal ml-1">/ {gift.amount} remaining</span>
                                            </span>
                                        ) : (
                                            <span>+{gift.amount} Links</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {gift.expiresAt ? (
                                            <span>Expires {new Date(gift.expiresAt).toLocaleDateString()}</span>
                                        ) : (
                                            <span className="text-fuchsia-600 font-medium">Permanent</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {confirmAction?.grantId === gift.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
                                            {confirmAction.action === 'custom_expiry' ? (
                                                <div className="flex items-center gap-2 px-2">
                                                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Days:</span>
                                                    <Input 
                                                        type="number" 
                                                        className="w-16 h-7 text-xs px-2 py-0" 
                                                        value={customDays} 
                                                        onChange={(e) => setCustomDays(e.target.value)}
                                                        min="1"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-sm font-medium text-slate-600 mr-2 ml-2">
                                                    {confirmAction.action === 'revoke' ? 'Revoke this gift?' : 'Update expiry?'}
                                                </span>
                                            )}
                                            
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 px-2 text-slate-500 hover:bg-slate-100"
                                                onClick={() => setConfirmAction(null)}
                                                disabled={actionLoading === gift.id}
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                variant={confirmAction.action === 'revoke' ? 'destructive' : 'default'}
                                                size="sm" 
                                                className="h-7 px-3"
                                                disabled={actionLoading === gift.id || (confirmAction.action === 'custom_expiry' && !customDays)}
                                                onClick={() => {
                                                    const ms = confirmAction.action === 'custom_expiry' 
                                                        ? parseInt(customDays) * 24 * 60 * 60 * 1000 
                                                        : confirmAction.newExpiryMs;
                                                    executeAction(confirmAction.grantId, confirmAction.action === 'custom_expiry' ? 'update_expiry' : confirmAction.action, ms);
                                                }}
                                            >
                                                {actionLoading === gift.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {gift.expiresAt ? (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    disabled={actionLoading === gift.id}
                                                    onClick={() => setConfirmAction({ grantId: gift.id, action: "update_expiry", newExpiryMs: null })}
                                                >
                                                    Make Permanent
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    disabled={actionLoading === gift.id}
                                                    onClick={() => setConfirmAction({ grantId: gift.id, action: "update_expiry", newExpiryMs: 30 * 24 * 60 * 60 * 1000 })}
                                                >
                                                    Set 30d Expiry
                                                </Button>
                                            )}
                                            
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                disabled={actionLoading === gift.id}
                                                onClick={() => setConfirmAction({ grantId: gift.id, action: "custom_expiry" })}
                                                title="Set custom expiry"
                                            >
                                                <CalendarDays className="w-4 h-4" />
                                            </Button>
                                            
                                            <Button 
                                                variant="destructive" 
                                                size="sm" 
                                                disabled={actionLoading === gift.id}
                                                onClick={() => setConfirmAction({ grantId: gift.id, action: "revoke" })}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

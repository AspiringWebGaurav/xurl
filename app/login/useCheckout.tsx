import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/user-profile";
import { useGoogleLogin } from "@/lib/hooks/useGoogleLogin";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { type AppliedPromo } from "@/components/payments/PromoCodeSection";
import { PLAN_DATA } from "./shared";

export type PaymentState = "idle" | "upgrading" | "processing" | "success" | "free_success" | "failed" | "cancelled";

export interface RenewalData {
    isRenewal: boolean;
    currentPlan: string;
    linksUsed: number;
    currentLimit: number;
    newAddition: number;
    newTotal: number;
    totalLinksEver: number;
    expiredLinksCount: number;
    planExpiry: number | null;
}

export function useCheckout() {
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [showLoginOverlay, setShowLoginOverlay] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<React.ReactNode>("Connecting to Google...");
    const [paymentState, setPaymentState] = useState<PaymentState>("idle");
    const paymentStateRef = useRef(paymentState);
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
    const [renewalData, setRenewalData] = useState<RenewalData | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const plan = searchParams.get("plan");
    const planKey = plan ? plan.toLowerCase() : null;
    const planContext = planKey && PLAN_DATA[planKey] ? PLAN_DATA[planKey] : null;
    const planDisplayName = planContext?.badgeName.replace(/\s+Plan$/, "") ?? "";

    useEffect(() => {
        paymentStateRef.current = paymentState;
    }, [paymentState]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                await ensureUserDocument(u);
                setUser(u);
                if (!plan) {
                    router.push("/");
                } else {
                    setAuthLoading(false);
                    try {
                        const token = await u.getIdToken();
                        fetch("/api/user/sync", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` }
                        }).catch(() => {});
                        
                        const res = await fetch("/api/links?pageSize=1", { headers: { "Authorization": `Bearer ${token}` } });
                        const data = await res.json();
                        if (data.plan && planKey && data.plan === planKey && planKey !== 'free') {
                            const planConfig = { starter: 5, pro: 25, business: 100, enterprise: 300, bigenterprise: 600 };
                            const newAddition = planConfig[planKey as keyof typeof planConfig] || 0;
                            setRenewalData({
                                isRenewal: true,
                                currentPlan: data.plan,
                                linksUsed: data.paidLinksCreated || 0,
                                currentLimit: data.limit || 0,
                                newAddition,
                                newTotal: (data.limit || 0) + newAddition,
                                totalLinksEver: data.totalLinksEver || 0,
                                expiredLinksCount: data.expiredLinksCount || 0,
                                planExpiry: data.planExpiry || null,
                            });
                        } else {
                            setRenewalData(null);
                        }
                    } catch {
                        setRenewalData(null);
                    }
                }
            } else {
                setUser(null);
                setAuthLoading(false);
                setRenewalData(null);
            }
        });
        return () => unsubscribe();
    }, [router, plan, planKey]);

    const verifyPayment = async (orderId: string, planName: string, paymentId?: string, signature?: string) => {
        let attempts = 0;
        while (attempts < 10) {
            try {
                if (!user) break;
                const token = await user.getIdToken();
                const res = await fetch("/api/payments/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ orderId, paymentId, signature })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "paid" || data.status === "consumed") {
                        setPaymentState("success");
                        toast.success(`Successfully upgraded to ${planName} Plan!`);
                        setTimeout(() => {
                            setPaymentState("idle");
                            setIsUpgrading(false);
                            user.getIdToken(true).then(() => router.push("/"));
                        }, 5000);
                        return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
        }
        setPaymentState("failed");
        toast.error("Payment verification timeout. If amount was deducted, it will be refunded or credited soon.");
        setIsUpgrading(false);
    };

    const loadRazorpayOptions = async (orderId: string, amount: number, currency: string, planName: string) => {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
            setPaymentState("idle");
            setIsUpgrading(false);
            toast.error("Oops! Something went wrong. Payment configuration missing.");
            return;
        }

        const options = {
            key: keyId,
            amount: amount,
            currency: currency,
            name: "xurl.eu.cc",
            description: `Upgrade to ${planName}`,
            order_id: orderId,
            handler: async function (response: { razorpay_payment_id: string; razorpay_signature: string }) {
                setPaymentState("processing");
                verifyPayment(orderId, planName, response.razorpay_payment_id, response.razorpay_signature);
            },
            prefill: {
                name: user?.displayName || "",
                email: user?.email || ""
            },
            theme: {
                color: "#0f172a"
            },
            modal: {
                ondismiss: function () {
                    const currentState = paymentStateRef.current;
                    if (currentState === "upgrading" || currentState === "idle") {
                        setPaymentState("idle");
                        setIsUpgrading(false);
                        toast.info("Payment cancelled.");
                    }
                }
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: { error?: { description?: string } }) {
            setPaymentState("failed");
            setIsUpgrading(false);
            toast.error(response.error?.description || "Oops! Something went wrong with the payment.");
        });
        rzp.open();
    };

    const handlePurchase = async () => {
        if (!user || !plan) return;
        setIsUpgrading(true);
        if (planKey === 'free') {
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/user/upgrade", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ plan })
                });
                if (res.ok) {
                    router.push("/");
                } else {
                    toast.error("Failed to claim free plan. Please try again.");
                    setIsUpgrading(false);
                }
            } catch (error) {
                console.error("Purchase error:", error);
                setIsUpgrading(false);
            }
        } else {
            setPaymentState("upgrading");
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/payments/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ planId: plan, promoCode: appliedPromo?.code ?? null })
                });
                const data = await res.json();

                if (data.success) {
                    if (data.developerMode) {
                        setPaymentState("success");
                        setIsUpgrading(false);
                        toast.success("Developer Mode: plan activated without payment.");
                        router.push("/");
                        return;
                    }

                    if (data.freeFulfillment) {
                        setPaymentState("free_success");
                        setIsUpgrading(false);
                        setTimeout(() => {
                            user.getIdToken(true).then(() => router.push("/"));
                        }, 5000);
                        return;
                    }

                    loadRazorpayOptions(data.orderId, data.amount, data.currency, planContext?.badgeName || "Paid Plan");
                } else {
                    setPaymentState("failed");
                    setIsUpgrading(false);
                    toast.error(data.message || "Failed to initiate payment.");
                }
            } catch {
                setPaymentState("failed");
                setIsUpgrading(false);
                toast.error("Network error. Could not initiate payment.");
            }
        }
    };

    const { login: handleLogin, isLoggingIn } = useGoogleLogin({
        showToasts: false,
        onPopupOpen: () => {
            setOverlayMessage("Connecting to Google...");
            setShowLoginOverlay(true);
        },
        onCancel: () => {
            setOverlayMessage("Login cancelled - staying on this page...");
            setTimeout(() => setShowLoginOverlay(false), 500);
        },
        onSuccess: () => {
            setOverlayMessage("Signing in...");
            setTimeout(() => setShowLoginOverlay(false), 600);
        },
        onError: (error) => {
            if (error === "auth/popup-blocked") {
                setOverlayMessage(
                    <React.Fragment>
                        Popup blocked - click to retry login
                        <br />
                        <span 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setShowLoginOverlay(false);
                                setTimeout(() => handleLogin(), 50); 
                            }} 
                            className="mt-2 inline-block cursor-pointer underline transition-colors hover:text-foreground"
                        >
                            Open login
                        </span>
                    </React.Fragment>
                );
            } else {
                setOverlayMessage("Unable to sign in. Please try again.");
                setTimeout(() => setShowLoginOverlay(false), 700);
            }
        }
    });

    return {
        authLoading,
        user,
        isUpgrading,
        showLoginOverlay,
        overlayMessage,
        paymentState,
        setPaymentState,
        appliedPromo,
        setAppliedPromo,
        renewalData,
        plan,
        planKey,
        planContext,
        planDisplayName,
        handlePurchase,
        handleLogin,
        isLoggingIn,
        router,
    };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConsentModal() {
    const [open, setOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
        const hasConsent = localStorage.getItem("xurl_policy_consent");
        if (!hasConsent) {
            setOpen(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("xurl_policy_consent", "accepted");
        setOpen(false);
    };

    const handleReject = () => {
        router.push("/");
    };

    if (!isMounted) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
                // If they try to close by clicking outside or pressing escape, we redirect them to home
                // because consent is strictly required.
                handleReject();
            }
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Enterprise Policy Consent</DialogTitle>
                    <DialogDescription>
                        To use our platform or view our policies in detail, you must agree to our comprehensive enterprise policies, including our strict zero-tolerance abuse policies, data retention standards, and active session monitoring (e.g., Mouse Idle rules).
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        Do you accept our governing policies? If you decline, you will be redirected to the home page.
                    </p>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={handleReject} className="w-full sm:w-auto">
                        Decline & Leave
                    </Button>
                    <Button variant="default" onClick={handleAccept} className="w-full sm:w-auto">
                        I Accept
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

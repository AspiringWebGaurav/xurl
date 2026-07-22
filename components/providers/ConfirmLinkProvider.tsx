"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ConfirmLinkModal } from "@/components/ui/confirm-link-modal";

interface ConfirmLinkContextType {
    confirmLink: string | null;
    setConfirmLink: (link: string | null) => void;
    handleLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

const ConfirmLinkContext = createContext<ConfirmLinkContextType | undefined>(undefined);

export function ConfirmLinkProvider({ children }: { children: ReactNode }) {
    const [confirmLink, setConfirmLink] = useState<string | null>(null);

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        setConfirmLink(href);
        // Subtle vibration if supported
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(50);
        }
    };

    return (
        <ConfirmLinkContext.Provider value={{ confirmLink, setConfirmLink, handleLinkClick }}>
            {children}
            <ConfirmLinkModal confirmLink={confirmLink} setConfirmLink={setConfirmLink} />
        </ConfirmLinkContext.Provider>
    );
}

export function useConfirmLink() {
    const context = useContext(ConfirmLinkContext);
    if (context === undefined) {
        throw new Error("useConfirmLink must be used within a ConfirmLinkProvider");
    }
    return context;
}
 

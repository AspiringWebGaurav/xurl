"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface WorkspaceProps {
    children: ReactNode;
    className?: string;
}

export function Workspace({ children, className = "" }: WorkspaceProps) {
    const pathname = usePathname();

    return (
        <main className={`flex-1 relative overflow-hidden ${className}`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute inset-0 flex flex-col overflow-y-auto"
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </main>
    );
}

"use client";

import { DesktopOnlyWrapper } from "./DesktopOnlyWrapper";

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <DesktopOnlyWrapper>
            <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased selection:bg-zinc-800">
                {children}
            </div>
        </DesktopOnlyWrapper>
    );
}

import React from 'react';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background text-foreground antialiased w-full max-w-full overflow-x-hidden relative">
            <main className="flex-1 flex flex-col relative w-full pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
                {children}
            </main>
        </div>
    );
}

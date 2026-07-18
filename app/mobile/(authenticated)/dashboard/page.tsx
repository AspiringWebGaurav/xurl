import Link from 'next/link';
import { Home, BarChart2, Settings, Plus } from 'lucide-react';

export default function MobileDashboardPage() {
    return (
        <div className="flex flex-col flex-1 min-h-[100dvh] bg-background">
            <header className="px-6 py-6 border-b border-border flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
                    <span className="text-sm font-semibold text-foreground">ME</span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
                <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <h2 className="text-sm font-semibold text-primary mb-1 uppercase tracking-wider">Total Clicks</h2>
                    <p className="text-4xl font-black text-foreground tracking-tight">12,482</p>
                    <div className="mt-4 inline-flex items-center text-sm font-medium text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        +14% from last week
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Links</h3>
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center active:scale-[0.98] transition-transform touch-manipulation shadow-sm">
                            <div className="flex flex-col overflow-hidden pr-4">
                                <span className="font-semibold text-foreground truncate text-base">xurl.co/promo{i}</span>
                                <span className="text-muted-foreground text-sm truncate mt-1">https://example.com/very-long-url-that-needs-shortening</span>
                            </div>
                            <div className="flex flex-col items-end text-muted-foreground">
                                <span className="font-bold text-foreground">2.4k</span>
                                <span className="text-xs">clicks</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)] pt-2 px-6 z-50">
                <div className="flex justify-between items-center h-16">
                    <button className="flex flex-col items-center justify-center w-16 h-full text-primary">
                        <Home className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-semibold">Home</span>
                    </button>
                    
                    <button className="flex flex-col items-center justify-center w-16 h-full text-muted-foreground hover:text-foreground transition-colors">
                        <BarChart2 className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-semibold">Stats</span>
                    </button>

                    <div className="relative -top-6">
                        <button className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform touch-manipulation">
                            <Plus className="w-7 h-7" />
                        </button>
                    </div>

                    <button className="flex flex-col items-center justify-center w-16 h-full text-muted-foreground hover:text-foreground transition-colors">
                        <Settings className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-semibold">Settings</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}

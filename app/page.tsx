import { TopNavbar } from "@/components/layout/TopNavbar";
import { TiltedCarousel } from "@/components/content/tilted-carousel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";

export default function LandingPage() {
    const images = [
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1525253086316-d0c936c814f8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1756894256833-934a85a42df9?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1755090281929-2f027ee94c98?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    ];

    return (
        <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-950">
            {/* Top Navbar */}
            <div className="bg-white z-50 shrink-0">
                <TopNavbar />
            </div>

            {/* Main Hero Area */}
            <main className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                {/* Background 3D Carousel */}
                <div className="absolute inset-0 z-0 flex items-center justify-center">
                    <TiltedCarousel 
                        className="bg-slate-950" 
                        images={images} 
                        pauseOnHover={false} 
                        speed={60} 
                        preset="isometric" 
                        multiplier={8}
                    />
                    {/* Gradient Overlay for readability and premium feel */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20 z-10" />
                    {/* Radial gradient to focus on the center */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(2,6,23,0.8)_100%)] z-10" />
                </div>

                {/* Hero Content */}
                <div className="relative z-20 flex flex-col items-center text-center px-4 sm:px-6 max-w-5xl mx-auto -mt-12 sm:-mt-10">
                    
                    {/* Unique Magic Badge */}
                    <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/40 border border-white/10 text-cyan-300 text-sm font-medium mb-8 overflow-hidden shadow-2xl group">
                        <div className="absolute inset-0 backdrop-blur-xl" />
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                        <Link2 className="w-4 h-4 relative z-10 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
                        <span className="relative z-10 tracking-wide">The Ultimate URL Shortener</span>
                        <div className="absolute inset-x-0 -bottom-px h-[1px] bg-gradient-to-r from-transparent via-cyan-500/70 to-transparent" />
                    </div>
                    
                    <h1 className="text-[2.5rem] leading-[1.1] min-[375px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl">
                        Shorten your URL, <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500">
                            Expand your reach.
                        </span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed drop-shadow-md font-medium">
                        Turn long URLs into clean, shareable links with powerful analytics and optional custom aliases in a few quick steps.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link href="/app" className="w-full sm:w-auto group">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold bg-white text-slate-900 hover:bg-slate-100 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all duration-300 active:scale-95">
                                Create Link Now
                                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                        <Link href="/pricing" className="w-full sm:w-auto">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-slate-700 bg-slate-900/40 text-white hover:bg-slate-800 hover:text-white rounded-full backdrop-blur-md transition-all active:scale-95">
                                View Pricing
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

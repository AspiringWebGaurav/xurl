import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

export default function MobileLoginPage() {
    return (
        <div className="flex flex-col flex-1 min-h-[100dvh] px-6 py-8 bg-background">
            <header className="flex items-center mb-10 mt-2">
                <Link href="/mobile" className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-muted/80 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-foreground" />
                </Link>
            </header>

            <div className="flex-1 flex flex-col">
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                    Welcome back
                </h1>
                <p className="text-muted-foreground text-[16px] mb-10">
                    Log in to your account to continue.
                </p>

                <form className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground ml-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input 
                                type="email" 
                                placeholder="name@example.com"
                                className="w-full bg-background border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-[16px] touch-manipulation shadow-sm"
                            />
                        </div>
                    </div>
                    
                    <button 
                        type="button"
                        className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-lg mt-4 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20 touch-manipulation"
                    >
                        Continue with Email
                    </button>
                </form>

                <div className="mt-8 flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-sm text-muted-foreground font-medium">OR</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                <div className="mt-8 flex flex-col gap-4">
                    {/* Placeholder for OAuth buttons, e.g., Google/GitHub */}
                    <button className="w-full border border-border bg-background text-foreground hover:bg-muted py-4 rounded-2xl font-semibold text-lg active:scale-[0.98] transition-all touch-manipulation shadow-sm flex items-center justify-center gap-3">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                    </button>
                </div>
                
                <p className="text-center text-muted-foreground text-sm mt-auto pb-4 pt-8">
                    By continuing, you agree to our <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
                </p>
            </div>
        </div>
    );
}

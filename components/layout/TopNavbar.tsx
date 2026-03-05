import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TopNavbar() {
    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
            <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2">
                    {/* Subtle minimal logo */}
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 font-semibold text-xs border border-zinc-800 shadow-sm">
                        X
                    </div>
                    <span className="font-semibold tracking-tight">XURL</span>
                </Link>
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild className="text-zinc-500 hover:text-zinc-900">
                    <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="shadow-sm">
                    <Link href="/register">Get Started</Link>
                </Button>
            </div>
        </header>
    );
}

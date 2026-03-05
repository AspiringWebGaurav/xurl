import Link from "next/link";
import { Clock } from "lucide-react";

export default function ExpiredPage() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="w-full max-w-md flex flex-col items-center gap-4 p-8 text-center bg-card border border-border rounded-xl shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-foreground mb-2">
                    <Clock className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Link Expired</h1>
                <p className="text-sm text-muted-foreground mb-6">
                    This shortened URL has expired and is no longer available.
                </p>
                <Link href="/" className="h-11 px-8 inline-flex items-center justify-center rounded-lg shadow-sm bg-foreground text-background hover:bg-foreground/90 font-medium text-sm transition-colors">
                    Create a new link
                </Link>
            </div>
        </div>
    );
}

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import RedirectClient from "./RedirectClient";

export default function RedirectPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <RedirectClient />
        </Suspense>
    );
}

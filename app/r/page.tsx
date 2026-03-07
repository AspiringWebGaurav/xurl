import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import RedirectClient from "./RedirectClient";

export default async function RedirectPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await searchParams;
    const dest = typeof resolvedParams.dest === "string" ? resolvedParams.dest : "";

    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <RedirectClient dest={dest} />
        </Suspense>
    );
}

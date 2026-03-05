import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                    404
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    This link does not exist.
                </p>
                <Link
                    href="/"
                    className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
                >
                    Go back
                </Link>
            </div>
        </div>
    );
}

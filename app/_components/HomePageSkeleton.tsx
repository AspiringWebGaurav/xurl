import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for home page
 * Matches exact layout of the actual page to prevent layout shift
 */
export function HomePageSkeleton() {
    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
            {/* Navbar skeleton */}
            <div className="h-16 border-b border-border/40 bg-background">
                <div className="h-full flex items-center justify-between px-6 md:px-8">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-9 w-20" />
                </div>
            </div>

            {/* Main content skeleton */}
            <main className="flex-1 flex flex-col w-full px-6 md:px-8 overflow-y-auto overflow-x-hidden">
                <div className="w-full max-w-xl flex flex-col gap-6 m-auto mt-20">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <Skeleton className="h-12 w-3/4 mx-auto" />
                        <Skeleton className="h-6 w-2/3 mx-auto" />
                        <div className="flex justify-center gap-2 mt-5">
                            <Skeleton className="h-7 w-32 rounded-full" />
                        </div>
                    </div>

                    {/* Form skeleton */}
                    <div className="w-full bg-card border border-border/70 rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full rounded-xl" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer skeleton */}
            <div className="border-t border-border/40 bg-background py-6">
                <div className="container mx-auto px-6">
                    <Skeleton className="h-4 w-48 mx-auto" />
                </div>
            </div>
        </div>
    );
}

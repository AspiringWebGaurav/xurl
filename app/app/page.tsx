import { Suspense } from "react";
import { HomePageClient } from "./_components/HomePageClient";
import { HomePageSkeleton } from "./_components/HomePageSkeleton";

const DEFAULT_GUEST_STATUS = { allowed: true };

/**
 * Server Component wrapper for home page
 * Statically rendered for optimal Vercel Hobby quota efficiency
 */
export default function HomePage() {
    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <HomePageClient initialGuestStatus={DEFAULT_GUEST_STATUS} />
        </Suspense>
    );
}


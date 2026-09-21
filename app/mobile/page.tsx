import { Suspense } from "react";
import { MobileHomePageClient } from "@/components/mobile/MobileHomePageClient";
import { HomePageSkeleton } from "@/app/app/_components/HomePageSkeleton";

const DEFAULT_GUEST_STATUS = { allowed: true };

/**
 * Mobile Landing Page
 * Statically rendered for optimal Vercel Hobby quota efficiency
 */
export default function MobileLandingPage() {
    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <MobileHomePageClient initialGuestStatus={DEFAULT_GUEST_STATUS} />
        </Suspense>
    );
}


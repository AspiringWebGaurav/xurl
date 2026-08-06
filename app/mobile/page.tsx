import { Suspense } from "react";
import { headers } from "next/headers";
import { checkGuestQuota } from "@/lib/server/quota-check";
import { MobileHomePageClient } from "@/components/mobile/MobileHomePageClient";
import { HomePageSkeleton } from "@/app/app/_components/HomePageSkeleton"; // We can reuse the skeleton for initial load since it's just basic shapes, or build a mobile skeleton.

export default async function MobileLandingPage() {
    // Get IP and fingerprint from headers
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || headersList.get('x-real-ip') 
        || 'unknown';
    const fingerprint = headersList.get('x-device-fingerprint') || undefined;

    // Server-side guest quota check
    const guestStatus = await checkGuestQuota(ip, fingerprint);

    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <MobileHomePageClient initialGuestStatus={guestStatus} />
        </Suspense>
    );
}

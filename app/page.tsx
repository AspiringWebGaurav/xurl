import { Suspense } from "react";
import { headers } from "next/headers";
import { checkGuestQuota } from "@/lib/server/quota-check";
import { HomePageClient } from "./_components/HomePageClient";
import { HomePageSkeleton } from "./_components/HomePageSkeleton";

/**
 * Server Component wrapper for home page
 * Checks guest quota server-side before rendering to prevent UI flash
 */
export default async function HomePage() {
    // Get IP and fingerprint from headers
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || headersList.get('x-real-ip') 
        || 'unknown';
    const fingerprint = headersList.get('x-device-fingerprint') || undefined;

    // Server-side guest quota check (direct function call, no HTTP)
    const guestStatus = await checkGuestQuota(ip, fingerprint);

    // Pass to client component
    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <HomePageClient initialGuestStatus={guestStatus} />
        </Suspense>
    );
}

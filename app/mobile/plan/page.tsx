import { Suspense } from "react";
import MobilePlanClient from "@/components/mobile/MobilePlanClient";
import { HomePageSkeleton } from "@/app/app/_components/HomePageSkeleton";

export default function MobilePlanPage() {
    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <MobilePlanClient />
        </Suspense>
    );
}

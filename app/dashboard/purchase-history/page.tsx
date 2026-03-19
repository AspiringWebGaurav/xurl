import { Suspense } from "react";
import PurchaseHistoryPage from "@/app/purchase-history/page";
import { Loader2 } from "lucide-react";

function LoadingFallback() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
    );
}

export default function DashboardPurchaseHistoryPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <PurchaseHistoryPage />
        </Suspense>
    );
}

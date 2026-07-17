import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        // Fallback to .get() because firebase-admin 10.3 doesn't support .count() natively yet
        const totalCountSnap = await adminDb.collection("links").where("userId", "==", "anonymous").get();
        const activeCountSnap = await adminDb.collection("links").where("userId", "==", "anonymous").where("isActive", "==", true).get();
        
        return NextResponse.json({
            success: true,
            stats: {
                total: totalCountSnap.size,
                active: activeCountSnap.size
            }
        });
    } catch (error) {
        console.error("Failed to fetch guest link stats:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

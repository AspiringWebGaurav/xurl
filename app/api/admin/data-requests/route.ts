import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let query: FirebaseFirestore.Query = adminDb.collection("deletion_requests");

    if (statusFilter && statusFilter !== "all") {
        query = query.where("status", "==", statusFilter);
    }

    try {
        const snap = await query.orderBy("requestedAt", "desc").limit(100).get();
        const items = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ requests: items });
    } catch (error) {
        // Fallback in case composite index is missing
        const fallbackSnap = await adminDb.collection("deletion_requests").limit(100).get();
        let items = fallbackSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as any[];

        if (statusFilter && statusFilter !== "all") {
            items = items.filter((item) => item.status === statusFilter);
        }

        items.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));

        return NextResponse.json({ requests: items });
    }
}

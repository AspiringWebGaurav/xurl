import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) {
        return NextResponse.json({ items: [] });
    }

    // Prefix search on email (lowercase) using Firestore range query
    const snap = await adminDb
        .collection("users")
        .orderBy("email")
        .startAt(q)
        .endAt(q + "\uf8ff")
        .limit(20)
        .get();

    // Fetch access state from guest_entities (single source of truth)
    const userIds = snap.docs.map(doc => doc.id);
    const guestEntitiesSnap = await adminDb
        .collection("guest_entities")
        .where("userId", "in", userIds.length > 0 ? userIds : ["__none__"])
        .get();
    
    const userIdToGuestMap = new Map<string, { access: any; guestId: string }>();
    guestEntitiesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
            userIdToGuestMap.set(data.userId, {
                access: data.access || null,
                guestId: data.guestId || doc.id
            });
        }
    });

    const items = snap.docs.map((doc) => {
        const data = doc.data();
        const guestData = userIdToGuestMap.get(doc.id);
        return {
            id: doc.id,
            email: data.email || "",
            plan: data.plan || "free",
            planExpiry: data.planExpiry ?? null,
            createdAt: data.createdAt ?? null,
            activeLinks: data.activeLinks ?? null,
            linksCreated: data.linksCreated ?? null,
            cumulativeQuota: data.cumulativeQuota ?? null,
            access: guestData?.access || null,
            guestId: guestData?.guestId || null,
        };
    });

    return NextResponse.json({ items });
}

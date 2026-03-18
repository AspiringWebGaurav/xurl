import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { searchParams } = new URL(request.url);
    const cursorParam = searchParams.get("cursor");
    const cursor = cursorParam ? Number(cursorParam) : null;

    let query = adminDb
        .collection("users")
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE);

    if (cursor && Number.isFinite(cursor)) {
        query = query.startAfter(cursor);
    }

    const snap = await query.get();
    
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

    if (admin.email) {
        const hasAdmin = items.some((item) => item.email?.toLowerCase() === admin.email?.toLowerCase());
        if (!hasAdmin) {
            const adminSnap = await adminDb.collection("users").doc(admin.uid).get();
            
            // Fetch admin's guest entity for access state
            const adminGuestSnap = await adminDb
                .collection("guest_entities")
                .where("userId", "==", admin.uid)
                .limit(1)
                .get();
            
            const adminGuestData = !adminGuestSnap.empty ? adminGuestSnap.docs[0].data() : null;
            
            if (adminSnap.exists) {
                const data = adminSnap.data() || {};
                items.unshift({
                    id: adminSnap.id,
                    email: data.email || admin.email,
                    plan: data.plan || "free",
                    planExpiry: data.planExpiry ?? null,
                    createdAt: data.createdAt ?? null,
                    activeLinks: data.activeLinks ?? null,
                    linksCreated: data.linksCreated ?? null,
                    cumulativeQuota: data.cumulativeQuota ?? null,
                    access: adminGuestData?.access || null,
                    guestId: adminGuestData?.guestId || adminGuestSnap.docs[0]?.id || null,
                });
            } else {
                items.unshift({
                    id: admin.uid,
                    email: admin.email,
                    plan: "free",
                    planExpiry: null,
                    createdAt: null,
                    activeLinks: null,
                    linksCreated: null,
                    cumulativeQuota: null,
                    access: adminGuestData?.access || null,
                    guestId: adminGuestData?.guestId || adminGuestSnap.docs[0]?.id || null,
                });
            }

            if (items.length > PAGE_SIZE) {
                items.pop();
            }
        }
    }

    const nextCursor = items.length === PAGE_SIZE ? items[items.length - 1]?.createdAt ?? null : null;

    return NextResponse.json({ items, nextCursor });
}

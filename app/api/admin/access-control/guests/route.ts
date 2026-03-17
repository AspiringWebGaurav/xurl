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
    const filter = searchParams.get("filter") || "all";

    let query = adminDb
        .collection("guest_entities")
        .orderBy("lastSeenAt", "desc")
        .limit(PAGE_SIZE);

    if (cursor && Number.isFinite(cursor)) {
        query = query.startAfter(cursor);
    }

    const snap = await query.get();
    let items = snap.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            guestId: data.guestId || doc.id,
            fingerprintHash: data.fingerprintHash || null,
            ipHash: data.ipHash || null,
            firstSeenAt: data.firstSeenAt ?? null,
            lastSeenAt: data.lastSeenAt ?? null,
            lastInteractionAt: data.lastInteractionAt ?? null,
            activeSlug: data.activeSlug || null,
            canonicalIdentityStrength: data.canonicalIdentityStrength || "ip",
            access: data.access || null,
            publicAccessKey: data.publicAccessKey || null,
        };
    });

    if (filter === "banned") {
        items = items.filter((item) => item.access?.status === "banned");
    } else if (filter === "active") {
        items = items.filter((item) => !item.access || item.access.status === "active");
    }

    const nextCursor = snap.docs.length === PAGE_SIZE
        ? snap.docs[snap.docs.length - 1]?.data()?.lastSeenAt ?? null
        : null;

    return NextResponse.json({ items, nextCursor });
}

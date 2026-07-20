import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const snap = await adminDb
            .collection("users")
            .where("banStatus", "==", "banned")
            .where("bannedBy", "==", "system")
            .orderBy("updatedAt", "desc")
            .limit(PAGE_SIZE)
            .get();

        const items = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email || "Unknown",
                plan: data.plan || "free",
                banReason: data.banReason || "Unknown violation",
                updatedAt: data.updatedAt ?? null,
            };
        });

        return NextResponse.json({ items });
    } catch (e) {
        console.error("Failed to fetch system bans:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

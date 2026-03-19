import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { applyPendingGrantsForEmail } from "@/services/grants";

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decoded;
    try {
        decoded = await adminAuth.verifyIdToken(token);
    } catch {
        return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
    }

    const applied = await applyPendingGrantsForEmail(decoded.email, decoded.uid);

    const recentSnap = await adminDb
        .collection("transactions")
        .where("userId", "==", decoded.uid)
        .where("source", "==", "admin_grant")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

    const recent = recentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ applied, recent });
}

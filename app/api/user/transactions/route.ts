import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
    try {
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

        const { searchParams } = new URL(request.url);
        const limitStr = searchParams.get("limit") || "20";
        const take = Math.min(parseInt(limitStr, 10), 100);
        const cursorStr = searchParams.get("cursor");

        let query = adminDb.collection("transactions")
            .where("userId", "==", decoded.uid)
            .orderBy("createdAt", "desc");

        if (cursorStr) {
            query = query.startAfter(parseInt(cursorStr, 10));
        }

        const snap = await query.limit(take).get();

        const transactions = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ transactions });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch transactions";
        logger.error("api_transactions", message);
        return NextResponse.json({ code: "FETCH_FAILED", message }, { status: 500 });
    }
}

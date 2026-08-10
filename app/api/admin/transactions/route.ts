import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminRequest(request);
        if (!admin.ok) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: admin.message }, { status: admin.status });
        }

        const { searchParams } = new URL(request.url);
        const limitStr = searchParams.get("limit") || "20";
        const take = Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100);
        const cursorStr = searchParams.get("cursor");
        const queryFilter = searchParams.get("q")?.trim().toLowerCase();

        let query: FirebaseFirestore.Query = adminDb.collection("transactions")
            .orderBy("createdAt", "desc");

        if (cursorStr) {
            const cursorVal = parseInt(cursorStr, 10);
            if (!isNaN(cursorVal)) {
                query = query.startAfter(cursorVal);
            }
        }

        const snap = await query.limit(take * 2).get();

        let transactions = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (queryFilter) {
            transactions = transactions.filter((t: any) => {
                const recipient = (t.recipientEmail || t.userId || "").toLowerCase();
                const orderId = (t.orderId || "").toLowerCase();
                const paymentId = (t.paymentId || "").toLowerCase();
                const plan = (t.planType || "").toLowerCase();
                return recipient.includes(queryFilter) || orderId.includes(queryFilter) || paymentId.includes(queryFilter) || plan.includes(queryFilter);
            });
        }

        transactions = transactions.slice(0, take);

        return NextResponse.json({ transactions });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch admin transactions";
        logger.error("api_admin_transactions", message);
        return NextResponse.json({ code: "FETCH_FAILED", message }, { status: 500 });
    }
}

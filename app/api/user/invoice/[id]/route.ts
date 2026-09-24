import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ code: "INVALID_REQUEST", message: "Transaction ID is required" }, { status: 400 });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid authentication token" }, { status: 401 });
        }

        const txDoc = await adminDb.collection("transactions").doc(id).get();
        if (!txDoc.exists) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Transaction not found" }, { status: 404 });
        }

        const txData = txDoc.data();
        if (!txData) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Transaction data empty" }, { status: 404 });
        }

        // Ownership validation
        if (txData.userId !== decoded.uid) {
            // Check if user is admin
            const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
            const isAdmin = userDoc.data()?.role === "admin";
            if (!isAdmin) {
                return NextResponse.json({ code: "FORBIDDEN", message: "Access denied" }, { status: 403 });
            }
        }

        // Get buyer user details
        const buyerDoc = await adminDb.collection("users").doc(txData.userId).get();
        const buyerData = buyerDoc.data();

        return NextResponse.json({
            transaction: {
                id: txDoc.id,
                ...txData,
            },
            user: {
                displayName: buyerData?.displayName || null,
                email: buyerData?.email || txData.recipientEmail || null,
                uid: txData.userId,
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch invoice";
        logger.error("api_invoice", message);
        return NextResponse.json({ code: "SERVER_ERROR", message }, { status: 500 });
    }
}

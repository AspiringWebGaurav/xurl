import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import { createNotificationForUser } from "@/services/notifications";

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminRequest(request);
        if (!admin.ok) {
            return NextResponse.json({ message: admin.message }, { status: admin.status });
        }

        const snap = await adminDb
            .collection("ban_appeals")
            .where("status", "==", "pending")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ items });
    } catch (error: any) {
        console.error("Error fetching appeals:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminRequest(request);
        if (!admin.ok) {
            return NextResponse.json({ message: admin.message }, { status: admin.status });
        }

        const { appealId, action, userId, email } = await request.json();

        if (!appealId || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
        }

        const appealRef = adminDb.collection("ban_appeals").doc(appealId);
        
        const updates: any = {
            status: action === "approve" ? "approved" : "rejected",
            reviewedAt: Date.now()
        };

        await appealRef.update(updates);

        if (action === "approve") {
            // Instantly unban
            if (userId) {
                await adminDb.collection("users").doc(userId).update({
                    banStatus: "none",
                    banScheduledAt: null,
                    unbanScheduledAt: null,
                    updatedAt: Date.now()
                });

                // Notify user
                await createNotificationForUser({
                    userId,
                    type: "SYSTEM",
                    title: "Appeal Approved",
                    message: "Your ban has been lifted by appeal. You may now access the platform.",
                });
            }
            if (email) {
                await adminDb.collection("banned_emails").doc(email.toLowerCase().trim()).delete().catch(() => {});
            }
        }

        return NextResponse.json({ success: true, message: `Appeal ${action}d successfully` });
    } catch (error: any) {
        console.error("Error resolving appeal:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}


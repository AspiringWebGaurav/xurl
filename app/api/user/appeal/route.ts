import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const guestSessionId = request.headers.get("x-guest-session-id");
        
        let userId = "";
        let userEmail = "";

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await adminAuth.verifyIdToken(token);
                userId = decoded.uid;
                userEmail = decoded.email || "";
            } catch {
                return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
            }
        } else if (guestSessionId) {
            userId = ""; // Guest does not have a user ID
        } else {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing authentication" }, { status: 401 });
        }

        const { message, email } = await request.json();
        if (!message || message.trim().length < 10) {
            return NextResponse.json({ message: "Appeal message must be at least 10 characters." }, { status: 400 });
        }

        const appealRef = adminDb.collection("ban_appeals").doc();
        await appealRef.set({
            userId: userId,
            guestSessionId: guestSessionId || null,
            email: userEmail || email || "Guest Device",
            message: message.trim(),
            status: "pending",
            createdAt: Date.now()
        });

        // Update the user or guest document so the frontend can lock the UI across refreshes
        if (userId) {
            await adminDb.collection("users").doc(userId).set({
                appealStatus: "pending"
            }, { merge: true });
        } else if (guestSessionId) {
            await adminDb.collection("banned_guests").doc(guestSessionId).set({
                appealStatus: "pending"
            }, { merge: true });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error submitting appeal:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const guestSessionId = request.headers.get("x-guest-session-id");
        
        let userId = "";

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await adminAuth.verifyIdToken(token);
                userId = decoded.uid;
            } catch {
                // Ignore, we will check guest ID if provided
            }
        }

        if (!userId && !guestSessionId) {
            return NextResponse.json({ hasPendingAppeal: false });
        }

        let query = adminDb.collection("ban_appeals").where("status", "==", "pending").limit(1);

        if (userId) {
            query = query.where("userId", "==", userId);
        } else if (guestSessionId) {
            query = query.where("guestSessionId", "==", guestSessionId);
        }

        const snapshot = await query.get();

        return NextResponse.json({ hasPendingAppeal: !snapshot.empty });
    } catch (error) {
        console.error("Error checking appeal status:", error);
        return NextResponse.json({ hasPendingAppeal: false });
    }
}

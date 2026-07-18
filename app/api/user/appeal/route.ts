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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error submitting appeal:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

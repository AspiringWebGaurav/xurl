import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
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

        const { message } = await request.json();
        if (!message || message.trim().length < 10) {
            return NextResponse.json({ message: "Appeal message must be at least 10 characters." }, { status: 400 });
        }

        const appealRef = adminDb.collection("ban_appeals").doc();
        await appealRef.set({
            userId: decoded.uid,
            email: decoded.email || "",
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

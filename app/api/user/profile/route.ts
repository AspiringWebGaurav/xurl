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

        const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
        if (!userSnap.exists) {
            return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
        }

        const userData = userSnap.data()!;
        
        return NextResponse.json({ 
            displayName: userData.displayName || decoded.name || "User",
        });
    } catch (error) {
        return NextResponse.json({ code: "FETCH_FAILED", message: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
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

        const body = await request.json();
        const { displayName } = body;

        if (typeof displayName !== "string" || displayName.trim().length === 0 || displayName.length > 50) {
            return NextResponse.json({ code: "INVALID_INPUT", message: "Display name must be between 1 and 50 characters" }, { status: 400 });
        }

        await adminDb.collection("users").doc(decoded.uid).update({
            displayName: displayName.trim(),
            updatedAt: Date.now()
        });

        // Also update the display name in Firebase Auth
        await adminAuth.updateUser(decoded.uid, {
            displayName: displayName.trim()
        });

        return NextResponse.json({ success: true, displayName: displayName.trim() });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update profile";
        logger.error("api_profile_update", message);
        return NextResponse.json({ code: "UPDATE_FAILED", message }, { status: 500 });
    }
}

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

        const userRef = adminDb.collection("users").doc(decoded.uid);
        const userSnap = await userRef.get();
        const fallbackDisplayName = decoded.name || decoded.email?.split("@")[0] || "User";

        if (!userSnap.exists) {
            const now = Date.now();
            await userRef.set(
                {
                    uid: decoded.uid,
                    email: decoded.email || null,
                    displayName: fallbackDisplayName,
                    photoURL: decoded.picture || null,
                    plan: "free",
                    createdAt: now,
                    updatedAt: now,
                },
                { merge: true }
            );

            return NextResponse.json({
                displayName: fallbackDisplayName,
            });
        }

        const userData = userSnap.data()!;
        
        return NextResponse.json({ 
            displayName: userData.displayName || fallbackDisplayName,
        });
    } catch {
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

        const normalizedDisplayName = displayName.trim();
        await adminDb.collection("users").doc(decoded.uid).set(
            {
                email: decoded.email || null,
                displayName: normalizedDisplayName,
                updatedAt: Date.now(),
            },
            { merge: true }
        );

        // Also update the display name in Firebase Auth
        await adminAuth.updateUser(decoded.uid, {
            displayName: normalizedDisplayName
        });

        return NextResponse.json({ success: true, displayName: normalizedDisplayName });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update profile";
        logger.error("api_profile_update", message);
        return NextResponse.json({ code: "UPDATE_FAILED", message }, { status: 500 });
    }
}

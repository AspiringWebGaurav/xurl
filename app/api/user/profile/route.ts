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

        let hasPendingAppeal = false;
        try {
            const appealsSnap = await adminDb.collection("ban_appeals")
                .where("userId", "==", decoded.uid)
                .where("status", "==", "pending")
                .limit(1)
                .get();
            if (!appealsSnap.empty) {
                hasPendingAppeal = true;
            }
        } catch (e) {
            console.error("Failed to check pending appeals", e);
        }

        if (!userSnap.exists) {
            const now = Date.now();
            let banStatus: "none" | "banned" = "none";
            let banReason: string | undefined = undefined;

            if (decoded.email) {
                try {
                    const bannedEmailSnap = await adminDb.collection("banned_emails").doc(decoded.email.toLowerCase()).get();
                    if (bannedEmailSnap.exists) {
                        banStatus = "banned";
                        banReason = bannedEmailSnap.data()?.reason || "Violated terms of service";
                    }
                } catch (error: any) {
                    console.error("Failed to check banned_emails collection:", error);
                }
            }

            await userRef.set(
                {
                    uid: decoded.uid,
                    email: decoded.email || null,
                    displayName: fallbackDisplayName,
                    photoURL: decoded.picture || null,
                    plan: "free",
                    createdAt: now,
                    updatedAt: now,
                    ...(banStatus === "banned" ? { banStatus, banReason } : {})
                },
                { merge: true }
            );

            return NextResponse.json({
                displayName: fallbackDisplayName,
                banStatus,
                banReason,
                hasPendingAppeal,
            });
        }

        const userData = userSnap.data()!;
        
        return NextResponse.json({ 
            displayName: userData.displayName || fallbackDisplayName,
            banStatus: userData.banStatus,
            banScheduledAt: userData.banScheduledAt,
            unbanScheduledAt: userData.unbanScheduledAt,
            banReason: userData.banReason,
            hasPendingAppeal,
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

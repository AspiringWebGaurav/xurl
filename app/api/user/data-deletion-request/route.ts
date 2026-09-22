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

        const requestsSnap = await adminDb
            .collection("deletion_requests")
            .where("userId", "==", decoded.uid)
            .orderBy("requestedAt", "desc")
            .limit(1)
            .get();

        if (requestsSnap.empty) {
            return NextResponse.json({ request: null });
        }

        const reqDoc = requestsSnap.docs[0];
        return NextResponse.json({
            request: {
                id: reqDoc.id,
                ...reqDoc.data(),
            },
        });
    } catch (error) {
        logger.error("api_user_data_deletion_get", "Failed to fetch deletion request", { error: String(error) });
        return NextResponse.json({ code: "FETCH_FAILED", message: "Failed to fetch deletion request" }, { status: 500 });
    }
}

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

        const userId = decoded.uid;
        const body = await request.json().catch(() => ({}));
        const reason = typeof body.reason === "string" ? body.reason.trim() : "User requested account and data deletion";

        // Check if there's already a pending request
        const existingPending = await adminDb
            .collection("deletion_requests")
            .where("userId", "==", userId)
            .where("status", "==", "pending")
            .limit(1)
            .get();

        if (!existingPending.empty) {
            return NextResponse.json(
                { code: "ALREADY_PENDING", message: "You already have a pending deletion request under review." },
                { status: 400 }
            );
        }

        // Get user profile details
        const userDocSnap = await adminDb.collection("users").doc(userId).get();
        const userData = userDocSnap.data() || {};

        const now = Date.now();
        const newRequest = {
            userId,
            email: decoded.email || userData.email || "",
            displayName: userData.displayName || decoded.name || "User",
            plan: userData.plan || "free",
            activeLinks: userData.activeLinks || 0,
            linksCreated: userData.linksCreated || 0,
            cumulativeQuota: userData.cumulativeQuota || 0,
            reason: reason || "User requested full account and link purge",
            status: "pending", // "pending" | "approved" | "rejected"
            requestedAt: now,
            processedAt: null,
            processedBy: null,
            notes: null,
        };

        const docRef = await adminDb.collection("deletion_requests").add(newRequest);

        logger.info("api_user_data_deletion_create", `Deletion request submitted for user ${userId}`, {
            requestId: docRef.id,
            email: newRequest.email,
        });

        return NextResponse.json({
            success: true,
            message: "Account and data deletion request submitted successfully. An administrator will review your request.",
            request: {
                id: docRef.id,
                ...newRequest,
            },
        });
    } catch (error) {
        logger.error("api_user_data_deletion_post", "Failed to submit deletion request", { error: String(error) });
        return NextResponse.json(
            { code: "SUBMIT_FAILED", message: "Failed to submit deletion request" },
            { status: 500 }
        );
    }
}

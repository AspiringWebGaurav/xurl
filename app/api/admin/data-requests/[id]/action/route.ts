import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cacheInvalidate, setNegCacheRedis } from "@/lib/redis/redirect-cache";
import { logger } from "@/lib/utils/logger";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { id: requestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { action, notes } = body; // action: "approve" | "reject"

    if (action !== "approve" && action !== "reject") {
        return NextResponse.json(
            { code: "INVALID_ACTION", message: "Action must be either 'approve' or 'reject'" },
            { status: 400 }
        );
    }

    const reqRef = adminDb.collection("deletion_requests").doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Deletion request not found" }, { status: 404 });
    }

    const reqData = reqSnap.data()!;
    if (reqData.status !== "pending") {
        return NextResponse.json(
            { code: "ALREADY_PROCESSED", message: `Request is already ${reqData.status}` },
            { status: 400 }
        );
    }

    const targetUserId = reqData.userId;
    const now = Date.now();

    if (action === "reject") {
        // Reject request: User data and links remain untouched in database
        await reqRef.update({
            status: "rejected",
            processedAt: now,
            processedBy: admin.email || admin.uid,
            notes: notes || "Deletion request rejected by administrator. Data retained in database.",
        });

        try {
            await writeActivityEvent({
                type: "USER_DELETION_REJECTED",
                actor: admin.email || admin.uid,
                sourceCollection: "deletion_requests",
                metadata: {
                    requestId,
                    targetUser: targetUserId,
                    targetEmail: reqData.email,
                    notes: notes || "Rejected by admin",
                },
                severity: "ADMIN",
            });
        } catch {
            // Ignore activity logging errors
        }

        logger.info("admin_data_deletion_rejected", `Deletion request ${requestId} rejected for user ${targetUserId}`, {
            admin: admin.email,
        });

        return NextResponse.json({
            success: true,
            message: "Deletion request rejected. User data and links remain intact.",
            status: "rejected",
        });
    }

    // Action === "approve" -> CASCADE PURGE
    logger.warn("admin_data_deletion_approved", `Purging all data and links for user ${targetUserId}`, {
        admin: admin.email,
        requestId,
    });

    let linksDeletedCount = 0;
    try {
        // 1. Fetch and delete all user's links and evict Redis caches
        const linksSnap = await adminDb.collection("links").where("userId", "==", targetUserId).get();

        const MAX_BATCH = 450;
        let batch = adminDb.batch();
        let batchCount = 0;

        for (const linkDoc of linksSnap.docs) {
            const slug = linkDoc.id;

            // Invalidate Upstash Redis cache and flag as negative cache
            try {
                cacheInvalidate(slug);
                setNegCacheRedis(slug, 3600);
            } catch (err) {
                logger.warn("admin_data_deletion_cache", `Failed to evict redis cache for slug ${slug}`, { error: String(err) });
            }

            // Delete link document
            batch.delete(linkDoc.ref);
            batchCount++;
            linksDeletedCount++;

            if (batchCount >= MAX_BATCH) {
                await batch.commit();
                batch = adminDb.batch();
                batchCount = 0;
            }

            // Also delete link's analytics records
            const analyticsSnap = await adminDb.collection("analytics").where("slug", "==", slug).limit(500).get();
            for (const aDoc of analyticsSnap.docs) {
                batch.delete(aDoc.ref);
                batchCount++;
                if (batchCount >= MAX_BATCH) {
                    await batch.commit();
                    batch = adminDb.batch();
                    batchCount = 0;
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        // 2. Delete user's API logs
        const apiLogsSnap = await adminDb.collection("api_logs").where("userId", "==", targetUserId).limit(500).get();
        if (!apiLogsSnap.empty) {
            const apiBatch = adminDb.batch();
            apiLogsSnap.docs.forEach((doc) => apiBatch.delete(doc.ref));
            await apiBatch.commit();
        }

        // 3. Delete user's profile document from Firestore
        await adminDb.collection("users").doc(targetUserId).delete();

        // 4. Delete user account from Firebase Authentication
        try {
            await adminAuth.deleteUser(targetUserId);
        } catch (authErr) {
            logger.warn("admin_data_deletion_auth", `Could not delete auth record for ${targetUserId} (may already be gone)`, {
                error: String(authErr),
            });
        }

        // 5. Update deletion request record to approved
        await reqRef.update({
            status: "approved",
            linksPurged: linksDeletedCount,
            processedAt: now,
            processedBy: admin.email || admin.uid,
            notes: notes || `Account and ${linksDeletedCount} links purged permanently by admin.`,
        });

        try {
            await writeActivityEvent({
                type: "USER_DATA_PURGED",
                actor: admin.email || admin.uid,
                sourceCollection: "deletion_requests",
                metadata: {
                    requestId,
                    targetUser: targetUserId,
                    targetEmail: reqData.email,
                    linksPurged: linksDeletedCount,
                    notes: notes || "User and links purged by admin",
                },
                severity: "SECURITY",
            });
        } catch {
            // Ignore activity logging errors
        }

        return NextResponse.json({
            success: true,
            message: `User data and ${linksDeletedCount} links permanently deleted from system.`,
            status: "approved",
            linksPurged: linksDeletedCount,
        });
    } catch (error) {
        logger.error("admin_data_deletion_error", `Error purging data for user ${targetUserId}`, {
            error: String(error),
            requestId,
        });

        return NextResponse.json(
            { code: "PURGE_FAILED", message: `Failed to purge user data: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}

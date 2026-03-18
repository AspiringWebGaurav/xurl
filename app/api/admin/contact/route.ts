import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import type { ContactSubmissionDocument } from "@/types";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
        const cursor = searchParams.get("cursor");
        const statusFilter = searchParams.get("status") || "all";
        const resolvedFilter = searchParams.get("resolved") || "all";

        let query = adminDb.collection("contact_submissions").orderBy("createdAt", "desc");

        if (statusFilter !== "all") {
            query = query.where("status", "==", statusFilter);
        }

        if (resolvedFilter !== "all") {
            const isResolved = resolvedFilter === "true";
            query = query.where("isResolved", "==", isResolved);
        }

        if (cursor) {
            const cursorDoc = await adminDb.collection("contact_submissions").doc(cursor).get();
            if (cursorDoc.exists) {
                query = query.startAfter(cursorDoc);
            }
        }

        const snapshot = await query.limit(limit + 1).get();

        const items: ContactSubmissionDocument[] = [];
        let hasMore = false;
        let nextCursor: string | null = null;

        snapshot.docs.forEach((doc, index) => {
            if (index < limit) {
                items.push({
                    id: doc.id,
                    ...doc.data(),
                } as ContactSubmissionDocument);
            } else {
                hasMore = true;
                nextCursor = snapshot.docs[limit - 1].id;
            }
        });

        const [newCountSnap, readCountSnap, resolvedCountSnap, unresolvedCountSnap, totalCountSnap] = await Promise.all([
            adminDb.collection("contact_submissions").where("status", "==", "new").count().get(),
            adminDb.collection("contact_submissions").where("status", "==", "read").count().get(),
            adminDb.collection("contact_submissions").where("isResolved", "==", true).count().get(),
            adminDb.collection("contact_submissions").where("isResolved", "==", false).count().get(),
            adminDb.collection("contact_submissions").count().get(),
        ]);

        const summary = {
            newCount: newCountSnap.data().count,
            readCount: readCountSnap.data().count,
            resolvedCount: resolvedCountSnap.data().count,
            unresolvedCount: unresolvedCountSnap.data().count,
            totalCount: totalCountSnap.data().count,
        };

        return NextResponse.json({
            items,
            nextCursor,
            hasMore,
            summary,
        });
    } catch (error) {
        logger.error("admin_contact_fetch_error", "Failed to fetch contact submissions", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { message: "Failed to fetch contact submissions" },
            { status: 500 }
        );
    }
}

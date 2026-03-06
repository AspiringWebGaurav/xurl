/**
 * Background Cleanup API
 *
 * POST /api/cleanup — Run cleanup jobs
 *
 * Handles:
 * - Old analytics data pruning (>90 days)
 * - Rate limiter memory cleanup
 *
 * Note: Expired links and guest_usage records are automatically deleted
 * by Firestore TTL policy on the `expiresAt` field. No manual cleanup needed.
 *
 * Should be called via a cron job (e.g. Vercel Cron, Cloud Scheduler).
 *
 * Uses firebase-admin SDK — runs server-side only.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { rateLimitCleanup } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Verify cleanup secret — reject ALL requests when secret is not configured
        const expectedSecret = process.env.CLEANUP_SECRET;
        if (!expectedSecret) {
            logger.error("cleanup", "CLEANUP_SECRET is not configured. Rejecting request.");
            return NextResponse.json({ error: "Cleanup endpoint not configured" }, { status: 503 });
        }
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const results = {
            oldAnalyticsPruned: 0,
            rateLimitEntriesCleaned: true,
        };

        const BATCH_SIZE = 200;
        const MAX_TOTAL = 2000; // Safety cap per phase to prevent timeout

        // ─── 1) Prune Old Analytics (>90 days) ──────────────────────────
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = cutoffDate.toISOString().slice(0, 10);

        let analyticsPruned = 0;
        while (analyticsPruned < MAX_TOTAL) {
            const oldAnalyticsSnap = await adminDb
                .collection("analytics")
                .where("date", "<", cutoffStr)
                .limit(BATCH_SIZE)
                .get();

            if (oldAnalyticsSnap.empty) break;

            const batch = adminDb.batch();
            oldAnalyticsSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            analyticsPruned += oldAnalyticsSnap.size;

            if (oldAnalyticsSnap.size < BATCH_SIZE) break;
        }
        results.oldAnalyticsPruned = analyticsPruned;

        // ─── 2) Clean Rate Limiter Memory ─────────────────────────────────
        rateLimitCleanup();

        const durationMs = Date.now() - startTime;
        logger.info("cleanup", "Cleanup completed", { ...results, durationMs });

        return NextResponse.json({ success: true, ...results, durationMs });
    } catch (error) {
        logger.error("cleanup", "Cleanup failed", { error: String(error) });
        return NextResponse.json(
            { error: "Cleanup failed", message: String(error) },
            { status: 500 }
        );
    }
}

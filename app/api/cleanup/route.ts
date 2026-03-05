/**
 * Background Cleanup API
 *
 * POST /api/cleanup — Run cleanup jobs
 *
 * Handles:
 * - Expired link deactivation (loops until all processed)
 * - Stale inactive link hard-deletion (>7 days inactive)
 * - Old analytics data pruning (>90 days)
 * - Rate limiter memory cleanup
 *
 * Should be called via a cron job (e.g. Vercel Cron, Cloud Scheduler).
 *
 * Uses firebase-admin SDK — runs server-side only.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { cacheInvalidate } from "@/lib/cache/redirect-cache";
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
            expiredLinksDeactivated: 0,
            staleLinksDeleted: 0,
            oldAnalyticsPruned: 0,
            rateLimitEntriesCleaned: true,
        };

        const now = Date.now();
        const BATCH_SIZE = 200;
        const MAX_TOTAL = 2000; // Safety cap per phase to prevent timeout

        // ─── 1) Deactivate Expired Links (loop until all processed) ──────
        let deactivated = 0;
        while (deactivated < MAX_TOTAL) {
            const expiredSnap = await adminDb
                .collection("links")
                .where("isActive", "==", true)
                .where("expiresAt", "<=", now)
                .limit(BATCH_SIZE)
                .get();

            if (expiredSnap.empty) break;

            const batch = adminDb.batch();
            expiredSnap.docs.forEach((d) => {
                batch.update(d.ref, { isActive: false, updatedAt: now });
                cacheInvalidate(d.id);
            });
            await batch.commit();
            deactivated += expiredSnap.size;

            if (expiredSnap.size < BATCH_SIZE) break;
        }
        results.expiredLinksDeactivated = deactivated;

        // ─── 2) Hard-delete stale inactive links (>7 days inactive) ──────
        // Frees up slug names and prevents unbounded document growth
        const STALE_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        const staleCutoff = now - STALE_CUTOFF_MS;

        let staleDeleted = 0;
        while (staleDeleted < MAX_TOTAL) {
            const staleSnap = await adminDb
                .collection("links")
                .where("isActive", "==", false)
                .where("updatedAt", "<=", staleCutoff)
                .limit(BATCH_SIZE)
                .get();

            if (staleSnap.empty) break;

            const batch = adminDb.batch();
            staleSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            staleDeleted += staleSnap.size;

            if (staleSnap.size < BATCH_SIZE) break;
        }
        results.staleLinksDeleted = staleDeleted;

        // ─── 3) Prune Old Analytics (>90 days) ──────────────────────────
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

        // ─── 4) Clean Rate Limiter Memory ─────────────────────────────────
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

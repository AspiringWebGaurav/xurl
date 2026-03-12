/**
 * Analytics Service — aggregated counters instead of per-click docs.
 *
 * Strategy:
 * - Increment `totalClicks` on the link document itself (1 write)
 * - Upsert a daily rollup doc `analytics/{slug}_{YYYY-MM-DD}` (1 write)
 * - Rate-limited to prevent abuse
 * - Batch reads when fetching dashboard data
 *
 * Total Firestore cost per redirect: 1 read (link lookup) + 2 writes (counter + daily rollup)
 * Cached redirects: 0 reads, 2 writes
 *
 * Uses firebase-admin SDK — runs server-side only.
 */

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimitAnalyticsWrite } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/utils/logger";
import { getRedisClient, safeRedis } from "@/lib/redis/client";
import type { AnalyticsDocument } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function parseUserAgent(ua: string): { device: string; browser: string } {
    // Lightweight parsing — avoids heavy dependencies
    let device = "desktop";
    if (/Mobile|Android/i.test(ua)) device = "mobile";
    else if (/Tablet|iPad/i.test(ua)) device = "tablet";

    let browser = "other";
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "chrome";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "safari";
    else if (/Edg/i.test(ua)) browser = "edge";

    return { device, browser };
}

// ─── Record Click ───────────────────────────────────────────────────────────

/**
 * Record a click event using aggregated counters.
 * Called on every redirect. Must be fast — fire-and-forget.
 */
export async function recordClick(
    slug: string,
    metadata: {
        referrer?: string;
        country?: string;
        userAgent?: string;
    }
): Promise<void> {
    try {
        // Rate limit analytics writes per slug
        const rateCheck = rateLimitAnalyticsWrite(slug);
        if (!rateCheck.allowed) return; // silently skip — not critical

        const today = getTodayDateString();
        const dailyDocId = `${slug}_${today}`;
        const dailyRef = adminDb.collection("analytics").doc(dailyDocId);
        const { device, browser } = parseUserAgent(metadata.userAgent || "");

        // 1) Increment total clicks on the link document
        await adminDb.collection("links").doc(slug).update({
            totalClicks: FieldValue.increment(1),
        });

        // 2) Upsert daily analytics rollup
        const updates: Record<string, unknown> = {
            slug,
            date: today,
            clicks: FieldValue.increment(1),
            uniqueVisitors: FieldValue.increment(1), // simplified — real impl would deduplicate by IP/fingerprint
        };

        // Increment nested counters using dot notation
        if (metadata.referrer) {
            const ref = metadata.referrer.replace(/\./g, "_"); // Firestore key safety
            updates[`referrers.${ref}`] = FieldValue.increment(1);
        }
        if (metadata.country) {
            updates[`countries.${metadata.country}`] = FieldValue.increment(1);
        }
        updates[`devices.${device}`] = FieldValue.increment(1);
        updates[`browsers.${browser}`] = FieldValue.increment(1);

        await dailyRef.set(updates, { merge: true });
    } catch (error) {
        // Analytics must never break the redirect flow
        logger.error("analytics_write", "Failed to record click", { slug, error: String(error) });
    }
}

// ─── Read Analytics ─────────────────────────────────────────────────────────

/**
 * Get aggregated analytics for a link over a date range.
 */
export async function getLinkAnalytics(
    slug: string,
    days: number = 30
): Promise<AnalyticsDocument[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const snapshot = await adminDb
        .collection("analytics")
        .where("slug", "==", slug)
        .where("date", ">=", startDateStr)
        .orderBy("date", "desc")
        .limit(days)
        .get();

    return snapshot.docs.map((d) => d.data() as AnalyticsDocument);
}

/**
 * Get dashboard-level analytics summary for a user.
 * Uses link documents' totalClicks counters — avoids reading analytics collection entirely.
 */
export async function getDashboardSummary(userId: string): Promise<{
    totalClicks: number;
    activeLinks: number;
    topLinks: Array<{ slug: string; title: string; clicks: number }>;
}> {
    const snapshot = await adminDb
        .collection("links")
        .where("userId", "==", userId)
        .orderBy("totalClicks", "desc")
        .limit(50)
        .get();

    let totalClicks = 0;
    let activeLinks = 0;
    const topLinks: Array<{ slug: string; title: string; clicks: number }> = [];

    snapshot.docs.forEach((d) => {
        const data = d.data();
        totalClicks += data.totalClicks || 0;
        if (data.isActive) activeLinks++;
        topLinks.push({
            slug: data.slug,
            title: data.title || data.slug,
            clicks: data.totalClicks || 0,
        });
    });

    return { totalClicks, activeLinks, topLinks: topLinks.slice(0, 10) };
}

// ─── Redis Sync ─────────────────────────────────────────────────────────────

/**
 * Sweeps all aggregated `clicks:{slug}` keys from Redis, resets them atomically,
 * and commits them in batches to the Firestore link and analytics documents.
 * This should be called by the central cron job.
 */
export async function flushRedisClicks(): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;

    let totalFlushed = 0;
    try {
        const keys = (await safeRedis(c => c.keys("clicks:*"))) as string[];
        if (!keys || keys.length === 0) return 0;
        
        // Process in chunks of 50 to avoid Lua maximum execution timeouts or Firebase batch limits
        const CHUNK_SIZE = 50;
        
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
            const batchKeys = keys.slice(i, i + CHUNK_SIZE);
            if (batchKeys.length === 0) continue;
            
            // Atomically GET then DEL keys to ensure 0 lost clicks between read and delete
            const luaScript = `
                local results = {}
                for idx, key in ipairs(KEYS) do
                    local val = redis.call("GET", key)
                    table.insert(results, val)
                    redis.call("DEL", key)
                end
                return results
            `;
            
            const rawValues = await safeRedis(c => c.eval(luaScript, batchKeys, [] as string[]));
            const values = rawValues as (string | null)[];
            if (!values) continue;
            
            const fbBatch = adminDb.batch();
            const today = getTodayDateString();
            let batchHasWrites = false;
            
            for (let j = 0; j < batchKeys.length; j++) {
                const clickCountStr = values[j];
                if (!clickCountStr) continue;
                
                const urlClicks = Number(clickCountStr);
                if (isNaN(urlClicks) || urlClicks <= 0) continue;
                
                const slug = batchKeys[j].substring(7); // Remove "clicks:" prefix
                
                // 1) Update total clicks
                fbBatch.update(adminDb.collection("links").doc(slug), {
                    totalClicks: FieldValue.increment(urlClicks)
                });
                
                // 2) Update daily analytics
                const dailyRef = adminDb.collection("analytics").doc(`${slug}_${today}`);
                fbBatch.set(dailyRef, {
                    slug,
                    date: today,
                    clicks: FieldValue.increment(urlClicks),
                    uniqueVisitors: FieldValue.increment(urlClicks) // Simplified without fingerprinting at this stage
                }, { merge: true });
                
                totalFlushed += urlClicks;
                batchHasWrites = true;
            }
            
            if (batchHasWrites) {
                await fbBatch.commit();
            }
        }
        
    } catch (e) {
        logger.error("redis_flush", "Failed to flush redis clicks", { error: String(e) });
    }
    
    return totalFlushed;
}

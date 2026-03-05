/**
 * Rate limiter using a sliding window counter.
 * Runs in-memory — suitable for single-instance deployments.
 * Self-cleans stale entries to prevent unbounded memory growth.
 *
 * For multi-instance, swap to Redis-based limiter.
 */

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const limits = new Map<string, RateLimitEntry>();

// ─── Configuration ──────────────────────────────────────────────────────────

const WINDOW_MS = 60 * 1000;             // 1-minute window
const MAX_LINK_CREATIONS = 10;            // max links per window per user
const MAX_REDIRECT_ANALYTICS = 1000;      // max analytics writes per window per slug
const MAX_LIMITER_ENTRIES = 10_000;        // hard cap on Map size

// ─── Core ───────────────────────────────────────────────────────────────────

function checkLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const entry = limits.get(key);

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
        // Before inserting a new entry, evict stale entries if at capacity
        if (limits.size >= MAX_LIMITER_ENTRIES) {
            evictStaleEntries(now);
        }

        limits.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: maxRequests - 1, resetMs: WINDOW_MS };
    }

    if (entry.count >= maxRequests) {
        const resetMs = WINDOW_MS - (now - entry.windowStart);
        return { allowed: false, remaining: 0, resetMs };
    }

    entry.count++;
    const resetMs = WINDOW_MS - (now - entry.windowStart);
    return { allowed: true, remaining: maxRequests - entry.count, resetMs };
}

/**
 * Evict all entries whose window has expired.
 * Called inline when the Map is at capacity.
 */
function evictStaleEntries(now: number): void {
    for (const [key, entry] of limits) {
        if (now - entry.windowStart >= WINDOW_MS) {
            limits.delete(key);
        }
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function rateLimitLinkCreation(userId: string) {
    return checkLimit(`link_create:${userId}`, MAX_LINK_CREATIONS);
}

export function rateLimitAnalyticsWrite(slug: string) {
    return checkLimit(`analytics:${slug}`, MAX_REDIRECT_ANALYTICS);
}

// Periodic cleanup of stale entries (call from cleanup job)
export function rateLimitCleanup(): void {
    evictStaleEntries(Date.now());
}

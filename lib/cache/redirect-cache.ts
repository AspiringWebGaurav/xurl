/**
 * Multi-Layer Cache for redirect lookups.
 *
 * Layer 1 — Edge cache headers (handled at response level)
 * Layer 2 — In-memory LRU cache (this module)
 * Layer 3 — Firestore (fallback)
 *
 * Adaptive TTL: high-traffic links get longer cache times.
 */

import type { CacheEntry } from "@/types";

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000;           // 5 minutes
const HIGH_TRAFFIC_TTL_MS = 30 * 60 * 1000;     // 30 minutes
const HIGH_TRAFFIC_THRESHOLD = 50;                // hits before promoting TTL
const MAX_CACHE_SIZE = 10_000;                    // max entries in memory

// ─── In-Memory Store ────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();

/**
 * Get a cached redirect URL by slug.
 * Returns null if not found or expired.
 */
export function cacheGet(slug: string): CacheEntry | null {
    const entry = cache.get(slug);

    if (!entry) return null;

    // Evict if the link itself has expired (expiresAt is the link's expiration, not the cache TTL)
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        cache.delete(slug);
        return null;
    }

    // Check cache TTL expiry
    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttl) {
        cache.delete(slug);
        return null;
    }

    // Bump hit count for adaptive TTL
    entry.hitCount++;

    // Promote to high-traffic TTL once threshold is crossed
    if (entry.hitCount >= HIGH_TRAFFIC_THRESHOLD && entry.ttl < HIGH_TRAFFIC_TTL_MS) {
        entry.ttl = HIGH_TRAFFIC_TTL_MS;
    }

    return entry;
}

/**
 * Set a cache entry for a slug.
 */
export function cacheSet(slug: string, originalUrl: string, isActive: boolean, expiresAt: number | null): void {
    // Evict oldest entry if at capacity (simple FIFO eviction)
    if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
            cache.delete(firstKey);
        }
    }

    cache.set(slug, {
        originalUrl,
        isActive,
        expiresAt,
        cachedAt: Date.now(),
        ttl: DEFAULT_TTL_MS,
        hitCount: 1,
    });
}

/**
 * Invalidate a specific slug from cache.
 * Must be called on link update/delete.
 */
export function cacheInvalidate(slug: string): void {
    cache.delete(slug);
}

/**
 * Clear entire cache (used for cleanup jobs).
 */
export function cacheClear(): void {
    cache.clear();
}

/**
 * Get current cache stats for observability.
 */
export function cacheStats(): { size: number; maxSize: number } {
    return { size: cache.size, maxSize: MAX_CACHE_SIZE };
}

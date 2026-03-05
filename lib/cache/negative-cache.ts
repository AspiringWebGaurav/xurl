/**
 * Negative Cache — prevents Firestore read amplification
 * by caching "slug does not exist" results.
 *
 * Shared module used by both the redirect handler and the link service.
 */

const negativeCache = new Map<string, number>(); // slug → timestamp when cached
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_NEGATIVE_CACHE = 50_000;

/**
 * Check if a slug is in the negative cache.
 * Returns true if the slug was recently confirmed as non-existent.
 */
export function isNegCached(slug: string): boolean {
    const ts = negativeCache.get(slug);
    if (!ts) return false;
    if (Date.now() - ts > NEGATIVE_CACHE_TTL_MS) {
        negativeCache.delete(slug);
        return false;
    }
    return true;
}

/**
 * Add a slug to the negative cache after confirming it doesn't exist.
 */
export function setNegCache(slug: string): void {
    if (negativeCache.size >= MAX_NEGATIVE_CACHE) {
        // Evict oldest 20% (simple FIFO since Map preserves insertion order)
        const toDelete = Math.floor(MAX_NEGATIVE_CACHE * 0.2);
        let deleted = 0;
        for (const key of negativeCache.keys()) {
            negativeCache.delete(key);
            if (++deleted >= toDelete) break;
        }
    }
    negativeCache.set(slug, Date.now());
}

/**
 * Invalidate a negative cache entry.
 * Called when a new link is created so it's immediately redirectable.
 */
export function negCacheInvalidate(slug: string): void {
    negativeCache.delete(slug);
}

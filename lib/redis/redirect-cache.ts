import { getRedisClient, safeRedis } from "./client";
import { logger } from "../utils/logger";

// ─── LUA SCRIPT: GET CACHE & INCREMENT CLICKS ───
// This script allows us to:
// 1. Check if negative cache exists (if yes, return "NEG")
// 2. Check if redirect cache exists (if yes, INCR clicks and return URL)
// 3. Otherwise, return "MISS"
//
// KEYS[1] = slug:{slug}
// KEYS[2] = slug:missing:{slug}
// KEYS[3] = clicks:{slug}
const LUA_GET_REDIRECT_CACHE = `
    local cache_key = KEYS[1]
    local neg_key = KEYS[2]
    local clicks_key = KEYS[3]

    -- 1. Check Negative Cache
    local is_neg = redis.call("EXISTS", neg_key)
    if is_neg == 1 then
        return "NEG"
    end

    -- 2. Check Positive Cache
    local cached_url = redis.call("GET", cache_key)
    if cached_url then
        -- 3. Invalidate if TTL logic demands it? No, TTL handles it natively.
        -- We simply increment the clicks counter (which we can flush to Firebase later)
        redis.call("INCR", clicks_key)
        
        -- To prevent click counters from leaking forever if Firebase flush fails:
        local ttl = redis.call("TTL", clicks_key)
        if ttl == -1 then
            redis.call("EXPIRE", clicks_key, 86400) -- 24h
        end
        
        return "FOUND:" .. cached_url
    end

    -- 4. Cache Miss
    return "MISS"
`;

export type CacheResult = { status: "FOUND", url: string } | { status: "NEG" } | { status: "MISS" } | { status: "ERROR" };

/**
 * Checks the Redis cache for a redirect in a single round-trip.
 */
export async function getRedirectCache(slug: string): Promise<CacheResult> {
    const redis = getRedisClient();
    if (!redis) return { status: "ERROR" };

    try {
        const keys = [`slug:${slug}`, `slug:missing:${slug}`, `clicks:${slug}`];
        // Evaluates LUA script
        const rawResult = await safeRedis((client) => client.eval(LUA_GET_REDIRECT_CACHE, keys, [] as string[]));

        if (!rawResult) return { status: "ERROR" };
        const result = String(rawResult);

        if (result === "NEG") return { status: "NEG" };
        if (result === "MISS") return { status: "MISS" };
        if (result.startsWith("FOUND:")) {
            return { status: "FOUND", url: result.substring(6) };
        }
        
        return { status: "ERROR" };
    } catch (error) {
        logger.error("redis_redirect_cache", "Failed to check cache.", { error: String(error) });
        return { status: "ERROR" };
    }
}

/**
 * Stores a successful redirect lookup in Redis.
 */
export async function setRedirectCache(slug: string, originalUrl: string, ttlSeconds: number = 3600): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await safeRedis((client) => client.set(`slug:${slug}`, originalUrl, { ex: ttlSeconds }));
    } catch (error) {
        logger.error("redis_redirect_cache", "Failed to set positive cache.", { error: String(error) });
    }
}

/**
 * Stores a negative cache hit in Redis to Defend against slug scanning.
 */
export async function setNegCacheRedis(slug: string, ttlSeconds: number = 120): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await safeRedis((client) => client.set(`slug:missing:${slug}`, "1", { ex: ttlSeconds }));
    } catch (error) {
        logger.error("redis_redirect_cache", "Failed to set negative cache.", { error: String(error) });
    }
}

/**
 * Invalidates a positive cache entry.
 */
export async function cacheInvalidate(slug: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await safeRedis((client) => client.del(`slug:${slug}`));
    } catch (error) {
        logger.error("redis_redirect_cache", "Failed to invalidate positive cache.", { error: String(error) });
    }
}

/**
 * Invalidates a negative cache entry.
 */
export async function negCacheInvalidate(slug: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await safeRedis((client) => client.del(`slug:missing:${slug}`));
    } catch (error) {
        logger.error("redis_redirect_cache", "Failed to invalidate negative cache.", { error: String(error) });
    }
}

import { safeRedis } from "./client";
import { logger } from "../utils/logger";

const CONFIG_CACHE_KEY = "xurl:config:dynamic";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes (for extra safety, though we will explicitly invalidate on change)

/**
 * Gets the dynamic configuration payload from Redis.
 */
export async function getDynamicConfigCache(): Promise<string | null> {
    const cached = await safeRedis(async (client) => {
        return await client.get(CONFIG_CACHE_KEY);
    });

    if (typeof cached === "string") {
        return cached;
    } else if (cached && typeof cached === "object") {
        return JSON.stringify(cached);
    }
    
    return null;
}

/**
 * Saves the dynamic configuration payload into Redis.
 */
export async function setDynamicConfigCache(payload: string): Promise<void> {
    await safeRedis(async (client) => {
        await client.set(CONFIG_CACHE_KEY, payload, { ex: CACHE_TTL_SECONDS });
        logger.info("redis_cache", "Dynamic config cache updated in Redis");
    });
}

/**
 * Invalidates the dynamic configuration cache.
 */
export async function invalidateDynamicConfigCache(): Promise<void> {
    await safeRedis(async (client) => {
        await client.del(CONFIG_CACHE_KEY);
        logger.info("redis_cache", "Dynamic config cache invalidated in Redis");
    });
}

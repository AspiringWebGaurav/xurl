import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger";

class RedisClientWithCircuitBreaker {
    private client: Redis | null = null;
    private breakerOpen = false;
    private readonly BREAKER_COOLDOWN_MS = 60 * 1000; // 60 seconds
    private consecutiveErrors = 0;
    private readonly ERROR_THRESHOLD = 3;

    constructor() {
        this.initClient();
    }

    private initClient() {
        const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";

        if (!url) {
            console.warn("UPSTASH_REDIS_REST_URL not configured. Redis protection gateway will be DISABLED.");
            return;
        }

        try {
            // Depending on if it's Upstash or standard REST fallback
            const options = token ? { url, token } : { url, token: "placeholder" };

            this.client = new Redis(options);
            logger.info("redis_client", "Initialized Upstash Redis client.");
        } catch (error) {
            logger.error("redis_client", "Failed to initialize Redis client.", { error: error instanceof Error ? error.message : String(error) });
            this.openBreaker();
        }
    }

    private openBreaker() {
        if (!this.breakerOpen) {
            this.breakerOpen = true;
            logger.error("redis_client", "Redis circuit breaker OPENED. Falling back to Firebase only.");

            setTimeout(() => {
                if (this.breakerOpen) {
                    logger.info("redis_client", "Attempting to reconnect Redis after cooldown...");
                    this.breakerOpen = false;
                    this.consecutiveErrors = 0;
                    this.initClient();
                }
            }, this.BREAKER_COOLDOWN_MS);
        }
    }

    public reportError(err: Error | { message: string }) {
        this.consecutiveErrors++;
        logger.error("redis_client", `Redis request failed (${this.consecutiveErrors}/${this.ERROR_THRESHOLD}): ${err.message}`);

        if (this.consecutiveErrors >= this.ERROR_THRESHOLD) {
            this.openBreaker();
        }
    }

    public reportSuccess() {
        if (this.consecutiveErrors > 0) {
            this.consecutiveErrors = 0;
        }
    }

    public getClient(): Redis | null {
        if (this.breakerOpen) {
            return null;
        }
        return this.client;
    }
}

export const redisInstance = new RedisClientWithCircuitBreaker();

export function getRedisClient(): Redis | null {
    return redisInstance.getClient();
}

/**
 * Utility to execute a Redis command safely through the circuit breaker.
 */
export async function safeRedis<T>(operation: (client: Redis) => Promise<T>): Promise<T | null> {
    const client = redisInstance.getClient();
    if (!client) return null;

    try {
        // Enforce 2-second timeout on Redis operations using Promise.race
        const result = await Promise.race([
            operation(client),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Redis operation timed out (2000ms)")), 2000)
            ),
        ]);

        redisInstance.reportSuccess();
        return result;
    } catch (error: unknown) {
        redisInstance.reportError(error instanceof Error ? error : new Error(String(error)));
        return null; // Return null so callers implement fail-open
    }
}

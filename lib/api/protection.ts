import { getRedisClient, safeRedis } from "@/lib/redis/client";
import { logger } from "@/lib/utils/logger";
import type { PlanType } from "@/lib/plans";

export interface ApiRateLimitResult {
    allowed: boolean;
    status: number;
    error?: string;
    remaining?: number;
    resetMs?: number;
}

// Fallback in-memory map if Redis is temporarily unreachable
const memoryBurstMap = new Map<string, { count: number; windowStart: number }>();
const memoryMinuteMap = new Map<string, { count: number; windowStart: number }>();

function checkMemoryLimit(map: Map<string, { count: number; windowStart: number }>, key: string, windowMs: number, max: number): boolean {
    const now = Date.now();
    const entry = map.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
        if (map.size > 5000) {
            for (const [k, v] of map) {
                if (now - v.windowStart >= windowMs) map.delete(k);
                if (map.size < 4000) break;
            }
        }
        map.set(key, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
}

const PLAN_MINUTE_LIMITS: Record<PlanType, number> = {
    guest: 10,
    free: 30,
    starter: 120,
    pro: 300,
    business: 600,
    enterprise: 2000,
    bigenterprise: 5000,
};

/**
 * Checks rate limits and abuse prevention for API endpoints.
 */
export async function evaluateApiProtection(params: {
    ip: string;
    apiKeyHash: string;
    userId: string;
    plan: PlanType;
}): Promise<ApiRateLimitResult> {
    const { ip, apiKeyHash, plan } = params;
    const redis = getRedisClient();

    const burstLimit = plan === "enterprise" || plan === "bigenterprise" ? 60 : 30; // requests per second
    const minuteLimit = PLAN_MINUTE_LIMITS[plan] || 60; // requests per minute

    const burstKey = `ratelimit:api:burst:${apiKeyHash || ip}`;
    const minuteKey = `ratelimit:api:minute:${apiKeyHash || ip}`;
    const abuseKey = `abuse:api:ip:${ip}`;

    if (!redis) {
        // Fallback to in-memory check
        const burstOk = checkMemoryLimit(memoryBurstMap, burstKey, 1000, burstLimit);
        if (!burstOk) {
            return {
                allowed: false,
                status: 429,
                error: "Burst rate limit exceeded. Please throttle your API requests to avoid overloading the service.",
            };
        }
        const minuteOk = checkMemoryLimit(memoryMinuteMap, minuteKey, 60000, minuteLimit);
        if (!minuteOk) {
            return {
                allowed: false,
                status: 429,
                error: `API rate limit of ${minuteLimit} requests per minute exceeded for your ${plan} tier. Please upgrade or pace requests.`,
            };
        }
        return { allowed: true, status: 200 };
    }

    try {
        // Atomic Lua script for abuse check, burst check, and minute rate limit
        const luaScript = `
            local burst_key = KEYS[1]
            local minute_key = KEYS[2]
            local abuse_key = KEYS[3]

            local burst_max = tonumber(ARGV[1])
            local minute_max = tonumber(ARGV[2])

            -- 1. Abuse check
            local abuse_score = tonumber(redis.call("GET", abuse_key) or "0") or 0
            if abuse_score >= 30 then
                return "BLOCK:ABUSE"
            end

            -- 2. Burst limit (1 second)
            local burst_count = redis.call("INCR", burst_key)
            if burst_count == 1 then
                redis.call("EXPIRE", burst_key, 1)
            end
            if burst_count > burst_max then
                redis.call("INCRBY", abuse_key, 3)
                redis.call("EXPIRE", abuse_key, 1800)
                return "BLOCK:BURST"
            end

            -- 3. Minute rate limit (60 seconds)
            local minute_count = redis.call("INCR", minute_key)
            if minute_count == 1 then
                redis.call("EXPIRE", minute_key, 60)
            end
            if minute_count > minute_max then
                return "BLOCK:MINUTE"
            end

            return "ALLOW:" .. tostring(minute_max - minute_count)
        `;

        const result = (await safeRedis((c) =>
            c.eval(luaScript, [burstKey, minuteKey, abuseKey], [burstLimit.toString(), minuteLimit.toString()])
        )) as string | null;

        if (!result) return { allowed: true, status: 200 };

        if (result === "BLOCK:ABUSE") {
            return {
                allowed: false,
                status: 403,
                error: "Access blocked due to detected suspicious or abusive activity from this IP. Please contact support if you believe this is an error.",
            };
        }

        if (result === "BLOCK:BURST") {
            return {
                allowed: false,
                status: 429,
                error: `Burst rate limit exceeded (${burstLimit} req/sec). Please spread your API calls smoothly.`,
            };
        }

        if (result === "BLOCK:MINUTE") {
            return {
                allowed: false,
                status: 429,
                error: `API rate limit of ${minuteLimit} requests per minute exceeded for your ${plan} tier. Please pace your requests.`,
            };
        }

        return { allowed: true, status: 200 };
    } catch (err) {
        logger.error("api_protection_eval", "Redis rate limit check failed, failing open", { error: String(err) });
        return { allowed: true, status: 200 };
    }
}

/**
 * Checks for malicious payload signatures (SSRF, XSS, SQLi, internal network scanning).
 */
export function detectMaliciousPayload(input: {
    url?: string;
    customSlug?: string;
    title?: string;
}): { safe: boolean; reason?: string } {
    const { url, customSlug, title } = input;

    // Check URL
    if (url) {
        const lowerUrl = url.toLowerCase().trim();
        // Dangerous protocols
        if (
            lowerUrl.startsWith("javascript:") ||
            lowerUrl.startsWith("data:") ||
            lowerUrl.startsWith("file:") ||
            lowerUrl.startsWith("vbscript:") ||
            lowerUrl.startsWith("blob:") ||
            lowerUrl.startsWith("about:")
        ) {
            return { safe: false, reason: "Dangerous URL protocol detected." };
        }

        // SSRF protection: block internal / cloud metadata IPs
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();

            if (
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "0.0.0.0" ||
                hostname === "169.254.169.254" || // AWS/GCP metadata
                hostname === "metadata.google.internal" ||
                hostname === "[::1]" ||
                hostname.startsWith("10.") ||
                hostname.startsWith("192.168.") ||
                (hostname.startsWith("172.") &&
                    parseInt(hostname.split(".")[1] || "0", 10) >= 16 &&
                    parseInt(hostname.split(".")[1] || "0", 10) <= 31)
            ) {
                return { safe: false, reason: "Internal or private network URLs are prohibited for security." };
            }
        } catch {
            // URL parse error will be caught by validator
        }
    }

    // Check custom slug
    if (customSlug) {
        // Must match alphanumeric with hyphens/underscores only
        if (!/^[a-zA-Z0-9_-]{1,60}$/.test(customSlug)) {
            return { safe: false, reason: "Custom slug must contain only letters, numbers, hyphens, or underscores (max 60 characters)." };
        }

        // Block directory traversal patterns
        if (customSlug.includes("..") || customSlug.includes("/") || customSlug.includes("\\")) {
            return { safe: false, reason: "Path traversal attempt detected in slug." };
        }
    }

    // Check title for basic script injection
    if (title && (title.includes("<script") || title.includes("javascript:") || title.includes("onload="))) {
        return { safe: false, reason: "Potentially malicious script detected in title." };
    }

    return { safe: true };
}

/**
 * Record an abuse strike against an IP (e.g. on repeated 401s, SQLi, or scanning).
 */
export async function recordApiAbuse(ip: string, weight: number = 5): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await safeRedis(async (client) => {
            const key = `abuse:api:ip:${ip}`;
            await client.incrby(key, weight);
            await client.expire(key, 3600); // 1 hour cooldown
        });
    } catch {
        // Ignore
    }
}

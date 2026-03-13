import { getRedisClient, safeRedis } from "./client";
import { logger } from "../utils/logger";

export type ProtectionState = "ALLOW" | "SLOW" | "BLOCK";

// ─── In-Memory Fallback Rate Limiter (activates when Redis is down) ─────────
// Conservative fallback: 3 requests per minute per IP to prevent flood
const FALLBACK_WINDOW_MS = 60_000;
const FALLBACK_MAX_REQUESTS = 3;
const FALLBACK_MAX_ENTRIES = 10_000;
const fallbackLimiter = new Map<string, { count: number; windowStart: number }>();

function fallbackRateCheck(ip: string): ProtectionState {
    const now = Date.now();
    const entry = fallbackLimiter.get(ip);

    if (!entry || now - entry.windowStart >= FALLBACK_WINDOW_MS) {
        // Evict stale entries when at capacity
        if (fallbackLimiter.size >= FALLBACK_MAX_ENTRIES) {
            for (const [key, val] of fallbackLimiter) {
                if (now - val.windowStart >= FALLBACK_WINDOW_MS) fallbackLimiter.delete(key);
                if (fallbackLimiter.size < FALLBACK_MAX_ENTRIES * 0.8) break;
            }
        }
        fallbackLimiter.set(ip, { count: 1, windowStart: now });
        return "ALLOW";
    }

    if (entry.count >= FALLBACK_MAX_REQUESTS) {
        return "BLOCK";
    }

    entry.count++;
    return "ALLOW";
}

export interface GatewayResult {
    state: ProtectionState;
    retryAfter?: number; // In seconds
}

// ─── LUA SCRIPT ───
// Kept in a single script for ATOMIC execution.
// 1-2 Redis commands per request maximum.
//
// KEYS[1] = rate limit key (e.g. rate:ip:1.1.1.1)
// KEYS[2] = burst limit key (e.g. burst:ip:1.1.1.1)
// KEYS[3] = token bucket key (e.g. tokens:user:user123)
// KEYS[4] = abuse score key (e.g. abuse:ip:1.1.1.1)
// KEYS[5] = guest device key (e.g. guest:device:fingerprint)  (Optional, empty if not guest)
// KEYS[6] = behavior pattern key (e.g. abuse:pattern:hash)
//
// ARGV[1] = burst limit (e.g. 5)
// ARGV[2] = rate limit window (e.g. 60)
// ARGV[3] = rate limit max (e.g. 30)
// ARGV[4] = daily plan limit (e.g. 100) or -1 for unlimited
// ARGV[5] = timestamp
// ARGV[6] = is guest (1/0)
const LUA_PROTECTION_SCRIPT = `
    local rate_key = KEYS[1]
    local burst_key = KEYS[2]
    local tokens_key = KEYS[3]
    local abuse_key = KEYS[4]
    local guest_device_key = KEYS[5]
    local pattern_key = KEYS[6]

    local arg_burst_limit = tonumber(ARGV[1]) or 5
    local arg_rate_window = tonumber(ARGV[2]) or 60
    local arg_rate_max = tonumber(ARGV[3]) or 30
    local arg_plan_limit = tonumber(ARGV[4]) or -1
    local arg_timestamp = tonumber(ARGV[5]) or 0
    local arg_is_guest = tonumber(ARGV[6]) or 0

    -- 1. Abuse Score Check (pre-emptive block based on past bad behavior)
    local current_abuse = tonumber(redis.call("GET", abuse_key) or "0") or 0
    if current_abuse >= 40 then
        return "BLOCK:ABUSE"
    end

    -- 2. Behavior Pattern Check (Catch fast programmatic access that evades IP rotation)
    local current_pattern = redis.call("INCR", pattern_key)
    if current_pattern == 1 then
        redis.call("EXPIRE", pattern_key, 60) -- 1 min window for pattern
    end
    if current_pattern > 50 then
        redis.call("INCRBY", abuse_key, 10)
        redis.call("EXPIRE", abuse_key, 3600)
        return "BLOCK:PATTERN"
    end

    -- 3. Burst Detection (e.g., max 5 requests per second)
    local current_burst = redis.call("INCR", burst_key)
    if current_burst == 1 then
        redis.call("EXPIRE", burst_key, 1) -- 1 second window
    end
    if current_burst > arg_burst_limit then
        -- Increase abuse score for bursting
        redis.call("INCRBY", abuse_key, 5)
        redis.call("EXPIRE", abuse_key, 3600) -- Keep abuse score for 1 hour
        return "BLOCK:BURST"
    end

    -- 4. Standard Rate Limiting (e.g., max 30 requests per minute)
    local current_rate = redis.call("INCR", rate_key)
    if current_rate == 1 then
        redis.call("EXPIRE", rate_key, arg_rate_window)
    end
    if current_rate > arg_rate_max then
        redis.call("INCRBY", abuse_key, 2)
        redis.call("EXPIRE", abuse_key, 3600)
        return "BLOCK:RATE"
    end

    -- 5. Guest Fingerprint & Hourly Quota Strict Protection
    -- If they are a guest, check the unique device limit and the hourly token limit atomically.
    if arg_is_guest == 1 and guest_device_key ~= "" then
        local current_device_usage = tonumber(redis.call("GET", guest_device_key) or "0") or 0
        if current_device_usage >= 1 then
            return "BLOCK:GUEST_LIMIT"
        end
        -- We won't INCR the guest limit here, because they haven't successfully created a link yet.
        -- That should happen post-creation (or we rely entirely on Firebase for the final source of truth for guests).
        -- We just act as a read barrier.
    end

    -- 6. Token Bucket (Plan limits safety net for authenticated users inside Redis)
    if arg_plan_limit > 0 and arg_is_guest == 0 then
        -- We will just do a simple daily counter based on the key
        -- Only checking, not incrementing, as successful creation increments in Firebase.
        local current_tokens = tonumber(redis.call("GET", tokens_key) or "0") or 0
        if current_tokens >= arg_plan_limit then
            return "BLOCK:PLAN"
        end
    end

    -- 7. Determine State based on abuse score
    if current_abuse >= 20 then
        -- Very close to block, slow down significantly or temporary cooldown
        return "SLOW:2" 
    elseif current_abuse >= 10 then
        -- Starting to act suspicious, slow down
        return "SLOW:1"
    end

    return "ALLOW"
`;

/**
 * Evaluate a request through the Redis Protection Gateway.
 * 
 * @param ip Client IP Address
 * @param userId Authenticated User ID or "anonymous"
 * @param planDailyLimit Safe upper bound for this user's daily link creations. Use -1 for unlimited.
 * @param fingerprint Unique device fingerprint for tracking guest quotas across incognito/IP changes
 * @param behaviorHash Request pattern hash representing unique programmatic signatures
 * @returns ProtectionState (ALLOW, SLOW, BLOCK)
 */
export async function evaluateRequest(
    ip: string, 
    userId: string, 
    planDailyLimit: number,
    fingerprint?: string,
    behaviorHash?: string
): Promise<GatewayResult> {
    const redis = getRedisClient();

    // Circuit Breaker is open or Redis is offline → apply conservative in-memory fallback
    if (!redis) {
        const fallbackState = fallbackRateCheck(ip);
        if (fallbackState === "BLOCK") {
            logger.warn("gateway_fallback_block", `IP ${ip} blocked by in-memory fallback (Redis unavailable).`);
        }
        return { state: fallbackState };
    }

    try {
        const rateKey = `rate:ip:${ip}`;
        const burstKey = `burst:ip:${ip}`;
        const tokensKey = `tokens:user:${userId}`; // e.g. daily limit tokens
        const abuseKey = `abuse:ip:${ip}`;
        const guestDeviceKey = fingerprint ? `guest:device:${fingerprint}` : "";
        const patternKey = behaviorHash ? `abuse:pattern:${behaviorHash}` : `abuse:pattern:${ip}`;

        // Configuration
        const BURST_LIMIT_PER_SEC = 5;
        const RATE_LIMIT_WINDOW_SEC = 60;
        const RATE_LIMIT_MAX_PER_MIN = 30;
        const isGuest = userId === "anonymous" ? 1 : 0;

        // In @upstash/redis, eval signature expects (script, keys_array, args_array)
        const keys = [rateKey, burstKey, tokensKey, abuseKey, guestDeviceKey, patternKey];
        const args = [
            BURST_LIMIT_PER_SEC.toString(),
            RATE_LIMIT_WINDOW_SEC.toString(),
            RATE_LIMIT_MAX_PER_MIN.toString(),
            planDailyLimit.toString(),
            Date.now().toString(),
            isGuest.toString()
        ];

        const rawResult = await safeRedis((client) => client.eval(LUA_PROTECTION_SCRIPT, keys, args));

        // If safeRedis returns null, meaning circuit breaker tripped mid-flight or timed out, fail open
        if (rawResult === null) {
            return { state: "ALLOW" };
        }

        const result = String(rawResult);

        if (result.startsWith("BLOCK:")) {
            logger.warn("gateway_block", `IP ${ip} blocked. Reason: ${result}`);
            return { state: "BLOCK" };
        }

        if (result.startsWith("SLOW:")) {
            const level = parseInt(result.split(":")[1]);
            logger.warn("gateway_slow", `IP ${ip} slowed. Level: ${level}`);
            return { state: "SLOW" };
        }

        return { state: "ALLOW" };

    } catch (error: unknown) {
        // If Redis throws an error mid-flight, apply in-memory fallback instead of failing open
        logger.error("gateway_error", "Redis evaluation failed. Falling back to in-memory limiter.", { error: String(error) });
        return { state: fallbackRateCheck(ip) };
    }
}

/**
 * Records a successful guest request to prevent further creations using the same fingerprint.
 */
export async function recordSuccessfulGuestLink(fingerprint: string, ttlSeconds: number = 3600): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await safeRedis(c => c.set(`guest:device:${fingerprint}`, "1", { ex: ttlSeconds }));
    } catch (error) {
        logger.error("redis_protection_guest", "Failed to record guest link in Redis.", { error: String(error) });
    }
}

import { adminDb } from "@/lib/firebase/admin";
import { getRedisClient, safeRedis } from "@/lib/redis/client";
import { logger } from "@/lib/utils/logger";

const REDIS_KILL_SWITCH_KEY = "system:kill_switch";

export interface KillSwitchState {
    active: boolean;
    activatedAt: number | null;
    activatedBy: string | null;
    reason: string | null;
    updatedAt: number;
}

export interface SystemAppeal {
    id?: string;
    email: string;
    message: string;
    createdAt: number;
    userIp?: string;
    userAgent?: string;
}

/**
 * Reads current Kill Switch state (Redis fast path with Firestore fallback)
 */
export async function getKillSwitchState(): Promise<KillSwitchState> {
    try {
        const cached = await safeRedis((redis) => redis.get<string | KillSwitchState>(REDIS_KILL_SWITCH_KEY));
        if (cached) {
            if (typeof cached === "string") {
                try {
                    return JSON.parse(cached) as KillSwitchState;
                } catch {}
            } else if (typeof cached === "object") {
                return cached as KillSwitchState;
            }
        }

        const doc = await adminDb.collection("system").doc("kill_switch").get();
        if (doc.exists) {
            const state = doc.data() as KillSwitchState;
            await safeRedis((redis) => redis.set(REDIS_KILL_SWITCH_KEY, JSON.stringify(state), { ex: 300 }));
            return state;
        }
    } catch (err) {
        logger.error("kill_switch_get", "Failed to fetch kill switch state", { error: String(err) });
    }

    return {
        active: false,
        activatedAt: null,
        activatedBy: null,
        reason: null,
        updatedAt: Date.now(),
    };
}

/**
 * Updates Kill Switch state in Redis and Firestore with audit logging
 */
export async function setKillSwitchState(
    active: boolean,
    adminEmail: string,
    reason?: string
): Promise<KillSwitchState> {
    const now = Date.now();
    const state: KillSwitchState = {
        active,
        activatedAt: active ? now : null,
        activatedBy: active ? adminEmail : null,
        reason: reason || (active ? "Emergency outage activated by admin" : "Normal system operations restored"),
        updatedAt: now,
    };

    try {
        // Update Firestore
        await adminDb.collection("system").doc("kill_switch").set(state, { merge: true });

        // Update Redis cache immediately
        await safeRedis((redis) => redis.set(REDIS_KILL_SWITCH_KEY, JSON.stringify(state)));

        // Audit Log
        await adminDb.collection("admin_audit_logs").add({
            action: active ? "KILL_SWITCH_ACTIVATED" : "KILL_SWITCH_DEACTIVATED",
            adminEmail,
            details: state.reason,
            timestamp: now,
            payload: state,
        });

        logger.info("kill_switch_toggle", `Kill Switch set to ${active} by ${adminEmail}`);
    } catch (err) {
        logger.error("kill_switch_set", "Failed to update kill switch state", { error: String(err) });
        throw err;
    }

    return state;
}

/**
 * Stores a user emergency appeal during system outage
 */
export async function submitEmergencyAppeal(appeal: {
    email: string;
    message: string;
    userIp?: string;
    userAgent?: string;
}): Promise<string> {
    const now = Date.now();
    const docRef = await adminDb.collection("system_appeals").add({
        email: appeal.email.toLowerCase().trim(),
        message: appeal.message.trim(),
        createdAt: now,
        userIp: appeal.userIp || "unknown",
        userAgent: appeal.userAgent || "unknown",
        status: "pending",
    });

    return docRef.id;
}

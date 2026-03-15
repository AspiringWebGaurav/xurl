import { adminDb } from "@/lib/firebase/admin";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { decryptApiKey, encryptApiKey, generateApiKey, hashApiKey } from "@/lib/api/crypto";
import type { ApiLogDocument, UserDocument } from "@/types";

function isPlanExpired(user: Partial<UserDocument>, now: number): boolean {
    return !!(user.plan && user.plan !== "free" && user.planExpiry && user.planExpiry < now);
}

export function getEffectiveApiPlan(user: Partial<UserDocument>): ReturnType<typeof resolvePlanType> {
    if (isPlanExpired(user, Date.now())) {
        return "free";
    }
    return resolvePlanType(user.plan);
}

export function getApiEntitlement(plan: ReturnType<typeof resolvePlanType>) {
    const config = PLAN_CONFIGS[plan];
    return {
        enabled: Boolean(config.apiAccess),
        quotaTotal: config.apiQuotaTotal || 0,
    };
}

export async function ensureApiProvisioning(userId: string): Promise<{
    user: UserDocument;
    apiKey: string | null;
}> {
    const userRef = adminDb.collection("users").doc(userId);
    const now = Date.now();

    return adminDb.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
            throw new Error("User not found.");
        }

        const user = userSnap.data() as UserDocument;
        const plan = getEffectiveApiPlan(user);
        const entitlement = getApiEntitlement(plan);

        if (!entitlement.enabled) {
            transaction.set(
                userRef,
                {
                    apiEnabled: false,
                    apiQuotaTotal: 0,
                    apiRequestsUsed: 0,
                    updatedAt: now,
                },
                { merge: true }
            );

            return {
                user: {
                    ...user,
                    apiEnabled: false,
                    apiQuotaTotal: 0,
                    apiRequestsUsed: 0,
                },
                apiKey: null,
            };
        }

        let apiKey: string | null = null;
        let apiKeyHash = user.apiKeyHash || null;
        let apiKeyEncrypted = user.apiKeyEncrypted || null;

        if (!apiKeyHash || !apiKeyEncrypted) {
            apiKey = generateApiKey();
            apiKeyHash = hashApiKey(apiKey);
            apiKeyEncrypted = encryptApiKey(apiKey);
        } else {
            apiKey = decryptApiKey(apiKeyEncrypted);
        }

        const nextUser: UserDocument = {
            ...user,
            apiEnabled: true,
            apiQuotaTotal: user.apiQuotaTotal || entitlement.quotaTotal,
            apiRequestsUsed: user.apiRequestsUsed || 0,
            apiKeyHash,
            apiKeyEncrypted,
            apiKeyLastRotatedAt: user.apiKeyLastRotatedAt || now,
            updatedAt: now,
        };

        transaction.set(userRef, nextUser, { merge: true });

        return {
            user: nextUser,
            apiKey,
        };
    });
}

export async function regenerateApiKeyForUser(userId: string): Promise<{
    apiKey: string;
    user: UserDocument;
}> {
    const userRef = adminDb.collection("users").doc(userId);
    const now = Date.now();

    return adminDb.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
            throw new Error("User not found.");
        }

        const user = userSnap.data() as UserDocument;
        const plan = getEffectiveApiPlan(user);
        const entitlement = getApiEntitlement(plan);
        if (!entitlement.enabled) {
            throw new Error("API access is not enabled for your current plan.");
        }

        const apiKey = generateApiKey();
        const nextUser: UserDocument = {
            ...user,
            apiEnabled: true,
            apiQuotaTotal: user.apiQuotaTotal || entitlement.quotaTotal,
            apiRequestsUsed: user.apiRequestsUsed || 0,
            apiKeyHash: hashApiKey(apiKey),
            apiKeyEncrypted: encryptApiKey(apiKey),
            apiKeyLastRotatedAt: now,
            updatedAt: now,
        };

        transaction.set(userRef, nextUser, { merge: true });

        return { apiKey, user: nextUser };
    });
}

export async function getApiLogsPage(userId: string, limit: number = 20, cursor?: number): Promise<{ logs: ApiLogDocument[]; nextCursor: number | null }> {
    try {
        let query = adminDb
            .collection("api_logs")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (cursor) {
            query = query.startAfter(cursor);
        }

        const snapshot = await query.get();
        const logs = snapshot.docs.map((doc) => doc.data() as ApiLogDocument);
        const nextCursor = logs.length === limit ? logs[logs.length - 1]?.createdAt ?? null : null;

        return { logs, nextCursor };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("FAILED_PRECONDITION")) {
            throw error;
        }

        const fallbackSnapshot = await adminDb
            .collection("api_logs")
            .where("userId", "==", userId)
            .limit(Math.max(limit * 3, 50))
            .get();

        const sorted = fallbackSnapshot.docs
            .map((doc) => doc.data() as ApiLogDocument)
            .sort((a, b) => b.createdAt - a.createdAt);

        const startIndex = cursor ? sorted.findIndex((log) => log.createdAt === cursor) + 1 : 0;
        const logs = sorted.slice(startIndex, startIndex + limit);
        const nextCursor = logs.length === limit ? logs[logs.length - 1]?.createdAt ?? null : null;

        return { logs, nextCursor };
    }
}

export async function getRecentApiLogs(userId: string, limit: number = 20): Promise<ApiLogDocument[]> {
    const { logs } = await getApiLogsPage(userId, limit);
    return logs;
}

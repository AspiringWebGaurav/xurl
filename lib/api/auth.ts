import { adminDb } from "@/lib/firebase/admin";
import { createApiRequestId } from "@/lib/api/logging";
import { hashApiKey } from "@/lib/api/crypto";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import type { UserDocument } from "@/types";

export interface ApiAuthSuccess {
    ok: true;
    requestId: string;
    userId: string;
    apiKeyHash: string;
    plan: ReturnType<typeof resolvePlanType>;
    quotaUsage: number;
    quotaTotal: number;
}

export interface ApiAuthFailure {
    ok: false;
    status: number;
    error: string;
    requestId: string;
}

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

function getBearerApiKey(authorizationHeader: string | null): string | null {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice("Bearer ".length).trim() || null;
}

export async function authenticateApiRequest(authorizationHeader: string | null): Promise<ApiAuthResult> {
    const requestId = createApiRequestId();
    const apiKey = getBearerApiKey(authorizationHeader);

    if (!apiKey) {
        return {
            ok: false,
            status: 401,
            error: "Invalid API key",
            requestId,
        };
    }

    const apiKeyHash = hashApiKey(apiKey);
    const matchingUsers = await adminDb
        .collection("users")
        .where("apiKeyHash", "==", apiKeyHash)
        .limit(1)
        .get();

    if (matchingUsers.empty) {
        return {
            ok: false,
            status: 401,
            error: "Invalid API key",
            requestId,
        };
    }

    const userRef = matchingUsers.docs[0].ref;

    return adminDb.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
            return {
                ok: false,
                status: 401,
                error: "Invalid API key",
                requestId,
            } satisfies ApiAuthFailure;
        }

        const user = userSnap.data() as UserDocument;
        if (user.apiKeyHash !== apiKeyHash) {
            return {
                ok: false,
                status: 401,
                error: "Invalid API key",
                requestId,
            } satisfies ApiAuthFailure;
        }

        const now = Date.now();
        const plan = resolvePlanType(user.plan);
        const isExpired = plan !== "free" && !!user.planExpiry && user.planExpiry < now;

        if (isExpired) {
            return {
                ok: false,
                status: 402,
                error: "Subscription expired. Your permanent links remain active, but monthly API access is paused. Please renew your subscription to resume API calls.",
                requestId,
            } satisfies ApiAuthFailure;
        }

        const effectivePlan = plan;
        const config = PLAN_CONFIGS[effectivePlan];
        const apiEnabled = Boolean(user.apiEnabled && config.apiAccess);
        const quotaTotal = user.apiQuotaTotal || config.apiQuotaTotal || 0;
        const quotaUsed = user.apiRequestsUsed || 0;

        if (!apiEnabled) {
            transaction.set(
                userRef,
                {
                    apiEnabled: false,
                    updatedAt: now,
                },
                { merge: true }
            );

            return {
                ok: false,
                status: 403,
                error: "API access is not enabled for your current plan",
                requestId,
            } satisfies ApiAuthFailure;
        }

        if (quotaUsed >= quotaTotal) {
            return {
                ok: false,
                status: 403,
                error: "API quota exceeded",
                requestId,
            } satisfies ApiAuthFailure;
        }

        const quotaUsage = quotaUsed + 1;
        transaction.set(
            userRef,
            {
                apiRequestsUsed: quotaUsage,
                updatedAt: now,
            },
            { merge: true }
        );

        return {
            ok: true,
            requestId,
            userId: user.uid || userRef.id,
            apiKeyHash,
            plan: effectivePlan,
            quotaUsage,
            quotaTotal,
        } satisfies ApiAuthSuccess;
    });
}

import { adminDb } from "@/lib/firebase/admin";
import { createApiRequestId } from "@/lib/api/logging";
import { hashApiKey } from "@/lib/api/crypto";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { isSubjectBanned } from "@/lib/admin-access";
import type { UserDocument } from "@/types";

export interface ApiAuthSuccess {
    ok: true;
    requestId: string;
    userId: string;
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

        if (isSubjectBanned(user.access)) {
            return {
                ok: false,
                status: 403,
                error: "Access suspended",
                requestId,
            } satisfies ApiAuthFailure;
        }

        const now = Date.now();
        const plan = resolvePlanType(user.plan);
        const isExpired = plan !== "free" && !!user.planExpiry && user.planExpiry < now;
        const effectivePlan = isExpired ? "free" : plan;
        const config = PLAN_CONFIGS[effectivePlan];
        const apiEnabled = Boolean(!isExpired && user.apiEnabled && config.apiAccess);
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
            plan: effectivePlan,
            quotaUsage,
            quotaTotal,
        } satisfies ApiAuthSuccess;
    });
}

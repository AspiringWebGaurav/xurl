import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";
import { logger } from "@/lib/utils/logger";
import { ensureApiProvisioning, getApiLogsPage, getEffectiveApiPlan, getRecentApiLogs, regenerateApiKeyForUser } from "@/services/api-access";
import type { UserDocument } from "@/types";

async function verifyUser(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    try {
        const userId = await verifyUser(request);
        if (!userId) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
        }

        const url = new URL(request.url);
        const cursorParam = url.searchParams.get("cursor");
        const limitParam = url.searchParams.get("limit");
        const limit = Math.min(Math.max(Number(limitParam) || 20, 5), 100);
        const cursor = cursorParam ? Number(cursorParam) : undefined;

        const userSnap = await adminDb.collection("users").doc(userId).get();
        if (!userSnap.exists) {
            return NextResponse.json({ code: "NOT_FOUND", message: "User not found." }, { status: 404 });
        }

        const currentUser = userSnap.data() as UserDocument;
        const plan = getEffectiveApiPlan(currentUser);
        const apiEligible = Boolean(PLAN_CONFIGS[plan].apiAccess);
        const logsPage = await getApiLogsPage(userId, limit, cursor);

        if (!apiEligible) {
            const apiRequestsUsed = currentUser.apiRequestsUsed || 0;
            const apiQuotaTotal = currentUser.apiQuotaTotal || 0;

            return NextResponse.json({
                plan,
                apiEligible: false,
                apiEnabled: false,
                apiKey: null,
                apiRequestsUsed,
                apiQuotaTotal,
                remainingRequests: Math.max(apiQuotaTotal - apiRequestsUsed, 0),
                recentRequests: logsPage.logs,
                nextCursor: logsPage.nextCursor,
            });
        }

        const provisioned = await ensureApiProvisioning(userId);
        const apiRequestsUsed = provisioned.user.apiRequestsUsed || 0;
        const apiQuotaTotal = provisioned.user.apiQuotaTotal || PLAN_CONFIGS[plan].apiQuotaTotal || 0;

        return NextResponse.json({
            plan,
            apiEligible: true,
            apiEnabled: Boolean(provisioned.user.apiEnabled),
            apiKey: provisioned.apiKey,
            apiRequestsUsed,
            apiQuotaTotal,
            remainingRequests: Math.max(apiQuotaTotal - apiRequestsUsed, 0),
            apiKeyLastRotatedAt: provisioned.user.apiKeyLastRotatedAt || null,
            recentRequests: logsPage.logs,
            nextCursor: logsPage.nextCursor,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load API access.";
        logger.error("api_user_api_access_get", message);
        return NextResponse.json({ code: "FETCH_FAILED", message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyUser(request);
        if (!userId) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
        }

        const userSnap = await adminDb.collection("users").doc(userId).get();
        if (!userSnap.exists) {
            return NextResponse.json({ code: "NOT_FOUND", message: "User not found." }, { status: 404 });
        }

        const currentUser = userSnap.data() as UserDocument;
        const plan = getEffectiveApiPlan(currentUser);
        if (!PLAN_CONFIGS[plan].apiAccess) {
            return NextResponse.json({ code: "FORBIDDEN", message: "API access is not enabled for your current plan." }, { status: 403 });
        }

        const regenerated = await regenerateApiKeyForUser(userId);
        const apiQuotaTotal = regenerated.user.apiQuotaTotal || PLAN_CONFIGS[plan].apiQuotaTotal || 0;
        const apiRequestsUsed = regenerated.user.apiRequestsUsed || 0;

        return NextResponse.json({
            success: true,
            apiKey: regenerated.apiKey,
            plan: resolvePlanType(regenerated.user.plan),
            apiRequestsUsed,
            apiQuotaTotal,
            remainingRequests: Math.max(apiQuotaTotal - apiRequestsUsed, 0),
            apiKeyLastRotatedAt: regenerated.user.apiKeyLastRotatedAt || null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to regenerate API key.";
        logger.error("api_user_api_access_post", message);
        const status = message.includes("not enabled") ? 403 : 500;
        return NextResponse.json({ code: "REGENERATE_FAILED", message }, { status });
    }
}

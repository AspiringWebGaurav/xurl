/**
 * Link CRUD API
 *
 * POST   /api/links   — Create a new link
 * GET    /api/links   — Get user's links (paginated)
 * DELETE /api/links   — Delete a link (slug in body)
 *
 * All mutating + user-scoped endpoints verify the Firebase ID token
 * server-side. Never trust a client-supplied `userId`.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { createLink, getUserLinks, deleteLink } from "@/services/links";
import { checkGuestLimit, checkGuestBanned } from "@/services/guest";
import { checkUserBanned } from "@/lib/admin-access";
import { PLAN_CONFIGS, GUEST_CONFIG, resolvePlanType } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { logger } from "@/lib/utils/logger";
import crypto from "crypto";

// Expiration policy (milliseconds)
// Guest expiration uses the centralized GUEST_TTL_MS from plan config
// AUTH_EXPIRATION_MS is no longer used here as TTL is determined by user plan inside createLink.

import { evaluateRequest } from "@/lib/redis/protection";
import { getRedisClient, safeRedis } from "@/lib/redis/client";
import { getClientIp } from "@/lib/utils/ip-resolver";

// ─── Auth Helper ────────────────────────────────────────────────────────────

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the user's UID on success, null on failure.
 */
async function verifyAuth(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}

// ─── POST: Create Link ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // Security Gateway (Redis)
        const ip = getClientIp(request);

        // Determine authenticated user
        let verifiedUid = await verifyAuth(request);

        // --- TEST BYPASS ---
        if (process.env.NODE_ENV !== "production") {
            const testHeader = request.headers.get("x-test-user-id");
            if (testHeader) verifiedUid = testHeader;
        }

        if (verifiedUid) {
            const { banned } = await checkUserBanned(verifiedUid);
            if (banned) {
                return NextResponse.json(
                    { code: "ACCESS_SUSPENDED", message: "Access suspended." },
                    { status: 403 }
                );
            }
        }

        const isGuest = !verifiedUid;
        const userId = verifiedUid || "anonymous";

        const forceRedisTest = request.headers.get("x-force-redis-test") === "true";
        const fingerprint = request.headers.get("x-device-fingerprint") || undefined;
        // Generate a behavior hash off IP and User-Agent to catch programmatic abuse that evades IP rotation
        const userAgent = request.headers.get("user-agent") || "unknown";
        const behaviorHash = crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");

        // Skip rate-limiting for automated tests in dev mode if they identify themselves via header or UID prefix, UNLESS forced
        // Skip rate-limiting for automated tests if they explicitly identify themselves via header
        const isTestUser = request.headers.get("x-test-bypass") === "true";
        if (!isTestUser || forceRedisTest) {
            // Check Redis protection layer
            // For guests, we set planDailyLimit to 1. For authenticated, we look it up or use a safe upper bound.
            // A precise plan limit is enforced strictly inside the Firebase transaction. Redis here is just an early shield.
            const { state } = await evaluateRequest(ip, userId, isGuest ? 1 : -1, fingerprint, behaviorHash);

            if (state === "BLOCK") {
                return NextResponse.json(
                    { code: "RATE_LIMITED", message: "Too many requests or abuse detected. Please try again later." },
                    { status: 429 }
                );
            }

            if (state === "SLOW") {
                // Introduce an artificial delay to slow down automated abuse
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // --- STRICT 10 REQ/MIN RATE LIMIT ---
            const identifier = isGuest ? ip : userId;
            const ratelimitKey = `ratelimit:${identifier}`;
            const currentCount = await safeRedis(async (c) => {
                const count = await c.incr(ratelimitKey);
                if (count === 1) {
                    await c.expire(ratelimitKey, 60);
                }
                return count;
            });

            if (currentCount !== null && currentCount > 10) {
                logger.warn("rate_limit_exceeded", `Hard limit exceeded for ${identifier}`);
                return NextResponse.json(
                    { code: "RATE_LIMITED", message: "Hard rate limit exceeded. Maximum 10 links per minute." },
                    { status: 429 }
                );
            }
        }

        const body = await request.json();
        const { originalUrl, customSlug, title } = body;
        const idempotencyKey = request.headers.get("x-idempotency-key") || request.headers.get("idempotency-key") || undefined;

        if (!originalUrl) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "originalUrl is required." },
                { status: 400 }
            );
        }

        // ── Server-side link-limit enforcement ──
        if (isGuest) {
            const { banned: guestBanned } = await checkGuestBanned(ip, fingerprint);
            if (guestBanned) {
                return NextResponse.json(
                    { code: "ACCESS_SUSPENDED", message: "Access suspended." },
                    { status: 403 }
                );
            }

            // Block custom alias for guests
            if (customSlug) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "Guest users cannot create custom aliases. Please sign in." },
                    { status: 403 }
                );
            }

            const guestStatus = await checkGuestLimit(ip, fingerprint);

            if (!guestStatus.allowed) {
                return NextResponse.json(
                    {
                        error: "guest_limit_reached",
                        code: "GUEST_LIMIT",
                        message: "Guest users can only create 1 link. Sign in to create more.",
                        expiresIn: guestStatus.expiresIn,
                        slug: guestStatus.slug,
                        originalUrl: guestStatus.originalUrl,
                        createdAt: guestStatus.createdAt
                    },
                    { status: 403 }
                );
            }
        } else {
            // Check auth user maximum limit is now handled natively in createLink mega-transaction
        }

        // ── Enforce expiration policy (server is source of truth) ──
        const now = Date.now();
        const expiresAt = isGuest
            ? now + GUEST_CONFIG.ttlMs
            : null; // Authenticated user TTL is calculated inside createLink based on their plan

        const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
        const fingerprintHash = fingerprint ? crypto.createHash("sha256").update(fingerprint).digest("hex") : undefined;

        const result = await createLink(userId, {
            originalUrl,
            customSlug,
            title,
            expiresAt,
            idempotencyKey,
            ipHash: isGuest ? ipHash : undefined,
            fingerprintHash: isGuest ? fingerprintHash : undefined
        });

        // Record guest usage natively inside createLink transaction closing TOCTOU

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create link.";
        const errorName = error instanceof Error ? error.name : "";
        logger.error("api_create_link", message);

        let status = 400;
        let code = "CREATE_FAILED";

        if (message.includes("Rate limit") || message.includes("abuse detected")) {
            status = 429;
            code = "RATE_LIMITED";
        } else if (message.includes("already taken") || message.includes("already exists")) {
            status = 409;
            code = "SLUG_TAKEN";
        } else if (errorName === "FreeCooldownActive") {
            status = 429;
            code = "FREE_COOLDOWN";
        } else if (errorName === "FreeLimitExhausted") {
            status = 403;
            code = "FREE_EXHAUSTED";
        } else if (errorName === "LimitReachedError") {
            status = 403;
            code = "PLAN_LIMIT";
        }

        logger.error("create_link_error", message, { status, code, errorName });
        return NextResponse.json({ code, message }, { status });
    }
}

// ─── GET: List User Links ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        // Require authentication for listing links
        const verifiedUid = await verifyAuth(request);
        if (!verifiedUid) {
            return NextResponse.json(
                { code: "UNAUTHORIZED", message: "Authentication required." },
                { status: 401 }
            );
        }

        const { banned } = await checkUserBanned(verifiedUid);
        if (banned) {
            return NextResponse.json(
                { code: "ACCESS_SUSPENDED", message: "Access suspended." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const rawPageSize = parseInt(searchParams.get("pageSize") || "25", 10);
        const pageSize = Math.min(Math.max(isNaN(rawPageSize) ? 25 : rawPageSize, 1), 100);
        const rawCursor = parseInt(searchParams.get("cursor") || "", 10);
        const cursor = isNaN(rawCursor) ? undefined : rawCursor;

        const result = await getUserLinks(verifiedUid, pageSize, cursor);

        const userDoc = await adminDb.collection("users").doc(verifiedUid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        let plan: PlanType = resolvePlanType(userData?.plan);
        
        // Live downgrade detection: if paid plan has expired, show as free
        const now = Date.now();
        if (plan !== "free" && userData?.planExpiry && userData.planExpiry < now) {
            plan = "free";
        }
        
        const config = PLAN_CONFIGS[plan];
        
        const giftQuotas = Array.isArray(userData?.giftQuotas) ? userData.giftQuotas : [];
        const activeGiftQuotas = giftQuotas.filter((gift: { amount: number; expiresAt: number | null }) => !gift.expiresAt || gift.expiresAt > now);
        const giftBonus = activeGiftQuotas.reduce((sum: number, gift: { amount: number }) => sum + (gift.amount || 0), 0);

        let effectiveLimit: number;
        if (plan === "free") {
            effectiveLimit = config.limit + giftBonus;
        } else {
            effectiveLimit = (userData?.cumulativeQuota || (config.limit * (userData?.planRenewals || 1))) + giftBonus;
        }
        
        const planRenewals = userData?.planRenewals || 1;

        // Use user document counters instead of scanning all links
        const totalLinksEver = userData?.linksCreated || 0;
        const activeLinksFromDoc = userData?.activeLinks || 0;

        // Count free vs paid active links only from the paginated result
        // (these are approximate since we only see the current page, but the
        // exact counts are enforced server-side in createLink transactions)
        let freeLinksCreated = 0;
        let paidLinksCreated = 0;

        result.links.forEach((link) => {
            if (!link.isActive) return;
            if (link.expiresAt && link.expiresAt <= now) return;
            if (link.createdUnderPlan === "free") {
                freeLinksCreated++;
            } else if (link.createdUnderPlan !== "guest") {
                paidLinksCreated++;
            }
        });

        // Calculate TTL for the client
        const planTtlMs = config.ttlMs;
        const planTtlHours = planTtlMs / (60 * 60 * 1000);

        // Add computed status to each link for the frontend
        let expiredLinksCount = 0;
        const enrichedLinks = result.links.map((link) => {
            let status: "active" | "expired" | "deactivated" = "active";
            if (!link.isActive) {
                status = "deactivated";
            } else if (link.expiresAt && link.expiresAt <= now) {
                status = "expired";
                expiredLinksCount++;
            }
            return { ...link, status };
        });

        return NextResponse.json({
            links: enrichedLinks,
            hasMore: result.links.length === pageSize,
            freeLinksCreated,
            paidLinksCreated,
            totalLinksEver,
            activeLinks: activeLinksFromDoc,
            expiredLinksCount,
            giftedLinksAvailable: giftBonus,
            limit: effectiveLimit,
            plan,
            planRenewals,
            planTtlHours
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch links.";
        logger.error("api_get_links", message);
        return NextResponse.json({ code: "FETCH_FAILED", message }, { status: 500 });
    }
}

// ─── DELETE: Delete Link ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
    try {
        // Require authentication for deletion
        const verifiedUid = await verifyAuth(request);
        if (!verifiedUid) {
            return NextResponse.json(
                { code: "UNAUTHORIZED", message: "Authentication required." },
                { status: 401 }
            );
        }

        const { banned } = await checkUserBanned(verifiedUid);
        if (banned) {
            return NextResponse.json(
                { code: "ACCESS_SUSPENDED", message: "Access suspended." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { slug } = body;

        if (!slug) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "slug is required." },
                { status: 400 }
            );
        }

        await deleteLink(slug, verifiedUid);

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete link.";
        logger.error("api_delete_link", message);

        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 500;
        return NextResponse.json({ code: "DELETE_FAILED", message }, { status });
    }
}

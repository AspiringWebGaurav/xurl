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
import { createLink, getUserLinks, deleteLink, countActiveLinksForUser } from "@/services/links";
import { checkGuestLimit, recordGuestUsage } from "@/services/guest";
import { logger } from "@/lib/utils/logger";

// Expiration policy (milliseconds)
const GUEST_EXPIRATION_MS = 2 * 60 * 60 * 1000;    // 2 hours
const AUTH_EXPIRATION_MS = 12 * 60 * 60 * 1000;     // 12 hours
const GUEST_LINK_LIMIT = 1;
const AUTH_LINK_LIMIT = 1000;

// ─── Per-IP Rate Limiter for POST requests ──────────────────────────────────
// Separate from the per-user rate limiter in services/links.ts.
// Catches abuse where many guests share the same "anonymous" rate limit bucket.

const postLimiter = new Map<string, { count: number; windowStart: number }>();
const POST_WINDOW_MS = 60_000;
const POST_MAX_PER_IP = 5; // 5 link creations per minute per IP
const MAX_POST_LIMITER_ENTRIES = 5_000;

function isPostRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = postLimiter.get(ip);

    if (!entry || now - entry.windowStart >= POST_WINDOW_MS) {
        if (postLimiter.size >= MAX_POST_LIMITER_ENTRIES) {
            for (const [key, val] of postLimiter) {
                if (now - val.windowStart >= POST_WINDOW_MS) postLimiter.delete(key);
                if (postLimiter.size < MAX_POST_LIMITER_ENTRIES * 0.8) break;
            }
        }
        postLimiter.set(ip, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= POST_MAX_PER_IP) return true;
    entry.count++;
    return false;
}

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
        // Per-IP rate limit (catches distributed bot floods)
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (isPostRateLimited(ip)) {
            return NextResponse.json(
                { code: "RATE_LIMITED", message: "Too many requests. Please wait before creating more links." },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { originalUrl, customSlug, title } = body;

        // Determine authenticated user
        const verifiedUid = await verifyAuth(request);
        const isGuest = !verifiedUid;
        const userId = verifiedUid || "anonymous";

        if (!originalUrl) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "originalUrl is required." },
                { status: 400 }
            );
        }

        // ── Server-side link-limit enforcement ──
        if (isGuest) {
            // Block custom alias for guests
            if (customSlug) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "Guest users cannot create custom aliases. Please sign in." },
                    { status: 403 }
                );
            }

            // Extract device fingerprint from custom header
            const fingerprint = request.headers.get("x-device-fingerprint") || undefined;
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
            // Check auth user maximum limit
            const userDoc = await adminDb.collection("users").doc(userId).get();
            if (userDoc.exists) {
                const data = userDoc.data()!;
                if (data.linksCreated >= AUTH_LINK_LIMIT) {
                    return NextResponse.json(
                        { code: "LIMIT_REACHED", message: "Maximum limit of 1000 links reached for this account." },
                        { status: 403 }
                    );
                }
            }
        }

        // ── Enforce expiration policy (server is source of truth) ──
        const now = Date.now();
        const expiresAt = isGuest
            ? now + GUEST_EXPIRATION_MS
            : now + AUTH_EXPIRATION_MS;

        const result = await createLink(userId, {
            originalUrl,
            customSlug,
            title,
            expiresAt,
        });

        // Record guest usage
        if (isGuest && result.slug) {
            const fingerprint = request.headers.get("x-device-fingerprint") || undefined;
            await recordGuestUsage(ip, fingerprint, result.slug, originalUrl, expiresAt);
        }

        return NextResponse.json({ success: true, link: result }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create link.";
        logger.error("api_create_link", message);

        const status = message.includes("Rate limit") ? 429 : message.includes("already taken") ? 409 : 400;
        return NextResponse.json({ code: "CREATE_FAILED", message }, { status });
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

        const { searchParams } = new URL(request.url);
        const rawPageSize = parseInt(searchParams.get("pageSize") || "25", 10);
        const pageSize = Math.min(Math.max(isNaN(rawPageSize) ? 25 : rawPageSize, 1), 100);

        const result = await getUserLinks(verifiedUid, pageSize);

        const userDoc = await adminDb.collection("users").doc(verifiedUid).get();
        const linksCreated = userDoc.exists ? (userDoc.data()?.linksCreated || 0) : 0;

        return NextResponse.json({
            links: result.links,
            hasMore: result.links.length === pageSize,
            linksCreated,
            limit: AUTH_LINK_LIMIT
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

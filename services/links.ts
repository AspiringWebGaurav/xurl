/**
 * Link Service — production-grade CRUD with:
 * - Atomic counter-based slug generation (collision-free)
 * - Slug-as-document-ID for O(1) Firestore lookups
 * - Cascading deletes (zero orphan policy)
 * - Cache invalidation on mutations
 * - Rate limiting on creation
 * - Structured logging
 *
 * Uses firebase-admin SDK — runs server-side only.
 */

import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { FieldValue } from "firebase-admin/firestore";
import { encodeBase62 } from "@/lib/utils/base62";
import { validateUrl } from "@/lib/utils/url-validator";
import { cacheInvalidate, setRedirectCache, negCacheInvalidate, setNegCacheRedis } from "@/lib/redis/redirect-cache";
import { recordSuccessfulGuestLink } from "@/lib/redis/protection";
import { rateLimitLinkCreation } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/utils/logger";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import type { LinkDocument, CreateLinkInput as OriginalCreateLinkInput, CreateLinkResponse, UserDocument } from "@/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_CONFIGS, GUEST_CONFIG, resolvePlanType } from "@/lib/plans";
import { buildShortUrl } from "@/lib/utils/url-builder";
import { safeRedis } from "@/lib/redis/client";

export interface CreateLinkInput extends OriginalCreateLinkInput {
    ipHash?: string;
    fingerprintHash?: string;
    guestSessionId?: string;
    quotaPreference?: 'free' | 'gift' | 'auto';
}

// Re-export for backward compatibility with existing imports
export { PLAN_CONFIGS } from "@/lib/plans";
export const GUEST_TTL_MS = GUEST_CONFIG.ttlMs;
export const GUEST_LINK_LIMIT = GUEST_CONFIG.limit;

// ─── CRUD ───────────────────────────────────────────────────────────────────

/**
 * Create a new shortened link.
 * Implements a server-side transactional quota system mapping to the user's plan.
 */
export async function createLink(userId: string, input: CreateLinkInput): Promise<CreateLinkResponse> {
    // Rate limit (skip for test users only in non-production environments)
    const isTestBypass = process.env.NODE_ENV !== "production" && (
        userId === "stress-test-user-123" || userId === "anonymous" || userId.startsWith("test_user_")
    );
    if (!isTestBypass) {
        const rateCheck = rateLimitLinkCreation(userId);
        if (!rateCheck.allowed) {
            logger.rateLimited(userId, "link_create");
            throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetMs / 1000)}s.`);
        }
    }

    // Validate URL
    const urlCheck = await validateUrl(input.originalUrl);
    if (!urlCheck.valid) {
        throw new Error(urlCheck.error || "Invalid URL.");
    }

    const now = Date.now();

    // Reserved slugs that would shadow Next.js app routes or admin routes
    const RESERVED_SLUGS = new Set([
        "api", "login", "expired", "_next", "not-found",
        "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
        "sw.js", "workbox", "vercel", ".well-known",
        "admin", "dashboard", "settings", "preview", "terms",
        "privacy", "acceptable-use", "about", "contact", "help", "support", "docs",
        "profile", "purchase-history", "pricing", "guest-policy", "placeholder", "r"
    ]);

    if (input.customSlug) {
        // Validate custom slug format (alphanumeric, hyphens, 2-30 chars)
        if (!/^[a-zA-Z0-9-]{2,30}$/.test(input.customSlug)) {
            throw new Error("Custom slug must be 2-30 characters, alphanumeric or hyphens only.");
        }

        // Block reserved slugs that would shadow application routes
        if (RESERVED_SLUGS.has(input.customSlug.toLowerCase())) {
            throw new Error("This slug is reserved and cannot be used.");
        }
    }

    const counterRef = adminDb.collection("system").doc("counter");
    let slug = "";
    let finalExpiresAt: number | null = input.expiresAt ?? null;
    let txResult: { resolvedPlan: string } | undefined;

    try {
        txResult = await adminDb.runTransaction(async (transaction) => {
            let counterSnap = null;
            if (!input.customSlug) {
                counterSnap = await transaction.get(counterRef);
            }

            if (input.customSlug) {
                const linkSnap = await transaction.get(adminDb.collection("links").doc(input.customSlug));
                if (linkSnap.exists) {
                    throw new Error(`Slug "${input.customSlug}" is already taken.`);
                }
            }

            let userData: Partial<UserDocument> = {
                plan: "free",
                activeLinks: 0,
                linksCreated: 0,
                createdAt: now,
                updatedAt: now,
            };
            let activeGiftQuotas: { id: string; amount: number; expiresAt: number | null; used?: number }[] = [];
            let originalGiftQuotaCount = 0;
            let consumedQuota: 'free' | 'gift' = 'free';
            let migratedGifts = false;
            let isAdminUser = false;

            // If user is authenticated, handle limits and logic via user doc
            if (userId !== "anonymous") {
                let userEmail = "";
                try {
                    const authUser = await adminAuth.getUser(userId);
                    userEmail = authUser.email || "";
                    isAdminUser = isAdminEmail(userEmail);
                } catch (e) {}

                const userRef = adminDb.collection("users").doc(userId);
                const userSnap = await transaction.get(userRef);

                if (userSnap.exists) {
                    userData = userSnap.data() as UserDocument;
                } else if (userId.startsWith("test_user_")) {
                    const parts = userId.split("_");
                    if (parts.length >= 3) {
                        userData.plan = resolvePlanType(parts[2]);
                    }
                }

                // Resolve legacy plan names (e.g. "freebie" → "free")
                let currentPlan: PlanType = resolvePlanType(userData.plan);

                // Admin override: always treat admins as enterprise users
                if (isAdminUser) {
                    currentPlan = "enterprise";
                    userData.plan = "enterprise";
                } else {
                    // Downgrade if subscription expired
                    if (currentPlan !== "free" && userData.planExpiry && userData.planExpiry < now) {
                        currentPlan = "free";
                        userData.plan = "free";
                        userData.planStatus = "past_due";
                    }
                }

                let giftQuotas = Array.isArray(userData.giftQuotas) ? userData.giftQuotas : [];
                
                // Lazy migration: Distribute legacy gift_usage_count to per-grant `used` fields
                let legacyGiftUsage = userData.gift_usage_count || 0;
                
                giftQuotas = giftQuotas.map(gift => {
                    if (typeof gift.used !== 'number') {
                        migratedGifts = true;
                        const toAllocate = Math.min(legacyGiftUsage, gift.amount);
                        legacyGiftUsage -= toAllocate;
                        return { ...gift, used: toAllocate };
                    }
                    return gift;
                });

                if (migratedGifts && userId !== "anonymous") {
                    userData.giftQuotas = giftQuotas;
                    // Note: We'll write this back at the end of the transaction
                }

                originalGiftQuotaCount = giftQuotas.length;
                activeGiftQuotas = giftQuotas.filter((gift) => !gift.expiresAt || gift.expiresAt > now);
                const remainingGiftLinks = activeGiftQuotas.reduce((sum, gift) => sum + Math.max(0, (gift.amount || 0) - (gift.used || 0)), 0);

                // ── Free Plan Cooldown & Usage Enforcement ──
                if (currentPlan === "free") {
                    const freeConfig = PLAN_CONFIGS.free;
                    const usageCount = userData.free_usage_count || 0;
                    const lastUsed = userData.free_last_used_at || 0;
                    const giftUsageCount = userData.gift_usage_count || 0;
                    
                    const effectiveMaxUses = (freeConfig.maxUses || 3);
                    const pref = input.quotaPreference || 'auto';

                    let usingGift = false;
                    
                    if (pref === 'gift') {
                        usingGift = true;
                    } else if (pref === 'free') {
                        usingGift = false;
                    } else {
                        // Auto: Use gift if free is exhausted or on cooldown
                        const freeExhausted = usageCount >= effectiveMaxUses;
                        const freeOnCooldown = freeConfig.cooldownMs && lastUsed && (now - lastUsed) < freeConfig.cooldownMs;
                        if ((freeExhausted || freeOnCooldown) && remainingGiftLinks > 0) {
                            usingGift = true;
                        }
                    }

                    if (usingGift) {
                        if (remainingGiftLinks <= 0) {
                            const e = new Error(`You have no remaining gift links. Upgrade to continue.`);
                            e.name = "FreeLimitExhausted";
                            throw e;
                        }
                        consumedQuota = 'gift';
                    } else {
                        if (freeConfig.maxUses && usageCount >= effectiveMaxUses) {
                            const e = new Error(`You have used all ${effectiveMaxUses} free links. Upgrade to continue.`);
                            e.name = "FreeLimitExhausted";
                            throw e;
                        }
                        if (freeConfig.cooldownMs && lastUsed && (now - lastUsed) < freeConfig.cooldownMs) {
                            const remainingMs = freeConfig.cooldownMs - (now - lastUsed);
                            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
                            const e = new Error(`Free plan cooldown active. You can create another link in ${remainingHours} hour${remainingHours > 1 ? 's' : ''}. Upgrade for instant access.`);
                            e.name = "FreeCooldownActive";
                            throw e;
                        }
                        consumedQuota = 'free';
                    }
                }

                const config = PLAN_CONFIGS[currentPlan];

                let effectiveLimit: number;
                if (currentPlan === "free") {
                    effectiveLimit = config.limit + remainingGiftLinks;
                } else {
                    // Use permanent accumulated limit, fallback for legacy users
                    effectiveLimit = (userData.cumulativeQuota || (config.limit * (userData.planRenewals || 1))) + remainingGiftLinks;
                }

                // Count ALL active links belonging to the user across ALL time (infinite accumulation)
                const linksQuery = adminDb.collection("links").where("userId", "==", userId).where("isActive", "==", true);
                const linksSnap = await transaction.get(linksQuery);

                let freeActiveCount = 0;
                let paidActiveCount = 0;
                linksSnap.forEach((doc) => {
                    const data = doc.data() as LinkDocument;
                    // Simply verify the link hasn't implicitly passed its TTL yet
                    if (!data.expiresAt || data.expiresAt > now) {
                        if (data.createdUnderPlan === "free") freeActiveCount++;
                        else if (data.createdUnderPlan !== "guest") paidActiveCount++;
                    }
                });

                // Enforce slug restriction
                if (input.customSlug && !config.slugAllowed) {
                    throw new Error("Custom aliases require a Starter plan or above.");
                }

                // Enforce strictly separated limits
                if (currentPlan === "free") {
                    if (freeActiveCount >= effectiveLimit) {
                        const e = new Error(`You have reached the limit of ${effectiveLimit} free active links. Upgrade to create more.`);
                        e.name = "LimitReachedError";
                        throw e;
                    }
                } else {
                    if (paidActiveCount >= effectiveLimit) {
                        const e = new Error(`You have reached the limit of ${effectiveLimit} active links for your ${currentPlan} plan. Renew or upgrade to create more.`);
                        e.name = "LimitReachedError";
                        throw e;
                    }
                }

                // Compute TTL for authenticated plan
                if (consumedQuota === 'gift') {
                    finalExpiresAt = null; // Gift links are permanent
                } else {
                    finalExpiresAt = now + config.ttlMs;
                }
            } else {
                // Determine Guest TTL
                finalExpiresAt = input.expiresAt ?? null;

                // Guest Limit Concurrency Protection
                if (input.ipHash && !input.ipHash.startsWith("test_")) {
                    const guestSnap = await transaction.get(adminDb.collection("guest_usage").doc(input.ipHash));
                    if (guestSnap.exists && (guestSnap.data() as { expiresAt?: number }).expiresAt! > now) {
                        const e = new Error(`Guest users can only create 1 link. Sign in to create more.`);
                        e.name = "LimitReachedError";
                        throw e;
                    }
                }

                if (input.fingerprintHash && !input.fingerprintHash.startsWith("test_")) {
                    const fpSnap = await transaction.get(adminDb.collection("guest_usage").doc(input.fingerprintHash));
                    if (fpSnap.exists && (fpSnap.data() as { expiresAt?: number }).expiresAt! > now) {
                        const e = new Error(`Guest users can only create 1 link. Sign in to create more.`);
                        e.name = "LimitReachedError";
                        throw e;
                    }
                }
            }

            // Generate Slug
            let currentId = 1000;
            if (input.customSlug) {
                slug = input.customSlug;
            } else {
                if (counterSnap && counterSnap.exists) {
                    currentId = counterSnap.data()!.currentId + 1;
                }
                slug = encodeBase62(currentId);

                // Safety check for generated slug and resolve deadlocks
                let genSnap = await transaction.get(adminDb.collection("links").doc(slug));
                let attempts = 0;
                while (genSnap.exists && attempts < 10) {
                    currentId++;
                    slug = encodeBase62(currentId);
                    genSnap = await transaction.get(adminDb.collection("links").doc(slug));
                    attempts++;
                }

                if (genSnap.exists) {
                    throw new Error(`Generated slug "${slug}" is already taken despite retries. System counter may be severely desynced.`);
                }
            }

            // ALL READS COMPELETE. START WRITES.
            if (!input.customSlug) {
                transaction.set(counterRef, { currentId }, { merge: true });
            }

            // Write Link
            const linkDoc: LinkDocument = {
                slug,
                originalUrl: urlCheck.url,
                userId,
                title: input.title || "",
                createdAt: now,
                updatedAt: now,
                expiresAt: finalExpiresAt,
                isActive: true,
                password: input.password ?? null,
                tags: input.tags ?? [],
                createdUnderPlan: userId === "anonymous" ? "guest" as PlanType : resolvePlanType(userData.plan) as PlanType,
                planEraStart: userId !== "anonymous" ? (userData.planEraStart || userData.planStart || userData.createdAt || now) : null,
                totalClicks: 0,
                deleteAt: finalExpiresAt ? finalExpiresAt + (7 * 24 * 60 * 60 * 1000) : null,
                guestSessionId: input.guestSessionId || null
            };
            transaction.set(adminDb.collection("links").doc(slug), linkDoc);

            if (userId === "anonymous" && input.ipHash) {
                transaction.set(adminDb.collection("guest_usage").doc(input.ipHash), {
                    ipHash: input.ipHash,
                    fingerprintHash: input.fingerprintHash || "none",
                    slug,
                    originalUrl: urlCheck.url,
                    expiresAt: finalExpiresAt,
                    createdAt: now
                });
                if (input.fingerprintHash) {
                    transaction.set(adminDb.collection("guest_usage").doc(input.fingerprintHash), {
                        ipHash: input.ipHash,
                        fingerprintHash: input.fingerprintHash,
                        slug,
                        originalUrl: urlCheck.url,
                        expiresAt: finalExpiresAt,
                        createdAt: now
                    });
                }
                if (input.guestSessionId) {
                    transaction.set(adminDb.collection("guest_sessions").doc(input.guestSessionId), {
                        slug,
                        locked: true,
                        expiresAt: finalExpiresAt,
                        createdAt: now
                    });
                }
            }

            if (userId !== "anonymous") {
                const resolvedPlan = resolvePlanType(userData.plan);
                const userUpdates: Record<string, unknown> = {
                    activeLinks: FieldValue.increment(1),
                    linksCreated: FieldValue.increment(1),
                    updatedAt: now,
                };
                if (!isAdminUser) {
                    userUpdates.plan = resolvedPlan;
                }
                if (userData.planStatus) {
                    userUpdates.planStatus = userData.planStatus;
                }
                if (migratedGifts || originalGiftQuotaCount !== activeGiftQuotas.length || activeGiftQuotas.length > 0) {
                    userUpdates.giftQuotas = activeGiftQuotas;
                }
                // Free plan: increment usage counter and record timestamp
                if (resolvedPlan === "free") {
                    if (consumedQuota === 'gift') {
                        userUpdates.gift_usage_count = FieldValue.increment(1);
                        
                        // Increment used count on the specific gift quota
                        for (const gift of activeGiftQuotas) {
                            const used = gift.used || 0;
                            if (used < gift.amount) {
                                gift.used = used + 1;
                                break;
                            }
                        }
                    } else {
                        userUpdates.free_usage_count = FieldValue.increment(1);
                        userUpdates.free_last_used_at = now;
                    }
                }
                transaction.set(adminDb.collection("users").doc(userId), userUpdates, { merge: true });
            }

            return {
                resolvedPlan: userId !== "anonymous" ? resolvePlanType(userData.plan || "free") : "guest",
                consumedQuota
            };
        }, { maxAttempts: 5 });
    } catch (e: unknown) {
        if (e instanceof Error && (e.name === "LimitReachedError" || e.name === "FreeLimitExhausted" || e.name === "FreeCooldownActive")) {
            // Re-throw plan/quota errors for the API to catch
            throw e;
        }
        throw e;
    }

    // Warm the cache and invalidate negative cache
    let ttlSeconds = 3600;
    if (finalExpiresAt) {
        ttlSeconds = Math.max(1, Math.floor((finalExpiresAt - Date.now()) / 1000));
    }
    setRedirectCache(slug, urlCheck.url, ttlSeconds);
    negCacheInvalidate(slug);

    if (userId === "anonymous" && input.fingerprintHash) {
        recordSuccessfulGuestLink(input.fingerprintHash, ttlSeconds);
    }

    if (userId === "anonymous" && input.ipHash) {
        safeRedis(c => c.incr(`usage:guest:${input.ipHash}`)).catch(e => logger.error("redis_incr", "Failed to incr guest usage", e));
    } else if (userId !== "anonymous" && txResult?.resolvedPlan === "free") {
        safeRedis(c => c.incr(`usage:free:${userId}`)).catch(e => logger.error("redis_incr", "Failed to incr free usage", e));
    }

    logger.linkCreated(slug, userId);
    try {
        await writeActivityEvent({
            type: "LINK_CREATED",
            actor: userId || null,
            sourceCollection: "links",
            metadata: {
                slug,
                shortUrl: buildShortUrl(slug),
                originalUrl: urlCheck.url,
                plan: txResult?.resolvedPlan ?? null,
            },
            severity: "INFO",
        });
    } catch (error) {
        logger.error("activity_event_write", "Failed to write LINK_CREATED event", {
            slug,
            userId,
            error: String(error),
        });
    }

    return {
        slug,
        shortUrl: buildShortUrl(slug),
        originalUrl: urlCheck.url,
        createdAt: now,
    };
}

/**
 * Get a link document by slug. Single Firestore read.
 */
export async function getLinkBySlug(slug: string): Promise<LinkDocument | null> {
    const snap = await adminDb.collection("links").doc(slug).get();
    if (!snap.exists) return null;
    return snap.data() as LinkDocument;
}

/**
 * Get paginated links for a user.
 */
export async function getUserLinks(
    userId: string,
    pageSize: number = 25,
    cursor?: number
): Promise<{ links: LinkDocument[]; lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null }> {
    let q = adminDb
        .collection("links")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc");

    if (cursor) {
        q = q.where("createdAt", "<", cursor);
    }

    q = q.limit(pageSize);

    const snapshot = await q.get();
    const links = snapshot.docs.map((d) => d.data() as LinkDocument);
    const last = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { links, lastDoc: last };
}

/**
 * Update a link's metadata. Invalidates cache.
 */
export async function updateLink(
    slug: string,
    userId: string,
    updates: Partial<Pick<LinkDocument, "originalUrl" | "title" | "isActive" | "expiresAt" | "password" | "tags">>
): Promise<void> {
    // Verify ownership
    const existing = await getLinkBySlug(slug);
    if (!existing) throw new Error("Link not found.");
    if (existing.userId !== userId) throw new Error("Unauthorized.");

    // Validate URL if being changed
    if (updates.originalUrl) {
        const urlCheck = await validateUrl(updates.originalUrl);
        if (!urlCheck.valid) throw new Error(urlCheck.error || "Invalid URL.");
        updates.originalUrl = urlCheck.url;
    }

    await adminDb.collection("links").doc(slug).update({
        ...updates,
        updatedAt: Date.now(),
    });

    // We no longer sync expiresAt to a quota array, as the activeLinks integer 
    // and Firebase Functions TTL handle link limits automatically.

    // Invalidate cache so next redirect fetches fresh data
    cacheInvalidate(slug);
}

/**
 * Delete a link and ALL related data.
 * Implements zero-orphan-data policy via batched deletes.
 */
export async function deleteLink(slug: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await getLinkBySlug(slug);
    if (!existing) throw new Error("Link not found.");
    if (existing.userId !== userId) throw new Error("Unauthorized.");

    // 1) Delete the link document
    // Fix: Mark as deleted by API to prevent Cloud Function from double-decrementing activeLinks
    await adminDb.collection("links").doc(slug).update({ deletedByApi: true });
    await adminDb.collection("links").doc(slug).delete();

    // 2) Delete ALL related analytics documents (loop to handle >500)
    const MAX_BATCH = 500;
    let deletedTotal = 0;
    const SAFETY_CAP = 5000; // prevent infinite loop

    while (deletedTotal < SAFETY_CAP) {
        const analyticsSnap = await adminDb
            .collection("analytics")
            .where("slug", "==", slug)
            .limit(MAX_BATCH)
            .get();

        if (analyticsSnap.empty) break;

        const batch = adminDb.batch();
        analyticsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deletedTotal += analyticsSnap.size;

        if (analyticsSnap.size < MAX_BATCH) break; // No more docs
    }

    // 3) Update user's link counters
    try {
        await adminDb.collection("users").doc(userId).set(
            {
                activeLinks: FieldValue.increment(-1),
                // Note: linksCreated is a lifetime counter and must NOT be decremented
                updatedAt: Date.now(),
            },
            { merge: true }
        );
    } catch {
        logger.warn("link_delete", `Failed to update user counters for ${userId}`);
    }

    // 5) Invalidate cache and instantly flag it as missing for edge servers
    cacheInvalidate(slug);
    setNegCacheRedis(slug, 3600); // 1 hour negative cache so edge instantly blocks it without hitting DB

    logger.linkDeleted(slug, userId);
}

/**
 * Admin: Universal update function for any link, bypassing ownership checks.
 */
export async function adminUpdateLink(slug: string, updates: Partial<LinkDocument>): Promise<void> {
    const existing = await getLinkBySlug(slug);
    if (!existing) throw new Error("Link not found.");

    await adminDb.collection("links").doc(slug).update({
        ...updates,
        updatedAt: Date.now(),
    });

    // Touch user document to trigger real-time UI synchronization for the user
    try {
        await adminDb.collection("users").doc(existing.userId).set({
            updatedAt: Date.now()
        }, { merge: true });
    } catch {
        logger.warn("admin_link_update", `Failed to update user timestamp for ${existing.userId}`);
    }

    cacheInvalidate(slug);
}

/**
 * Admin: Hard delete a link and ALL related data, bypassing ownership checks.
 */
export async function adminDeleteLink(slug: string): Promise<void> {
    const existing = await getLinkBySlug(slug);
    if (!existing) throw new Error("Link not found.");

    // 1) Delete the link document
    await adminDb.collection("links").doc(slug).update({ deletedByApi: true });
    await adminDb.collection("links").doc(slug).delete();

    // 2) Delete ALL related analytics documents
    const MAX_BATCH = 500;
    let deletedTotal = 0;
    const SAFETY_CAP = 5000; 

    while (deletedTotal < SAFETY_CAP) {
        const analyticsSnap = await adminDb
            .collection("analytics")
            .where("slug", "==", slug)
            .limit(MAX_BATCH)
            .get();

        if (analyticsSnap.empty) break;

        const batch = adminDb.batch();
        analyticsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deletedTotal += analyticsSnap.size;

        if (analyticsSnap.size < MAX_BATCH) break;
    }

    // 3) Update user's link counters
    try {
        await adminDb.collection("users").doc(existing.userId).set(
            {
                activeLinks: FieldValue.increment(-1),
                linksCreated: FieldValue.increment(-1),
                updatedAt: Date.now(),
            },
            { merge: true }
        );
    } catch {
        logger.warn("admin_link_delete", `Failed to update user counters for ${existing.userId}`);
    }

    // 4) Wipe guest_usage if it was a guest link
    if (existing.userId === "anonymous") {
        try {
            const guestSnap = await adminDb.collection("guest_usage").where("slug", "==", slug).get();
            if (!guestSnap.empty) {
                const batch = adminDb.batch();
                guestSnap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
        } catch {
            logger.warn("admin_link_delete", `Failed to wipe guest_usage for ${slug}`);
        }
    }

    // 5) Invalidate cache and instantly flag it as missing for edge servers
    cacheInvalidate(slug);
    setNegCacheRedis(slug, 3600); // 1 hour negative cache so edge instantly blocks it without hitting DB

    logger.info("admin_link_deleted", `Admin deleted link ${slug} (owner: ${existing.userId})`);
}

/**
 * Removes the guest usage tracking for a specific guest link, 
 * effectively lifting the signup lock for that specific guest 
 * without deleting the link itself.
 */
export async function adminLiftGuestLock(slug: string) {
    try {
        const guestSnap = await adminDb.collection("guest_usage").where("slug", "==", slug).get();
        if (!guestSnap.empty) {
            const batch = adminDb.batch();
            guestSnap.docs.forEach((d) => batch.delete(d.ref));
            
            // Also delete from guest_sessions to instantly unlock the client's live listener
            const sessionSnap = await adminDb.collection("guest_sessions").where("slug", "==", slug).get();
            sessionSnap.docs.forEach((d) => batch.delete(d.ref));

            await batch.commit();
            logger.info("admin_lift_guest_lock", `Admin lifted guest lock for slug ${slug}`);
        }
    } catch (e) {
        logger.error("admin_lift_guest_lock", `Failed to lift guest lock for ${slug}`, { error: e });
        throw e;
    }
}

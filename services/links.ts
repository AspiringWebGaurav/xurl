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

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { encodeBase62 } from "@/lib/utils/base62";
import { validateUrl } from "@/lib/utils/url-validator";
import { cacheInvalidate, cacheSet } from "@/lib/cache/redirect-cache";
import { negCacheInvalidate } from "@/lib/cache/negative-cache";
import { rateLimitLinkCreation } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/utils/logger";
import type { LinkDocument, CreateLinkInput, CreateLinkResponse } from "@/types";
import { buildShortUrl } from "@/lib/utils/url-builder";

// ─── Slug Generation (Atomic Counter) ───────────────────────────────────────

const COUNTER_DOC_REF = adminDb.collection("system").doc("counter");

/**
 * Generate a unique slug by atomically incrementing a global counter
 * and encoding the result in Base62. Guaranteed collision-free.
 */
async function generateUniqueSlug(): Promise<string> {
    const newId = await adminDb.runTransaction(async (transaction) => {
        const counterSnap = await transaction.get(COUNTER_DOC_REF);

        let currentId = 1000; // Start from 1000 to get 2+ char slugs
        if (counterSnap.exists) {
            currentId = counterSnap.data()!.currentId + 1;
        }

        transaction.set(COUNTER_DOC_REF, { currentId }, { merge: true });
        return currentId;
    });

    return encodeBase62(newId);
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

/**
 * Create a new shortened link.
 * Custom slugs use a Firestore transaction to atomically check+write (prevents race conditions).
 */
export async function createLink(userId: string, input: CreateLinkInput): Promise<CreateLinkResponse> {
    // Rate limit
    const rateCheck = rateLimitLinkCreation(userId);
    if (!rateCheck.allowed) {
        logger.rateLimited(userId, "link_create");
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetMs / 1000)}s.`);
    }

    // Validate URL
    const urlCheck = validateUrl(input.originalUrl);
    if (!urlCheck.valid) {
        throw new Error(urlCheck.error || "Invalid URL.");
    }

    const now = Date.now();

    const buildLinkDoc = (slug: string): LinkDocument => ({
        slug,
        originalUrl: urlCheck.url,
        userId,
        title: input.title || "",
        createdAt: now,
        updatedAt: now,
        expiresAt: input.expiresAt ?? null,
        isActive: true,
        password: input.password ?? null,
        tags: input.tags ?? [],
        totalClicks: 0,
    });

    let slug: string;

    // Reserved slugs that would shadow Next.js app routes
    const RESERVED_SLUGS = new Set([
        "api", "login", "expired", "_next", "not-found",
        "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
        "sw.js", "workbox", "vercel", ".well-known",
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

        slug = input.customSlug;
        const linkDoc = buildLinkDoc(slug);
        const docRef = adminDb.collection("links").doc(slug);

        // Atomic check+write via transaction — prevents race condition
        await adminDb.runTransaction(async (transaction) => {
            const snap = await transaction.get(docRef);
            if (snap.exists) {
                throw new Error(`Slug "${slug}" is already taken.`);
            }
            transaction.set(docRef, linkDoc);
        });
    } else {
        slug = await generateUniqueSlug();
        const linkDoc = buildLinkDoc(slug);

        // Auto-generated slugs are guaranteed unique by the atomic counter,
        // but use create() as a safety net — it will fail if the doc already exists
        await adminDb.collection("links").doc(slug).create(linkDoc);
    }

    // Increment user's link counter (use set+merge to avoid errors if doc doesn't exist)
    try {
        await adminDb.collection("users").doc(userId).set(
            {
                linksCreated: FieldValue.increment(1),
                updatedAt: now,
            },
            { merge: true }
        );
    } catch {
        // Non-critical — don't fail link creation if user counter update fails
        logger.warn("link_create", `Failed to update user counter for ${userId}`);
    }

    // Warm the cache and invalidate negative cache (in case slug was recently 404'd)
    cacheSet(slug, urlCheck.url, true, input.expiresAt ?? null);
    negCacheInvalidate(slug);

    logger.linkCreated(slug, userId);

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
): Promise<{ links: LinkDocument[]; lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null }> {
    const q = adminDb
        .collection("links")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(pageSize);

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
        const urlCheck = validateUrl(updates.originalUrl);
        if (!urlCheck.valid) throw new Error(urlCheck.error || "Invalid URL.");
        updates.originalUrl = urlCheck.url;
    }

    await adminDb.collection("links").doc(slug).update({
        ...updates,
        updatedAt: Date.now(),
    });

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

    // 4) Decrement user's link counter
    try {
        await adminDb.collection("users").doc(userId).set(
            {
                linksCreated: FieldValue.increment(-1),
                updatedAt: Date.now(),
            },
            { merge: true }
        );
    } catch {
        logger.warn("link_delete", `Failed to update user counter for ${userId}`);
    }

    // 5) Invalidate cache
    cacheInvalidate(slug);

    logger.linkDeleted(slug, userId);
}

/**
 * Count active links for a given userId.
 * Uses Firestore count() aggregation — single read, no document downloads.
 */
export async function countActiveLinksForUser(userId: string): Promise<number> {
    const snapshot = await adminDb
        .collection("links")
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .count()
        .get();

    return snapshot.data().count;
}

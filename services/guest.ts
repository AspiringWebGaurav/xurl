import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";
import { DEFAULT_ACCESS, type GuestEntity, type PublicGuestAccess, type SubjectAccess } from "@/types";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { isSubjectBanned } from "@/lib/admin-access";
import { acquireGuestCreationLock, releaseGuestCreationLock } from "@/lib/redis/guest-lock";

const GUEST_USAGE_COLLECTION = "guest_usage";
const GUEST_ENTITIES_COLLECTION = "guest_entities";
const PUBLIC_GUEST_ACCESS_COLLECTION = "public_guest_access";

export interface GuestUsageRecord {
    ipHash: string;
    fingerprintHash: string;
    slug: string;
    originalUrl: string;
    expiresAt: number;
    createdAt: number;
}

function hashData(data: string, salt: string = ""): string {
    return crypto.createHash("sha256").update(`${data}${salt}`).digest("hex");
}

export async function checkGuestLimit(
    ip: string,
    fingerprint: string | undefined
): Promise<{ allowed: boolean; expiresIn?: number; slug?: string; originalUrl?: string; createdAt?: number }> {
    const ipHash = hashData(ip);
    const fingerprintHash = fingerprint ? hashData(fingerprint) : null;
    const now = Date.now();

    const ipSnap = await adminDb
        .collection(GUEST_USAGE_COLLECTION)
        .where("ipHash", "==", ipHash)
        .where("expiresAt", ">", now)
        .limit(1)
        .get();

    if (!ipSnap.empty) {
        const data = ipSnap.docs[0].data() as GuestUsageRecord;
        return {
            allowed: false,
            expiresIn: Math.ceil((data.expiresAt - now) / 1000),
            slug: data.slug,
            originalUrl: data.originalUrl,
            createdAt: data.createdAt,
        };
    }

    if (fingerprintHash) {
        const fpSnap = await adminDb
            .collection(GUEST_USAGE_COLLECTION)
            .where("fingerprintHash", "==", fingerprintHash)
            .where("expiresAt", ">", now)
            .limit(1)
            .get();

        if (!fpSnap.empty) {
            const data = fpSnap.docs[0].data() as GuestUsageRecord;
            return {
                allowed: false,
                expiresIn: Math.ceil((data.expiresAt - now) / 1000),
                slug: data.slug,
                originalUrl: data.originalUrl,
                createdAt: data.createdAt,
            };
        }
    }

    return { allowed: true };
}

function generatePublicAccessKey(guestId: string): string {
    return crypto
        .createHash("sha256")
        .update(`guest_access_v1_${guestId}`)
        .digest("hex")
        .substring(0, 48);
}

export function resolveGuestId(ipHash: string, fingerprintHash: string | null): string {
    return fingerprintHash || ipHash;
}

export async function resolveGuestEntity(
    ip: string,
    fingerprint: string | undefined,
    userAgent?: string | null
): Promise<{ entity: GuestEntity; banned: boolean }> {
    const ipHash = hashData(ip);
    const fingerprintHash = fingerprint ? hashData(fingerprint) : null;
    const userAgentHash = userAgent ? hashData(userAgent) : null;
    const guestId = resolveGuestId(ipHash, fingerprintHash);
    const now = Date.now();

    const ref = adminDb.collection(GUEST_ENTITIES_COLLECTION).doc(guestId);

    // Acquire distributed lock for creation
    const lockAcquired = await acquireGuestCreationLock(guestId, 10);

    try {
        // Fetch existing entity by computed guestId first
        const snap = await ref.get();

        if (!snap.exists && fingerprintHash) {
            // If fingerprint exists but guestId was IP-based, try fingerprint guestId as well
            const fpRef = adminDb.collection(GUEST_ENTITIES_COLLECTION).doc(fingerprintHash);
            const fpSnap = await fpRef.get();
            if (fpSnap.exists) {
                const existing = fpSnap.data() as GuestEntity;
                const updates: Record<string, unknown> = {
                    lastSeenAt: now,
                    lastInteractionAt: now,
                };
                if (userAgentHash) updates.lastUserAgentHash = userAgentHash;
                if (!existing.fingerprintHash) updates.fingerprintHash = fingerprintHash;
                if (!existing.ipHash) updates.ipHash = ipHash;
                await fpRef.update(updates);
                const merged = { ...existing, ...updates } as GuestEntity;
                return { entity: merged, banned: isSubjectBanned(merged.access) };
            }
        }

        if (snap.exists) {
            const existing = snap.data() as GuestEntity;

            const updates: Record<string, unknown> = {
                lastSeenAt: now,
                lastInteractionAt: now,
            };

            if (userAgentHash) {
                updates.lastUserAgentHash = userAgentHash;
            }

            if (fingerprintHash && !existing.fingerprintHash) {
                updates.fingerprintHash = fingerprintHash;
                updates.canonicalIdentityStrength = "fingerprint";
            }

            if (ipHash && !existing.ipHash) {
                updates.ipHash = ipHash;
            }

            if (fingerprintHash && existing.guestId !== fingerprintHash && existing.canonicalIdentityStrength === "ip") {
                const aliasSet = new Set(existing.aliasGuestIds || []);
                aliasSet.add(existing.guestId);
                updates.aliasGuestIds = Array.from(aliasSet);
            }

            await ref.update(updates);

            const merged = { ...existing, ...updates } as GuestEntity;
            return { entity: merged, banned: isSubjectBanned(merged.access) };
        }

        // Entity does NOT exist - create atomically with transaction
        if (!lockAcquired) {
            // Another instance is creating this entity, wait and retry read
            await new Promise(resolve => setTimeout(resolve, 100));
            const retrySnap = await ref.get();
            if (retrySnap.exists) {
                const entity = retrySnap.data() as GuestEntity;
                return { entity, banned: isSubjectBanned(entity.access) };
            }
            // Still doesn't exist - Redis failed, rely on Firestore transaction only
        }

        const publicAccessKey = generatePublicAccessKey(guestId);
        const newEntity: GuestEntity = {
            guestId,
            fingerprintHash,
            ipHash,
            firstSeenAt: now,
            lastSeenAt: now,
            lastInteractionAt: now,
            lastUserAgentHash: userAgentHash,
            activeSlug: null,
            activeLinkExpiresAt: null,
            aliasGuestIds: [],
            access: { ...DEFAULT_ACCESS, updatedAt: now },
            publicAccessKey,
            canonicalIdentityStrength: fingerprintHash ? "fingerprint" : "ip",
        };

        // Use Firestore transaction for atomic multi-collection write
        const finalEntity = await adminDb.runTransaction(async (tx) => {
            const txSnap = await tx.get(ref);
            if (txSnap.exists) {
                // Entity was created by another request, return it
                return txSnap.data() as GuestEntity;
            }

            tx.set(ref, newEntity);

            const projection: PublicGuestAccess = {
                status: newEntity.access.status,
                reason: newEntity.access.reason,
                expiresAt: newEntity.access.expiresAt,
                version: newEntity.access.version,
                updatedAt: newEntity.access.updatedAt,
            };
            tx.set(
                adminDb.collection(PUBLIC_GUEST_ACCESS_COLLECTION).doc(publicAccessKey),
                projection
            );

            return newEntity;
        });

        return { entity: finalEntity, banned: false };
    } finally {
        // Always release lock
        if (lockAcquired) {
            await releaseGuestCreationLock(guestId);
        }
    }
}

/**
 * Cross-checks a banned entity against its public projection.
 * If the projection says "active" but the entity says "banned", a previous
 * unban write reached public_guest_access but didn't fully commit to
 * guest_entities. This repairs the entity and unblocks the guest.
 * Returns the repaired access if a repair was made, null otherwise.
 */
async function repairEntityFromProjection(
    guestId: string,
    currentAccess: SubjectAccess,
    publicAccessKey: string
): Promise<SubjectAccess | null> {
    try {
        const projSnap = await adminDb
            .collection(PUBLIC_GUEST_ACCESS_COLLECTION)
            .doc(publicAccessKey)
            .get();

        if (!projSnap.exists || projSnap.data()?.status !== "active") {
            return null; // projection also says banned — no repair
        }

        const repairedAccess: SubjectAccess = {
            ...currentAccess,
            status: "active",
            mode: null,
            expiresAt: null,
            updatedAt: Date.now(),
            updatedBy: "system_repair_sync",
        };

        await adminDb
            .collection(GUEST_ENTITIES_COLLECTION)
            .doc(guestId)
            .update({ access: repairedAccess });

        console.warn(`[guest] repaired stale banned entity for guestId=${guestId}`);
        return repairedAccess;
    } catch (err) {
        console.error("[guest] repairEntityFromProjection failed:", err);
        return null; // fail-safe: don't unblock if repair errors
    }
}

export async function checkGuestBanned(
    ip: string,
    fingerprint: string | undefined
): Promise<{ banned: boolean; access: SubjectAccess | null; publicAccessKey: string | null }> {
    try {
        const ipHash = hashData(ip);
        const fingerprintHash = fingerprint ? hashData(fingerprint) : null;
        const guestId = resolveGuestId(ipHash, fingerprintHash);

        const snap = await adminDb.collection(GUEST_ENTITIES_COLLECTION).doc(guestId).get();

        // CRITICAL FIX: Missing entity = NOT banned (allow through)
        // Entity creation happens lazily on first link creation, not on access check
        if (!snap.exists) {
            return { banned: false, access: null, publicAccessKey: null };
        }

        const data = snap.data() as GuestEntity;
        const access = data.access ?? null;

        // Auto-expire temporary bans inline
        if (access?.status === "banned" && access.mode === "temporary" && access.expiresAt && access.expiresAt <= Date.now()) {
            const next = await autoExpireGuestAccess(data.guestId, access, data.publicAccessKey);
            return { banned: false, access: next, publicAccessKey: data.publicAccessKey };
        }

        // Defensive: if entity still shows banned, cross-check the projection
        // to catch any entity/projection divergence from a prior unban
        if (isSubjectBanned(access) && data.publicAccessKey) {
            const repaired = await repairEntityFromProjection(data.guestId, access, data.publicAccessKey);
            if (repaired) {
                return { banned: false, access: repaired, publicAccessKey: data.publicAccessKey };
            }
        }

        return {
            banned: isSubjectBanned(access),
            access,
            publicAccessKey: data.publicAccessKey,
        };
    } catch (err) {
        console.error("[guest] checkGuestBanned error:", err);
        return { banned: true, access: null, publicAccessKey: null };
    }
}

export async function checkGuestBannedByHash(
    ipHash: string | null,
    fingerprintHash: string | null
): Promise<{ banned: boolean; access: SubjectAccess | null }> {
    try {
        const guestId = resolveGuestId(ipHash || "", fingerprintHash);
        const snap = await adminDb.collection(GUEST_ENTITIES_COLLECTION).doc(guestId).get();
        if (!snap.exists) return { banned: true, access: null };

        const data = snap.data() as GuestEntity;
        const access = data.access ?? null;

        if (access?.status === "banned" && access.mode === "temporary" && access.expiresAt && access.expiresAt <= Date.now()) {
            const next = await autoExpireGuestAccess(data.guestId, access, data.publicAccessKey);
            return { banned: false, access: next };
        }

        if (isSubjectBanned(access) && data.publicAccessKey) {
            const repaired = await repairEntityFromProjection(data.guestId, access, data.publicAccessKey);
            if (repaired) {
                return { banned: false, access: repaired };
            }
        }

        return { banned: isSubjectBanned(access), access };
    } catch (err) {
        console.error("[guest] checkGuestBannedByHash error:", err);
        return { banned: true, access: null };
    }
}

export async function writePublicGuestAccess(publicAccessKey: string, access: SubjectAccess): Promise<void> {
    const projection: PublicGuestAccess = {
        status: access.status,
        reason: access.reason,
        expiresAt: access.expiresAt,
        version: access.version,
        updatedAt: access.updatedAt,
    };
    await adminDb.collection(PUBLIC_GUEST_ACCESS_COLLECTION).doc(publicAccessKey).set(projection);
}

async function autoExpireGuestAccess(guestId: string, current: SubjectAccess, publicAccessKey?: string) {
    const now = Date.now();
    const nextVersion = (current.version ?? 0) + 1;
    const nextAccess: SubjectAccess = {
        status: "active",
        mode: null,
        reason: null,
        expiresAt: null,
        updatedAt: now,
        updatedBy: "system_auto_expiry",
        version: nextVersion,
        banId: null,
    };

    await adminDb.collection(GUEST_ENTITIES_COLLECTION).doc(guestId).update({ access: nextAccess });
    if (publicAccessKey) {
        await writePublicGuestAccess(publicAccessKey, nextAccess);
    }
    await writeActivityEvent({
        type: "ACCESS_EXPIRE_AUTO",
        actor: "system_auto_expiry",
        sourceCollection: GUEST_ENTITIES_COLLECTION,
        severity: "INFO",
        metadata: {
            subjectType: "guest",
            subjectId: guestId,
            action: "expire_auto_unban",
            prevVersion: current.version ?? 0,
            nextVersion,
            prevStatus: current.status,
        },
    });
    return nextAccess;
}
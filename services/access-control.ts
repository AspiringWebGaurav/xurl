import { adminDb } from "@/lib/firebase/admin";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { writePublicGuestAccess, ensureUserGuestEntity } from "@/services/guest";
import { cacheInvalidate, negCacheInvalidate } from "@/lib/redis/redirect-cache";
import type { SubjectAccess, AccessMode, PublicGuestAccess } from "@/types";
import { DEFAULT_ACCESS } from "@/types";
import { assertNoRandomDocId, assertValidAccessStatus, logAccessOperation } from "@/lib/firestore-strict-update";
import crypto from "crypto";

export type BanSubjectType = "user" | "guest";

export interface BanInput {
    subjectType: BanSubjectType;
    subjectId: string;
    reason: string | null;
    mode: AccessMode;
    expiresAt: number | null;
    ownerEmail: string;
}

export interface UnbanInput {
    subjectType: BanSubjectType;
    subjectId: string;
    ownerEmail: string;
}

export interface AccessMutationResult {
    ok: boolean;
    message: string;
    access?: SubjectAccess;
}

async function writeAccessAction(input: {
    action: "ban" | "unban";
    subjectType: BanSubjectType;
    subjectId: string;
    ownerEmail: string;
    prevAccess: SubjectAccess;
    nextAccess: SubjectAccess;
    banId?: string | null;
}) {
    const now = Date.now();
    await adminDb.collection("access_actions").add({
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        ownerEmail: input.ownerEmail,
        banId: input.banId ?? null,
        prevAccess: input.prevAccess,
        nextAccess: input.nextAccess,
        createdAt: now,
        updatedAt: now,
        metadata: {
            action: input.action,
            subjectId: input.subjectId,
            prevVersion: input.prevAccess.version,
            nextVersion: input.nextAccess.version,
            prevStatus: input.prevAccess.status,
        },
    });
}

function collectionForSubject(subjectType: BanSubjectType): string {
    return subjectType === "user" ? "users" : "guest_entities";
}

function toPublicProjection(access: SubjectAccess): PublicGuestAccess {
    return {
        status: access.status,
        reason: access.reason,
        expiresAt: access.expiresAt,
        version: access.version,
        updatedAt: access.updatedAt,
    };
}

export async function banSubject(input: BanInput): Promise<AccessMutationResult> {
    const { subjectType, subjectId, reason, mode, expiresAt, ownerEmail } = input;
    const now = Date.now();
    const banId = crypto.randomUUID();

    console.log(`[BAN_START] subjectType=${subjectType} subjectId=${subjectId} mode=${mode}`);

    try {
        // Validate inputs
        assertNoRandomDocId(subjectId, "banSubject");
        assertValidAccessStatus("banned", "banSubject");

        // Resolve target document ID
        let targetGuestId = subjectId;
        if (subjectType === "user") {
            // For users, find their linked guest_entity
            const guestSnap = await adminDb
                .collection("guest_entities")
                .where("userId", "==", subjectId)
                .limit(1)
                .get();
            
            if (!guestSnap.empty) {
                targetGuestId = guestSnap.docs[0].id;
                console.log(`[BAN] User ${subjectId} linked to guest_entity ${targetGuestId}`);
            } else {
                // User has no guest_entity - create one (legitimate case for new users)
                console.warn(`[BAN] User ${subjectId} has no guest_entity, creating one`);
                const { guestId } = await ensureUserGuestEntity(subjectId);
                targetGuestId = guestId;
                
                // Ensure bidirectional link
                const userRef = adminDb.collection("users").doc(subjectId);
                const userSnap = await userRef.get();
                if (userSnap.exists && userSnap.data()?.guestId !== guestId) {
                    await userRef.update({ 
                        guestId, 
                        updatedAt: Date.now() 
                    });
                    console.log(`[BAN] Linked user ${subjectId} to guest_entity ${guestId}`);
                }
            }
        } else {
            // For guests, subjectId IS the document ID (not the guestId field)
            // Validate document exists
            const guestRef = adminDb.collection("guest_entities").doc(subjectId);
            const guestSnap = await guestRef.get();
            if (!guestSnap.exists) {
                const error = `Guest entity ${subjectId} does not exist`;
                console.error(`[BAN_ERROR] ${error}`);
                return { ok: false, message: error };
            }
            console.log(`[BAN] Guest entity ${subjectId} found, proceeding with ban`);
        }
        
        // Always ban the guest entity (single source of truth)
        const ref = adminDb.collection("guest_entities").doc(targetGuestId);
        console.log(`[BAN] Target document: guest_entities/${targetGuestId}`);
        
        // Retry loop for optimistic locking
        let attempts = 0;
        const maxAttempts = 3;
        let result: any;

        while (attempts < maxAttempts) {
            try {
                result = await adminDb.runTransaction(async (tx) => {
                    const snap = await tx.get(ref);
                    if (!snap.exists) {
                        const error = `Guest entity ${targetGuestId} not found in transaction`;
                        console.error(`[BAN_TX_ERROR] ${error}`);
                        return { ok: false, message: error } as AccessMutationResult;
                    }

                    const data = snap.data()!;
                    const prevAccess: SubjectAccess = data.access ?? { ...DEFAULT_ACCESS };
                    const expectedVersion = prevAccess.version ?? 0;
                    const nextVersion = expectedVersion + 1;

                    const nextAccess: SubjectAccess = {
                        status: "banned",
                        mode: mode ?? "permanent",
                        reason: reason ?? null,
                        expiresAt: mode === "temporary" ? (expiresAt ?? null) : null,
                        updatedAt: now,
                        updatedBy: ownerEmail,
                        version: nextVersion,
                        banId,
                    };

                    // Verify version hasn't changed (optimistic locking)
                    const currentVersion = data.access?.version ?? 0;
                    if (currentVersion !== expectedVersion) {
                        console.warn(`[BAN_VERSION_CONFLICT] Expected v${expectedVersion}, got v${currentVersion}`);
                        throw new Error("VERSION_CONFLICT");
                    }

                    // Log the operation
                    logAccessOperation("ban", subjectType, subjectId, targetGuestId, expectedVersion, nextVersion);

                    tx.update(ref, { access: nextAccess });

                    // Atomically sync the public projection
                    if (data.publicAccessKey) {
                        const projRef = adminDb
                            .collection("public_guest_access")
                            .doc(data.publicAccessKey);
                        tx.set(projRef, toPublicProjection(nextAccess));
                    }

                    return {
                        ok: true,
                        message: "Banned",
                        access: nextAccess,
                        prevAccess,
                        publicAccessKey: (data.publicAccessKey as string) ?? null,
                        ipHash: (data.ipHash as string) ?? null,
                        fingerprintHash: (data.fingerprintHash as string) ?? null,
                        actualGuestId: targetGuestId,
                    };
                });
                
                // Transaction succeeded, break retry loop
                break;
            } catch (err) {
                if (err instanceof Error && err.message === "VERSION_CONFLICT") {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        return { ok: false, message: "Version conflict - too many retries" };
                    }
                    // Wait briefly before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 50 * attempts));
                    continue;
                }
                // Other error, don't retry
                throw err;
            }
        }

        if (!result.ok) return result as AccessMutationResult;

        const { access: nextAccess, prevAccess } = result as {
            ok: true;
            access: SubjectAccess;
            prevAccess: SubjectAccess;
            publicAccessKey: string | null;
            ipHash: string | null;
            fingerprintHash: string | null;
        };

        await writeAccessAction({
            action: "ban",
            subjectType,
            subjectId,
            ownerEmail,
            prevAccess,
            nextAccess,
            banId,
        });

        await writeActivityEvent({
            type: "ACCESS_BAN",
            actor: ownerEmail,
            sourceCollection: "guest_entities",
            severity: "SECURITY",
            metadata: {
                subjectType,
                subjectId,
                actualGuestId: (result as any).actualGuestId,
                action: "ban",
                mode: nextAccess.mode,
                reason: nextAccess.reason,
                expiresAt: nextAccess.expiresAt,
                banId,
                prevStatus: prevAccess.status,
                prevVersion: prevAccess.version,
                nextVersion: nextAccess.version,
            },
        });

        if (subjectType === "guest") {
            // Clear guest_usage so usage counters don't block post-unban link creation
            const { ipHash, fingerprintHash } = result as {
                ipHash: string | null;
                fingerprintHash: string | null;
            };
            const deletes: Promise<unknown>[] = [];
            if (ipHash) deletes.push(adminDb.collection("guest_usage").doc(ipHash).delete().catch(() => {}));
            if (fingerprintHash) deletes.push(adminDb.collection("guest_usage").doc(fingerprintHash).delete().catch(() => {}));
            if (deletes.length) await Promise.allSettled(deletes);
        }

        await invalidateSubjectLinkCaches(subjectType, subjectId);

        console.log(`[BAN_SUCCESS] ${subjectType} ${subjectId} banned successfully (doc: ${targetGuestId})`);
        return { ok: true, message: "Banned", access: nextAccess };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Ban failed";
        console.error(`[BAN_ERROR] ${subjectType} ${subjectId}:`, err);
        return { ok: false, message: msg };
    }
}

export async function unbanSubject(input: UnbanInput): Promise<AccessMutationResult> {
    const { subjectType, subjectId, ownerEmail } = input;
    const now = Date.now();

    console.log(`[UNBAN_START] subjectType=${subjectType} subjectId=${subjectId}`);

    try {
        // Validate inputs
        assertNoRandomDocId(subjectId, "unbanSubject");
        assertValidAccessStatus("active", "unbanSubject");

        // Resolve target document ID
        let targetGuestId = subjectId;
        if (subjectType === "user") {
            // For users, find their linked guest_entity
            const guestSnap = await adminDb
                .collection("guest_entities")
                .where("userId", "==", subjectId)
                .limit(1)
                .get();
            
            if (!guestSnap.empty) {
                targetGuestId = guestSnap.docs[0].id;
                console.log(`[UNBAN] User ${subjectId} linked to guest_entity ${targetGuestId}`);
            } else {
                // User has no guest_entity - create one (legitimate case for new users)
                console.warn(`[UNBAN] User ${subjectId} has no guest_entity, creating one`);
                const { guestId } = await ensureUserGuestEntity(subjectId);
                targetGuestId = guestId;
                
                // Ensure bidirectional link
                const userRef = adminDb.collection("users").doc(subjectId);
                const userSnap = await userRef.get();
                if (userSnap.exists && userSnap.data()?.guestId !== guestId) {
                    await userRef.update({ 
                        guestId, 
                        updatedAt: Date.now() 
                    });
                    console.log(`[UNBAN] Linked user ${subjectId} to guest_entity ${guestId}`);
                }
            }
        } else {
            // For guests, subjectId IS the document ID (not the guestId field)
            // Validate document exists
            const guestRef = adminDb.collection("guest_entities").doc(subjectId);
            const guestSnap = await guestRef.get();
            if (!guestSnap.exists) {
                const error = `Guest entity ${subjectId} does not exist`;
                console.error(`[UNBAN_ERROR] ${error}`);
                return { ok: false, message: error };
            }
            console.log(`[UNBAN] Guest entity ${subjectId} found, proceeding with unban`);
        }
        
        // Always unban the guest entity (single source of truth)
        const ref = adminDb.collection("guest_entities").doc(targetGuestId);
        console.log(`[UNBAN] Target document: guest_entities/${targetGuestId}`);
        
        // Retry loop for optimistic locking
        let attempts = 0;
        const maxAttempts = 3;
        let result: any;

        while (attempts < maxAttempts) {
            try {
                result = await adminDb.runTransaction(async (tx) => {
                    const snap = await tx.get(ref);
                    if (!snap.exists) {
                        const error = `Guest entity ${targetGuestId} not found in transaction`;
                        console.error(`[UNBAN_TX_ERROR] ${error}`);
                        return { ok: false, message: error } as AccessMutationResult;
                    }

                    const data = snap.data()!;
                    const prevAccess: SubjectAccess = data.access ?? { ...DEFAULT_ACCESS };
                    const expectedVersion = prevAccess.version ?? 0;
                    const nextVersion = expectedVersion + 1;

                    const nextAccess: SubjectAccess = {
                        status: "active",
                        mode: null,
                        reason: null,
                        expiresAt: null,
                        updatedAt: now,
                        updatedBy: ownerEmail,
                        version: nextVersion,
                        banId: null,
                    };

                    // Verify version hasn't changed (optimistic locking)
                    const currentVersion = data.access?.version ?? 0;
                    if (currentVersion !== expectedVersion) {
                        console.warn(`[UNBAN_VERSION_CONFLICT] Expected v${expectedVersion}, got v${currentVersion}`);
                        throw new Error("VERSION_CONFLICT");
                    }

                    // Log the operation
                    logAccessOperation("unban", subjectType, subjectId, targetGuestId, expectedVersion, nextVersion);

                    tx.update(ref, { access: nextAccess });

                    // Atomically sync the public projection
                    if (data.publicAccessKey) {
                        const projRef = adminDb
                            .collection("public_guest_access")
                            .doc(data.publicAccessKey);
                        tx.set(projRef, toPublicProjection(nextAccess));
                    }

                    return {
                        ok: true,
                        message: "Unbanned",
                        access: nextAccess,
                        prevAccess,
                        publicAccessKey: (data.publicAccessKey as string) ?? null,
                        actualGuestId: targetGuestId,
                    };
                });
                
                // Transaction succeeded, break retry loop
                break;
            } catch (err) {
                if (err instanceof Error && err.message === "VERSION_CONFLICT") {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        return { ok: false, message: "Version conflict - too many retries" };
                    }
                    // Wait briefly before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 50 * attempts));
                    continue;
                }
                // Other error, don't retry
                throw err;
            }
        }

        if (!result.ok) return result as AccessMutationResult;

        const { access: nextAccess, prevAccess } = result as {
            ok: true;
            access: SubjectAccess;
            prevAccess: SubjectAccess;
            publicAccessKey: string | null;
        };

        await writeAccessAction({
            action: "unban",
            subjectType,
            subjectId,
            ownerEmail,
            prevAccess,
            nextAccess,
            banId: prevAccess.banId ?? null,
        });

        await writeActivityEvent({
            type: "ACCESS_UNBAN",
            actor: ownerEmail,
            sourceCollection: "guest_entities",
            severity: "SECURITY",
            metadata: {
                subjectType,
                subjectId,
                actualGuestId: (result as any).actualGuestId,
                action: "unban",
                prevStatus: prevAccess.status,
                prevVersion: prevAccess.version,
                prevBanId: prevAccess.banId,
                nextVersion: nextAccess.version,
            },
        });

        await invalidateSubjectLinkCaches(subjectType, subjectId);

        console.log(`[UNBAN_SUCCESS] ${subjectType} ${subjectId} unbanned successfully (doc: ${targetGuestId})`);
        return { ok: true, message: "Unbanned", access: nextAccess };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unban failed";
        console.error(`[UNBAN_ERROR] ${subjectType} ${subjectId}:`, err);
        return { ok: false, message: msg };
    }
}

async function invalidateSubjectLinkCaches(subjectType: BanSubjectType, subjectId: string): Promise<void> {
    if (subjectType === "user") {
        try {
            const snap = await adminDb
                .collection("links")
                .where("userId", "==", subjectId)
                .where("isActive", "==", true)
                .select()
                .limit(500)
                .get();

            await Promise.allSettled(
                snap.docs.flatMap((doc) => [
                    cacheInvalidate(doc.id),
                    negCacheInvalidate(doc.id),
                ])
            );
        } catch {
            // Best-effort
        }
        return;
    }

    // Guest: query by the guest's specific hashes rather than all anonymous links
    try {
        const guestSnap = await adminDb.collection("guest_entities").doc(subjectId).get();
        if (!guestSnap.exists) return;

        const { ipHash, fingerprintHash } = guestSnap.data() ?? {};

        const [byIp, byFp] = await Promise.all([
            ipHash
                ? adminDb.collection("links").where("ipHash", "==", ipHash).select().get()
                : Promise.resolve(null),
            fingerprintHash
                ? adminDb.collection("links").where("fingerprintHash", "==", fingerprintHash).select().get()
                : Promise.resolve(null),
        ]);

        const slugs = new Set([
            ...(byIp?.docs.map((d) => d.id) ?? []),
            ...(byFp?.docs.map((d) => d.id) ?? []),
        ]);

        await Promise.allSettled(
            [...slugs].flatMap((slug) => [
                cacheInvalidate(slug),
                negCacheInvalidate(slug),
            ])
        );
    } catch {
        // Best-effort
    }
}
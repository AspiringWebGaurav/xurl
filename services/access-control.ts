import { adminDb } from "@/lib/firebase/admin";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { writePublicGuestAccess } from "@/services/guest";
import { cacheInvalidate, negCacheInvalidate } from "@/lib/redis/redirect-cache";
import type { SubjectAccess, AccessMode, PublicGuestAccess } from "@/types";
import { DEFAULT_ACCESS } from "@/types";
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
    const collection = collectionForSubject(subjectType);
    const ref = adminDb.collection(collection).doc(subjectId);
    const now = Date.now();
    const banId = crypto.randomUUID();

    try {
        const result = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                return { ok: false, message: `${subjectType} not found` } as AccessMutationResult;
            }

            const data = snap.data()!;
            const prevAccess: SubjectAccess = data.access ?? { ...DEFAULT_ACCESS };
            const nextVersion = (prevAccess.version ?? 0) + 1;

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

            tx.update(ref, { access: nextAccess });

            // Atomically sync the public projection for guests
            if (subjectType === "guest" && data.publicAccessKey) {
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
            };
        });

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
            sourceCollection: collection,
            severity: "SECURITY",
            metadata: {
                subjectType,
                subjectId,
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

        return { ok: true, message: "Banned", access: nextAccess };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Ban failed";
        return { ok: false, message: msg };
    }
}

export async function unbanSubject(input: UnbanInput): Promise<AccessMutationResult> {
    const { subjectType, subjectId, ownerEmail } = input;
    const collection = collectionForSubject(subjectType);
    const ref = adminDb.collection(collection).doc(subjectId);
    const now = Date.now();

    try {
        const result = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                return { ok: false, message: `${subjectType} not found` } as AccessMutationResult;
            }

            const data = snap.data()!;
            const prevAccess: SubjectAccess = data.access ?? { ...DEFAULT_ACCESS };
            const nextVersion = (prevAccess.version ?? 0) + 1;

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

            tx.update(ref, { access: nextAccess });

            // Atomically sync the public projection for guests inside the same transaction.
            // This eliminates the window where guest_entities is active but
            // public_guest_access still shows banned (or vice-versa).
            if (subjectType === "guest" && data.publicAccessKey) {
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
            };
        });

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
            sourceCollection: collection,
            severity: "SECURITY",
            metadata: {
                subjectType,
                subjectId,
                action: "unban",
                prevStatus: prevAccess.status,
                prevVersion: prevAccess.version,
                prevBanId: prevAccess.banId,
                nextVersion: nextAccess.version,
            },
        });

        await invalidateSubjectLinkCaches(subjectType, subjectId);

        return { ok: true, message: "Unbanned", access: nextAccess };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unban failed";
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
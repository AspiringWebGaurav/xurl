import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminEmail, isOwnerEmail, OWNER_EMAIL } from "@/lib/admin-config";
import type { SubjectAccess } from "@/types";
import { DEFAULT_ACCESS } from "@/types";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";

export async function verifyAdminRequest(request: NextRequest): Promise<
    | { ok: true; uid: string; email: string | null }
    | { ok: false; status: number; message: string }
> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, status: 401, message: "Missing token" };
    }

    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || null;

        if (!isAdminEmail(email)) {
            return { ok: false, status: 403, message: "Admin access required" };
        }

        return { ok: true, uid: decoded.uid, email };
    } catch {
        return { ok: false, status: 401, message: "Invalid token" };
    }
}

export async function verifyOwnerRequest(request: NextRequest): Promise<
    | { ok: true; uid: string; email: string }
    | { ok: false; status: number; message: string }
> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, status: 401, message: "Missing token" };
    }

    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || null;

        if (!isOwnerEmail(email)) {
            return { ok: false, status: 403, message: "Owner access required" };
        }

        return { ok: true, uid: decoded.uid, email: email! };
    } catch {
        return { ok: false, status: 401, message: "Invalid token" };
    }
}

export function isSelfBanAttempt(targetEmail: string | null | undefined): boolean {
    if (!targetEmail) return false;
    return targetEmail.toLowerCase() === OWNER_EMAIL;
}

export function isSubjectBanned(access: SubjectAccess | undefined | null): boolean {
    if (!access) return true; // fail-closed on missing/corrupt access
    if (access.status !== "banned") return false;
    if (access.mode === "temporary" && access.expiresAt && access.expiresAt <= Date.now()) {
        return false;
    }
    return true;
}

async function autoExpireUserAccess(uid: string, current: SubjectAccess) {
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

    await adminDb.collection("users").doc(uid).update({ access: nextAccess });
    await adminDb.collection("access_actions").add({
        action: "expire_auto_unban",
        subjectType: "user",
        subjectId: uid,
        ownerEmail: "system_auto_expiry",
        prevAccess: current,
        nextAccess,
        createdAt: now,
        updatedAt: now,
        metadata: {
            action: "expire_auto_unban",
            subjectId: uid,
            prevVersion: current.version ?? 0,
            nextVersion,
            prevStatus: current.status,
        },
    });
    await writeActivityEvent({
        type: "ACCESS_EXPIRE_AUTO",
        actor: "system_auto_expiry",
        sourceCollection: "users",
        severity: "INFO",
        metadata: {
            subjectType: "user",
            subjectId: uid,
            action: "expire_auto_unban",
            prevVersion: current.version ?? 0,
            nextVersion,
            prevStatus: current.status,
        },
    });
    return nextAccess;
}

export async function checkUserBanned(uid: string): Promise<{ banned: boolean; access: SubjectAccess | null }> {
    try {
        const snap = await adminDb.collection("users").doc(uid).get();
        let data = snap.data();
        let access = (data?.access as SubjectAccess) ?? null;

        // Resolve email from Firestore or auth as fallback
        let email = data?.email as string | undefined;
        if (!email) {
            try {
                const authUser = await adminAuth.getUser(uid);
                email = authUser.email || undefined;
            } catch {
                // ignore
            }
        }

        // If missing doc/access but this is the owner account, hydrate default access and allow
        if ((!snap.exists || !access || !data) && email === OWNER_EMAIL) {
            const nextAccess: SubjectAccess = { ...DEFAULT_ACCESS, updatedAt: Date.now(), updatedBy: OWNER_EMAIL };
            await adminDb
                .collection("users")
                .doc(uid)
                .set({ email: OWNER_EMAIL, access: nextAccess, updatedAt: Date.now() }, { merge: true });
            return { banned: false, access: nextAccess };
        }

        if (!snap.exists || !access) return { banned: true, access: null };

        // Auto-expire temporary bans
        if (access?.status === "banned" && access.mode === "temporary" && access.expiresAt && access.expiresAt <= Date.now()) {
            const next = await autoExpireUserAccess(uid, access);
            return { banned: false, access: next };
        }

        // If owner email present but access exists, ensure owner is never treated as banned
        if (email === OWNER_EMAIL) {
            if (isSubjectBanned(access)) {
                const nextAccess: SubjectAccess = { ...DEFAULT_ACCESS, updatedAt: Date.now(), updatedBy: OWNER_EMAIL };
                await adminDb.collection("users").doc(uid).set({ email: OWNER_EMAIL, access: nextAccess }, { merge: true });
                return { banned: false, access: nextAccess };
            }
            return { banned: false, access };
        }

        return { banned: isSubjectBanned(access), access };
    } catch {
        return { banned: true, access: null };
    }
}

import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

export const onLinkDeleted = onDocumentDeleted("links/{slug}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (!data || !data.userId || data.userId === "anonymous" || data.deletedByApi) return;

    const userRef = admin.firestore().collection("users").doc(data.userId);

    try {
        await userRef.set({
            activeLinks: admin.firestore.FieldValue.increment(-1),
            updatedAt: Date.now()
        }, { merge: true });

        console.log(`Decremented activeLinks for user ${data.userId} after link TTL deletion.`);
    } catch (error) {
        console.error(`Failed to decrement activeLinks for user ${data.userId}:`, error);
    }
});

/**
 * Scheduled function: expires temporary bans that have passed their expiresAt.
 * Runs every minute. Checks both users and guest_entities collections.
 */
export const expireTemporaryBans = onSchedule("every 1 minutes", async () => {
    const now = Date.now();

    // Process user temporary bans
    await expireBansInCollection("users", now);

    // Process guest temporary bans
    await expireBansInCollection("guest_entities", now);
});

async function expireBansInCollection(collection: string, now: number): Promise<void> {
    try {
        const snap = await db
            .collection(collection)
            .where("access.status", "==", "banned")
            .where("access.mode", "==", "temporary")
            .where("access.expiresAt", "<=", now)
            .limit(50)
            .get();

        if (snap.empty) return;

        for (const doc of snap.docs) {
            try {
                await db.runTransaction(async (tx) => {
                    const fresh = await tx.get(doc.ref);
                    if (!fresh.exists) return;

                    const data = fresh.data();
                    const access = data?.access;
                    if (!access || access.status !== "banned" || access.mode !== "temporary") return;
                    if (!access.expiresAt || access.expiresAt > now) return;

                    const prevVersion = access.version ?? 0;
                    const nextAccess = {
                        status: "active",
                        mode: null,
                        reason: null,
                        expiresAt: null,
                        updatedAt: now,
                        updatedBy: "system:auto_expiry",
                        version: prevVersion + 1,
                        banId: null,
                    };

                    tx.update(doc.ref, { access: nextAccess });
                });

                // Write audit event
                const activityRef = db.collection("activity_events").doc();
                await activityRef.set({
                    id: activityRef.id,
                    type: "ACCESS_AUTO_UNBAN",
                    actor: "system:auto_expiry",
                    sourceCollection: collection,
                    metadata: {
                        subjectType: collection === "users" ? "user" : "guest",
                        subjectId: doc.id,
                        action: "expire_auto_unban",
                    },
                    severity: "SECURITY",
                    timestamp: now,
                    createdAt: now,
                    updatedAt: now,
                });

                // Refresh guest public projection if applicable
                if (collection === "guest_entities") {
                    const refreshed = await doc.ref.get();
                    const publicAccessKey = refreshed.data()?.publicAccessKey;
                    if (publicAccessKey) {
                        const freshAccess = refreshed.data()?.access;
                        await db.collection("public_guest_access").doc(publicAccessKey).set({
                            status: freshAccess?.status ?? "active",
                            reason: freshAccess?.reason ?? null,
                            expiresAt: freshAccess?.expiresAt ?? null,
                            version: freshAccess?.version ?? 0,
                            updatedAt: freshAccess?.updatedAt ?? now,
                        });
                    }
                }

                console.log(`Auto-expired temporary ban for ${collection}/${doc.id}`);
            } catch (err) {
                console.error(`Failed to auto-expire ban for ${collection}/${doc.id}:`, err);
            }
        }
    } catch (err) {
        console.error(`Failed to query expired bans in ${collection}:`, err);
    }
}

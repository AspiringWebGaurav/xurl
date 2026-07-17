import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

export const onLinkDeleted = onDocumentDeleted("links/{slug}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (!data || data.deletedByApi) return; // If API deleted it, it already cascaded deletes

    const slug = event.params.slug;
    const db = admin.firestore();

    // 1) Wipe all analytics associated with this link
    try {
        const MAX_BATCH = 500;
        let deletedTotal = 0;
        const SAFETY_CAP = 5000;

        while (deletedTotal < SAFETY_CAP) {
            const analyticsSnap = await db
                .collection("analytics")
                .where("slug", "==", slug)
                .limit(MAX_BATCH)
                .get();

            if (analyticsSnap.empty) break;

            const batch = db.batch();
            analyticsSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            deletedTotal += analyticsSnap.size;

            if (analyticsSnap.size < MAX_BATCH) break;
        }
        console.log(`Wiped ${deletedTotal} analytics records for auto-deleted link ${slug}.`);
    } catch (error) {
        console.error(`Failed to wipe analytics for ${slug}:`, error);
    }

    // 2) Wipe guest_usage if it was a guest link
    if (data.userId === "anonymous") {
        try {
            const guestSnap = await db.collection("guest_usage").where("slug", "==", slug).get();
            if (!guestSnap.empty) {
                const batch = db.batch();
                guestSnap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();
                console.log(`Wiped guest_usage records for auto-deleted guest link ${slug}.`);
            }
        } catch (error) {
            console.error(`Failed to wipe guest_usage for ${slug}:`, error);
        }
    } else if (data.userId) {
        // 3) Update user counters if it was a registered user
        const userRef = db.collection("users").doc(data.userId);
        try {
            await userRef.set({
                activeLinks: admin.firestore.FieldValue.increment(-1),
                updatedAt: Date.now()
            }, { merge: true });
            console.log(`Decremented activeLinks for user ${data.userId} after link TTL deletion.`);
        } catch (error) {
            console.error(`Failed to decrement activeLinks for user ${data.userId}:`, error);
        }
    }
});

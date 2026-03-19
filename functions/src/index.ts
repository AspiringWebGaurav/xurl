import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

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

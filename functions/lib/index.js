"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLinkDeleted = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
exports.onLinkDeleted = (0, firestore_1.onDocumentDeleted)("links/{slug}", async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const data = snapshot.data();
    if (!data || !data.userId || data.userId === "anonymous")
        return;
    const userRef = admin.firestore().collection("users").doc(data.userId);
    try {
        await userRef.set({
            activeLinks: admin.firestore.FieldValue.increment(-1),
            updatedAt: Date.now()
        }, { merge: true });
        console.log(`Decremented activeLinks for user ${data.userId} after link TTL deletion.`);
    }
    catch (error) {
        console.error(`Failed to decrement activeLinks for user ${data.userId}:`, error);
    }
});
//# sourceMappingURL=index.js.map
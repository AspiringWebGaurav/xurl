import * as admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            // Replace escaped newline characters that might occur depending on the env parser
            privateKey = privateKey.replace(/\\n/g, "\n");
        } else {
            console.warn("FIREBASE_PRIVATE_KEY is missing or undefined.");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        console.log("Firebase Admin Initialized successfully.");
    } catch (error) {
        console.error("Firebase admin initialization error:", error);
        throw new Error("Failed to initialize Firebase Admin SDK. Please check your .env variables, particularly FIREBASE_PRIVATE_KEY format.");
    }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

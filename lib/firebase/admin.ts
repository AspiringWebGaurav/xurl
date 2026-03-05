import * as admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Replace escaped newline characters that might occur depending on the env parser
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
        });
        console.log("Firebase Admin Initialized successfully.");
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

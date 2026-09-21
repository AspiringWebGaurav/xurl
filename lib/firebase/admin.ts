import * as admin from "firebase-admin";

function initializeFirebaseAdmin(): admin.app.App | null {
    if (admin.apps.length) {
        return admin.apps[0]!;
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.warn("⚠️ Firebase Admin credentials missing or incomplete. Server-side Firebase operations will be disabled.");
        return null;
    }

    try {
        // Strip accidental enclosing quotes from Vercel / .env files
        if (
            (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
            (privateKey.startsWith("'") && privateKey.endsWith("'"))
        ) {
            privateKey = privateKey.slice(1, -1);
        }

        // Normalize escaped newlines and CRLF
        privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    } catch (error) {
        console.error("Firebase admin initialization error:", error);
        return null;
    }
}

// Initialize on module load if credentials are valid
const defaultApp = initializeFirebaseAdmin();

// Proxied DB accessor that handles lazy initialization or clear error reporting
export const adminDb: admin.firestore.Firestore = new Proxy({} as admin.firestore.Firestore, {
    get(_target, prop) {
        const app = defaultApp || initializeFirebaseAdmin();
        if (!app) {
            throw new Error(
                "Firebase Admin Firestore is not initialized. Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set."
            );
        }
        const db = app.firestore();
        const value = (db as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? value.bind(db) : value;
    },
});

// Proxied Auth accessor
export const adminAuth: admin.auth.Auth = new Proxy({} as admin.auth.Auth, {
    get(_target, prop) {
        const app = defaultApp || initializeFirebaseAdmin();
        if (!app) {
            throw new Error(
                "Firebase Admin Auth is not initialized. Please ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set."
            );
        }
        const auth = app.auth();
        const value = (auth as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? value.bind(auth) : value;
    },
});

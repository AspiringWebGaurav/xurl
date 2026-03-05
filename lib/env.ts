import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const envSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.string().url().default(isProd ? "https://xurl.eu.cc" : "http://localhost:3000"),
    NEXT_PUBLIC_SHORT_DOMAIN: z.string().default(isProd ? "xurl.eu.cc" : "localhost:3000"),
    NEXT_PUBLIC_API_BASE: z.string().url().default(isProd ? "https://xurl.eu.cc/api" : "http://localhost:3000/api"),
    NEXT_PUBLIC_ENVIRONMENT: z.enum(["development", "production", "test"]).default(isProd ? "production" : "development"),

    // Firebase configuration
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key is required"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, "Firebase Auth Domain is required"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket is required"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID is required"),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "Firebase App ID is required"),
});

const validateEnv = () => {
    try {
        const env = envSchema.parse({
            NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
            NEXT_PUBLIC_SHORT_DOMAIN: process.env.NEXT_PUBLIC_SHORT_DOMAIN,
            NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
            NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
            NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
        return env;
    } catch (error) {
        // In production, crash loudly — never serve with localhost fallbacks
        if (process.env.NODE_ENV === "production") {
            console.error("❌ FATAL: Invalid environment variables in production:", error);
            throw new Error("Missing or invalid environment variables. Cannot start in production.");
        }

        // In development only, return permissive defaults
        console.warn("⚠️ Invalid environment variables (using dev defaults):", error);
        return {
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            NEXT_PUBLIC_SHORT_DOMAIN: "localhost:3000",
            NEXT_PUBLIC_API_BASE: "http://localhost:3000/api",
            NEXT_PUBLIC_ENVIRONMENT: "development" as const,
            NEXT_PUBLIC_FIREBASE_API_KEY: "dummy-api-key",
            NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "dummy-auth-domain",
            NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dummy-project-id",
            NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dummy-storage-bucket",
            NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "dummy-sender-id",
            NEXT_PUBLIC_FIREBASE_APP_ID: "dummy-app-id",
        };
    }
};

export const env = validateEnv();

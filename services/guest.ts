import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

const GUEST_USAGE_COLLECTION = "guest_usage";

export interface GuestUsageRecord {
    ipHash: string;
    fingerprintHash: string;
    slug: string;
    originalUrl: string;
    expiresAt: number;
    createdAt: number;
}

/**
 * Creates a SHA-256 hash for privacy-preserving tracking
 */
function hashData(data: string, salt: string = ""): string {
    return crypto.createHash("sha256").update(`${data}${salt}`).digest("hex");
}

/**
 * Checks if a guest (identified by IP or fingerprint) has EVER created a link.
 * LIFETIME LIMIT: Once a guest creates 1 link, they are permanently blocked.
 * Returns an object with `allowed` = true if no link has ever been created.
 * Returns `allowed` = false if ANY link record exists (active or expired).
 */
export async function checkGuestLimit(
    ip: string,
    fingerprint: string | undefined
): Promise<{ allowed: boolean; expiresIn?: number; slug?: string; originalUrl?: string; createdAt?: number; isLifetimeLimitReached?: boolean }> {
    const ipHash = hashData(ip);
    const fingerprintHash = fingerprint ? hashData(fingerprint) : null;
    const now = Date.now();

    // Query 1: Check by IP - LIFETIME (no expiresAt filter)
    const ipQuery = adminDb
        .collection(GUEST_USAGE_COLLECTION)
        .where("ipHash", "==", ipHash)
        .limit(1);

    const ipSnap = await ipQuery.get();

    // Check if IP has EVER created a link (regardless of expiry)
    if (!ipSnap.empty) {
        const data = ipSnap.docs[0].data() as GuestUsageRecord;
        const expiresIn = Math.max(0, Math.ceil((data.expiresAt - now) / 1000));
        return {
            allowed: false,
            isLifetimeLimitReached: true,
            expiresIn,
            slug: data.slug,
            originalUrl: data.originalUrl,
            createdAt: data.createdAt
        };
    }

    // Query 2: Check by Fingerprint (if provided) - LIFETIME
    if (fingerprintHash) {
        const fpQuery = adminDb
            .collection(GUEST_USAGE_COLLECTION)
            .where("fingerprintHash", "==", fingerprintHash)
            .limit(1);

        const fpSnap = await fpQuery.get();
        if (!fpSnap.empty) {
            const data = fpSnap.docs[0].data() as GuestUsageRecord;
            const expiresIn = Math.max(0, Math.ceil((data.expiresAt - now) / 1000));
            return {
                allowed: false,
                isLifetimeLimitReached: true,
                expiresIn,
                slug: data.slug,
                originalUrl: data.originalUrl,
                createdAt: data.createdAt
            };
        }
    }

    return { allowed: true };
}


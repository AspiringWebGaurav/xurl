import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

const GUEST_USAGE_COLLECTION = "guest_usage";

export interface GuestUsageRecord {
    ipHash: string;
    fingerprintHash: string;
    slug: string;
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
 * Checks if a guest (identified by IP or fingerprint) has an active link.
 * Returns an object with `allowed` = true if no active link exists.
 * Returns `allowed` = false and `expiresIn` (in seconds) if an active link exists.
 */
export async function checkGuestLimit(
    ip: string,
    fingerprint: string | undefined
): Promise<{ allowed: boolean; expiresIn?: number }> {
    const ipHash = hashData(ip);
    const fingerprintHash = fingerprint ? hashData(fingerprint) : null;
    const now = Date.now();

    // Query 1: Check by IP
    const ipQuery = adminDb
        .collection(GUEST_USAGE_COLLECTION)
        .where("ipHash", "==", ipHash)
        .where("expiresAt", ">", now)
        .limit(1);

    const ipSnap = await ipQuery.get();

    // Check if IP query found an active link
    if (!ipSnap.empty) {
        const data = ipSnap.docs[0].data() as GuestUsageRecord;
        return {
            allowed: false,
            expiresIn: Math.ceil((data.expiresAt - now) / 1000)
        };
    }

    // Query 2: Check by Fingerprint (if provided)
    if (fingerprintHash) {
        const fpQuery = adminDb
            .collection(GUEST_USAGE_COLLECTION)
            .where("fingerprintHash", "==", fingerprintHash)
            .where("expiresAt", ">", now)
            .limit(1);

        const fpSnap = await fpQuery.get();
        if (!fpSnap.empty) {
            const data = fpSnap.docs[0].data() as GuestUsageRecord;
            return {
                allowed: false,
                expiresIn: Math.ceil((data.expiresAt - now) / 1000)
            };
        }
    }

    return { allowed: true };
}

/**
 * Records a new guest link creation.
 */
export async function recordGuestUsage(
    ip: string,
    fingerprint: string | undefined,
    slug: string,
    expiresAt: number
): Promise<void> {
    const ipHash = hashData(ip);
    const fingerprintHash = fingerprint ? hashData(fingerprint) : "none";

    const record: GuestUsageRecord = {
        ipHash,
        fingerprintHash,
        slug,
        expiresAt,
        createdAt: Date.now()
    };

    // Store the record. We don't necessarily need a specific ID, 
    // but using the slug makes it easy to look up/delete if needed.
    await adminDb.collection(GUEST_USAGE_COLLECTION).doc(slug).set(record);
}

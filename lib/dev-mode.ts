import { adminDb } from "@/lib/firebase/admin";
import { ADMIN_EMAILS } from "@/lib/admin-config";

const DEV_EMAIL = "gauravpatil9262@gmail.com";

export function isDevEnvironment(): boolean {
    return process.env.NODE_ENV === "development";
}

export function isDeveloperEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const normalized = email.toLowerCase();
    return normalized === DEV_EMAIL || ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]);
}

export async function getDevModeForUser(userId: string): Promise<boolean> {
    if (!isDevEnvironment()) return false;
    if (!userId) return false;

    const ref = adminDb.collection("dev_flags").doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return false;

    const data = snap.data() as { developerModeEnabled?: boolean } | undefined;
    return Boolean(data?.developerModeEnabled);
}

export async function setDevModeForUser(userId: string, enabled: boolean): Promise<boolean> {
    if (!isDevEnvironment()) return false;
    if (!userId) return false;

    const now = Date.now();
    const ref = adminDb.collection("dev_flags").doc(userId);

    await ref.set(
        {
            developerModeEnabled: enabled,
            updatedAt: now,
        },
        { merge: true }
    );

    return enabled;
}


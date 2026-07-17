import { adminDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { logger } from "@/lib/utils/logger";

export function isDevEnvironment(): boolean {
    return process.env.NODE_ENV === "development";
}

export function isDeveloperEmail(email: string | null | undefined): boolean {
    return isAdminEmail(email);
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

    try {
        await writeActivityEvent({
            type: "DEV_MODE_TOGGLED",
            actor: userId,
            sourceCollection: "dev_flags",
            metadata: {
                enabled,
            },
            severity: "ADMIN",
        });
    } catch (error) {
        logger.error("activity_event_write", "Failed to write DEV_MODE_TOGGLED event", {
            userId,
            error: String(error),
        });
    }

    return enabled;
}


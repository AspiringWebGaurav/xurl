import { adminDb } from "@/lib/firebase/admin";

export type NotificationAction = {
    type: "REDIRECT";
    url: string;
    label: string;
};

export type NotificationPayload = {
    userId: string;
    type: "ADMIN_GRANT" | "PROMO";
    title: string;
    message: string;
    data?: Record<string, unknown>;
    action?: NotificationAction;
    createdAt?: number;
};

export async function createNotificationForUser(payload: NotificationPayload): Promise<string> {
    const now = payload.createdAt ?? Date.now();
    const userRef = adminDb.collection("users").doc(payload.userId);
    const metaRef = userRef.collection("meta").doc("notifications");
    const notifRef = adminDb.collection("notifications").doc(payload.userId).collection("items").doc();

    await adminDb.runTransaction(async (tx) => {
        const metaSnap = await tx.get(metaRef);
        const currentUnread = metaSnap.exists
            ? Number(metaSnap.data()?.unreadCount ?? 0)
            : 0;
        const nextUnread = currentUnread + 1;

        tx.set(
            metaRef,
            {
                unreadCount: nextUnread,
                lastUpdated: now,
            },
            { merge: true }
        );

        tx.set(notifRef, {
            id: notifRef.id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            data: payload.data ?? {},
            action: payload.action ?? null,
            read: false,
            createdAt: now,
            updatedAt: now,
        });
    });

    return notifRef.id;
}

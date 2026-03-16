import { adminDb } from "@/lib/firebase/admin";
import type { ActivitySeverity } from "@/lib/admin/activity-events";

export type ActivityEventInput = {
    type: string;
    actor: string | null;
    sourceCollection: string;
    metadata?: Record<string, unknown>;
    severity?: ActivitySeverity;
    timestamp?: number;
};

export async function writeActivityEvent(input: ActivityEventInput): Promise<void> {
    const now = input.timestamp ?? Date.now();
    const ref = adminDb.collection("activity_events").doc();
    const payload = {
        id: ref.id,
        type: input.type,
        actor: input.actor ?? null,
        sourceCollection: input.sourceCollection,
        metadata: input.metadata ?? {},
        severity: input.severity ?? "INFO",
        timestamp: now,
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(payload);
}

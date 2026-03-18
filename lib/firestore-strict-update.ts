import { adminDb } from "@/lib/firebase/admin";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";

export interface StrictUpdateOptions {
    context?: string;
    requireExists?: boolean;
    logOperation?: boolean;
}

export async function strictUpdate(
    collection: string,
    docId: string,
    data: any,
    options: StrictUpdateOptions = {}
): Promise<void> {
    const { context = "unknown", requireExists = true, logOperation = true } = options;

    if (!collection || !docId) {
        const error = `CRITICAL: Missing collection or docId in ${context}`;
        console.error(`[STRICT_UPDATE_ERROR] ${error}`);
        throw new Error(error);
    }

    if (logOperation) {
        console.log(`[STRICT_UPDATE] ${context}: ${collection}/${docId}`);
    }

    const ref = adminDb.collection(collection).doc(docId);

    if (requireExists) {
        const snap = await ref.get();
        if (!snap.exists) {
            const error = `CRITICAL: Document ${collection}/${docId} does not exist (${context})`;
            console.error(`[STRICT_UPDATE_ERROR] ${error}`);
            throw new Error(error);
        }
    }

    await ref.update(data);

    if (logOperation) {
        console.log(`[STRICT_UPDATE_SUCCESS] ${context}: ${collection}/${docId} updated`);
    }
}

export async function strictTransactionUpdate(
    tx: Transaction,
    ref: DocumentReference,
    data: any,
    options: StrictUpdateOptions = {}
): Promise<void> {
    const { context = "unknown", requireExists = true, logOperation = true } = options;

    if (logOperation) {
        console.log(`[STRICT_TX_UPDATE] ${context}: ${ref.path}`);
    }

    if (requireExists) {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            const error = `CRITICAL: Document ${ref.path} does not exist in transaction (${context})`;
            console.error(`[STRICT_TX_UPDATE_ERROR] ${error}`);
            throw new Error(error);
        }
    }

    tx.update(ref, data);

    if (logOperation) {
        console.log(`[STRICT_TX_UPDATE_QUEUED] ${context}: ${ref.path}`);
    }
}

export function assertNoRandomDocId(docId: string, context: string): void {
    if (!docId || docId.trim() === "") {
        const error = `CRITICAL: Empty or undefined docId in ${context}`;
        console.error(`[ASSERT_ERROR] ${error}`);
        throw new Error(error);
    }
}

export function assertValidAccessStatus(status: string, context: string): void {
    const validStatuses = ["active", "banned"];
    if (!validStatuses.includes(status)) {
        const error = `CRITICAL: Invalid access status "${status}" in ${context}. Must be "active" or "banned"`;
        console.error(`[ASSERT_ERROR] ${error}`);
        throw new Error(error);
    }
}

export function logAccessOperation(
    operation: "ban" | "unban",
    subjectType: "user" | "guest",
    subjectId: string,
    docId: string,
    prevVersion: number,
    nextVersion: number
): void {
    console.log(`[ACCESS_CONTROL] ${operation.toUpperCase()}`);
    console.log(`  Subject Type: ${subjectType}`);
    console.log(`  Subject ID: ${subjectId}`);
    console.log(`  Document ID: ${docId}`);
    console.log(`  Version: ${prevVersion} → ${nextVersion}`);
}

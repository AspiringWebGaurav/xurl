import { adminDb } from "@/lib/firebase/admin";
import { type PlanType } from "@/lib/plans";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";

export type TransactionAction = "guest_use" | "free_use" | "upgrade" | "renew" | "downgrade" | "expire";

export interface PlanTransaction {
    id?: string;
    userId: string;
    planType: PlanType;
    action: TransactionAction;
    linksAllocated: number;
    paymentId?: string;
    orderId?: string;
    createdAt: number;
}

/**
 * Log a transaction for plan-related events (upgrades, renewals, link usage, etc).
 * 
 * Typically this should be called inside an existing transaction, but it can also
 * act standalone if a Firebase Transaction object is not provided.
 */
export async function createTransaction(
    transactionData: Omit<PlanTransaction, "createdAt">,
    t?: FirebaseFirestore.Transaction
) {
    const docRef = adminDb.collection("transactions").doc();
    const data: PlanTransaction = {
        ...transactionData,
        createdAt: Date.now()
    };

    // Remove undefined properties to prevent Firestore errors
    Object.keys(data).forEach(key => {
        if (data[key as keyof PlanTransaction] === undefined) {
            delete data[key as keyof PlanTransaction];
        }
    });

    if (t) {
        t.set(docRef, data);
    } else {
        await docRef.set(data);
    }
    return docRef.id;
}

import { adminDb } from "@/lib/firebase/admin";
import { type PlanType } from "@/lib/plans";

export type TransactionAction =
    | "guest_use"
    | "free_use"
    | "upgrade"
    | "renew"
    | "downgrade"
    | "expire"
    | "admin_grant"
    | "admin_revoke";
export type TransactionSource = "system" | "razorpay" | "developer_mode" | "admin_grant" | "promo_free";

export interface PlanTransaction {
    id?: string;
    userId: string;
    planType: PlanType;
    action: TransactionAction;
    linksAllocated: number;
    amount?: number;
    source?: TransactionSource;
    reason?: string;
    recipientEmail?: string | null;
    adminEmail?: string | null;
    grantType?: "plan" | "link_gift";
    durationOption?: string;
    customValue?: number;
    customUnit?: string;
    overrideExpiryMs?: number | null;
    expiresAt?: number | null;
    previousPlan?: PlanType | null;
    previousPlanStatus?: string | null;
    previousPlanStart?: number | null;
    previousPlanExpiry?: number | null;
    previousPlanRenewals?: number | null;
    previousPlanEraStart?: number | null;
    previousCumulativeQuota?: number | null;
    previousApiEnabled?: boolean | null;
    previousApiQuotaTotal?: number | null;
    previousApiRequestsUsed?: number | null;
    previousApiKeyHash?: string | null;
    previousApiKeyEncrypted?: string | null;
    previousApiKeyLastRotatedAt?: number | null;
    restoredPlan?: PlanType | null;
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

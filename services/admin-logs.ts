import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

export type AdminLogAction = 
    | "BAN_USER"
    | "UNBAN_USER"
    | "GRANT_PLAN"
    | "CREATE_PROMO"
    | "DELETE_PROMO"
    | "OTHER";

export interface AdminLog {
    id: string;
    adminEmail: string;
    action: AdminLogAction;
    details: string;
    createdAt: number;
}

/**
 * Logs an administrative action to the database.
 * @param adminEmail The email of the admin performing the action
 * @param action The specific action type
 * @param details A human-readable description of what was done
 */
export async function logAdminAction(adminEmail: string, action: AdminLogAction, details: string) {
    try {
        const id = crypto.randomUUID();
        const logEntry: AdminLog = {
            id,
            adminEmail,
            action,
            details,
            createdAt: Date.now(),
        };
        await adminDb.collection("admin_logs").doc(id).set(logEntry);
    } catch (error) {
        console.error("Failed to log admin action:", error);
        // We typically don't throw here so we don't crash the main operation if logging fails.
    }
}

/**
 * Retrieves recent admin logs.
 * @param limitCount Number of logs to retrieve (default 100)
 */
export async function getAdminLogs(limitCount = 100): Promise<AdminLog[]> {
    try {
        const snapshot = await adminDb
            .collection("admin_logs")
            .orderBy("createdAt", "desc")
            .limit(limitCount)
            .get();

        return snapshot.docs.map(doc => doc.data() as AdminLog);
    } catch (error) {
        console.error("Failed to fetch admin logs:", error);
        return [];
    }
}

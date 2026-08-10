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
 * Retrieves recent admin logs safely normalized.
 * @param limitCount Number of logs to retrieve (default 100)
 */
export async function getAdminLogs(limitCount = 100): Promise<AdminLog[]> {
    try {
        const snapshot = await adminDb
            .collection("admin_logs")
            .orderBy("createdAt", "desc")
            .limit(limitCount)
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data() || {};
            
            // Normalize timestamp
            const rawCreated = data.createdAt ?? data.timestamp ?? data.created_at;
            let createdAtNum = Date.now();

            if (typeof rawCreated === "number" && !isNaN(rawCreated)) {
                createdAtNum = rawCreated;
            } else if (rawCreated && typeof rawCreated === "object" && typeof rawCreated.toDate === "function") {
                createdAtNum = rawCreated.toDate().getTime();
            } else if (rawCreated && typeof rawCreated === "object" && typeof rawCreated._seconds === "number") {
                createdAtNum = rawCreated._seconds * 1000;
            } else if (typeof rawCreated === "string") {
                const parsed = new Date(rawCreated).getTime();
                if (!isNaN(parsed)) createdAtNum = parsed;
            }

            return {
                id: data.id || doc.id,
                adminEmail: data.adminEmail || data.email || data.userEmail || "System",
                action: (data.action || "OTHER") as AdminLogAction,
                details: data.details || data.message || data.reason || "Administrative operation",
                createdAt: createdAtNum,
            };
        });
    } catch (error) {
        console.error("Failed to fetch admin logs:", error);
        return [];
    }
}

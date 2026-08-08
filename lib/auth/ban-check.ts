import { adminDb } from "@/lib/firebase/admin";
import { UserDocument } from "@/types";

export async function isUserBanned(uid: string): Promise<boolean> {
    try {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) return false;
        
        const data = userDoc.data() as UserDocument;
        
        // Instant ban check
        if (data.banStatus === "banned") {
            // Check if there is an unban schedule that has passed
            if (data.unbanScheduledAt && Date.now() >= data.unbanScheduledAt) {
                return false;
            }
            return true;
        }
        
        // Scheduled ban check
        if (data.banScheduledAt && Date.now() >= data.banScheduledAt) {
            // If there's an unban schedule that is after the ban schedule, and it has passed
            if (data.unbanScheduledAt && data.unbanScheduledAt > data.banScheduledAt && Date.now() >= data.unbanScheduledAt) {
                return false;
            }
            return true;
        }
        
        return false;
    } catch {
        return false;
    }
}

export type AbuseAction = { action: "warning" | "ban" | "none", message?: string };

/**
 * Tracks abuse strikes and applies bans or warnings based on thresholds.
 */
export async function recordAbuseStrike(
    userId: string,
    type: "IDOR" | "RESERVED" | "ADMIN_ACCESS",
    guestId?: string
): Promise<AbuseAction> {
    try {
        const isGuest = userId === "anonymous";
        
        if (isGuest && !guestId) {
            // Cannot track guest without ID
            return { action: "none" };
        }

        const docRef = isGuest 
            ? adminDb.collection("guest_warnings").doc(guestId!)
            : adminDb.collection("users").doc(userId);

        // Fetch current strikes
        const docSnap = await docRef.get();
        const data = docSnap.exists ? docSnap.data() || {} : {};
        
        const idorStrikes = (data.idorStrikes || 0) + (type === "IDOR" ? 1 : 0);
        const reservedStrikes = (data.reservedStrikes || 0) + (type === "RESERVED" ? 1 : 0);
        const adminAccessStrikes = (data.adminAccessStrikes || 0) + (type === "ADMIN_ACCESS" ? 1 : 0);

        let action: AbuseAction = { action: "none" };

        if (type === "ADMIN_ACCESS") {
            if (adminAccessStrikes >= 5) {
                action = { action: "ban", message: "Abuse: Repeated unauthorized admin access attempts" };
            } else if (adminAccessStrikes >= 3) {
                action = { action: "warning", message: "Warning: Unauthorized access attempts logged. Further attempts will result in an account ban." };
            }
        } else if (type === "RESERVED") {
            if (reservedStrikes >= 5) {
                action = { action: "ban", message: "Abuse: Repeatedly attempting to claim system reserved URLs" };
            } else if (reservedStrikes === 3) {
                action = { action: "warning", message: "Warning: Repeatedly attempting to claim system reserved URLs is prohibited. Further attempts will result in an account ban." };
            }
        } else if (type === "IDOR") {
            if (idorStrikes >= 2) {
                action = { action: "ban", message: "Unauthorized link tampering (IDOR attempt)" };
            } else if (idorStrikes === 1) {
                action = { action: "warning", message: "Warning: Unauthorized link modification attempt logged. Further attempts will result in an automatic account ban." };
            }
        }

        const updates: Record<string, unknown> = {
            idorStrikes,
            reservedStrikes,
            adminAccessStrikes,
            updatedAt: Date.now()
        };

        if (action.action === "ban") {
            updates.banStatus = "banned";
            updates.banReason = action.message;
            updates.bannedBy = "system";
            updates.banScheduledAt = null;
            updates.unbanScheduledAt = null;
            
            if (isGuest && guestId) {
                // Guests also need an explicit entry in banned_guests for BanGuard to intercept them
                await adminDb.collection("banned_guests").doc(guestId).set({
                    bannedAt: Date.now(),
                    bannedBy: "system",
                    reason: action.message
                }, { merge: true });
            }
        }

        await docRef.set(updates, { merge: true });

        return action;
    } catch (e) {
        console.error("Failed to record abuse strike:", userId, e);
        return { action: "none" };
    }
}

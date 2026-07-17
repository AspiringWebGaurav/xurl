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

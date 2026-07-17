import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";
import { createNotificationForUser } from "@/services/notifications";
import { isAdminEmail } from "@/lib/admin-config";
import { logAdminAction } from "@/services/admin-logs";

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminRequest(request);
        if (!admin.ok) {
            return NextResponse.json({ message: admin.message }, { status: admin.status });
        }

        const body = await request.json();
        const { uid, email, action, scheduledAt, reason } = body;

        if (!uid && !email) {
            return NextResponse.json({ message: "Must provide uid or email" }, { status: 400 });
        }

        if (!["ban_instant", "ban_scheduled", "unban_instant", "unban_scheduled", "unban_caution"].includes(action)) {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        let targetUid = uid;
        let targetEmail = email?.toLowerCase().trim();

        // If email provided but no uid, try to find user by email
        if (targetEmail && !targetUid) {
            try {
                const userRecord = await adminAuth.getUserByEmail(targetEmail);
                targetUid = userRecord.uid;
            } catch (e: any) {
                if (e.code !== "auth/user-not-found") {
                    throw e;
                }
            }
        }
        
        // If uid provided but no email, try to get email (for admin protection)
        if (targetUid && !targetEmail) {
            try {
                const userRecord = await adminAuth.getUser(targetUid);
                targetEmail = userRecord.email?.toLowerCase();
            } catch (e) {}
        }
        
        // Protect admins from being banned
        if (isAdminEmail(targetEmail)) {
            return NextResponse.json({ message: "Action forbidden: Cannot modify ban status of an administrator" }, { status: 403 });
        }

        // Apply pre-emptive email ban if requested
        if (targetEmail && (action === "ban_instant" || action === "ban_scheduled")) {
            await adminDb.collection("banned_emails").doc(targetEmail).set({
                email: targetEmail,
                reason: reason || "Admin action",
                bannedAt: scheduledAt || Date.now()
            }, { merge: true });
        } else if (targetEmail && action.startsWith("unban")) {
            await adminDb.collection("banned_emails").doc(targetEmail).delete().catch(() => {});
        }

        // If user doesn't exist, we just applied the pre-emptive ban.
        if (!targetUid) {
            return NextResponse.json({ message: "Pre-emptive action applied to email." });
        }

        // Apply action to actual user document
        const userRef = adminDb.collection("users").doc(targetUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
             return NextResponse.json({ message: "Pre-emptive action applied to email. User doc not found." });
        }

        const updates: any = { updatedAt: Date.now() };

        switch (action) {
            case "ban_instant":
                updates.banStatus = "banned";
                updates.banScheduledAt = null;
                updates.unbanScheduledAt = null;
                updates.banReason = reason || "Violated terms of service";
                break;
            case "ban_scheduled":
                if (!scheduledAt) return NextResponse.json({ message: "scheduledAt required" }, { status: 400 });
                updates.banScheduledAt = scheduledAt;
                updates.banReason = reason || "Violated terms of service";
                break;
            case "unban_instant":
                updates.banStatus = "none";
                updates.banScheduledAt = null;
                updates.unbanScheduledAt = null;

                await createNotificationForUser({
                    userId: targetUid,
                    type: "SYSTEM",
                    title: "Ban Lifted",
                    message: "Your account ban has been lifted by an administrator.",
                });
                break;
            case "unban_scheduled":
                if (!scheduledAt) return NextResponse.json({ message: "scheduledAt required" }, { status: 400 });
                updates.unbanScheduledAt = scheduledAt;
                break;
            case "unban_caution":
                updates.banStatus = "none";
                updates.banScheduledAt = null;
                updates.unbanScheduledAt = null;
                
                await createNotificationForUser({
                    userId: targetUid,
                    type: "SYSTEM",
                    title: "Account Caution",
                    message: "Your account ban has been lifted, but you are under strict scrutiny. Further violations will result in a permanent ban.",
                });
                break;
        }

        await userRef.update(updates);

        const adminEmailStr = admin.email || admin.uid || "Unknown Admin";
        let logActionType: "BAN_USER" | "UNBAN_USER" | "OTHER" = "OTHER";
        if (action.startsWith("ban")) logActionType = "BAN_USER";
        if (action.startsWith("unban")) logActionType = "UNBAN_USER";

        await logAdminAction(adminEmailStr, logActionType, `Applied ${action} to user ${targetEmail || targetUid}`);

        return NextResponse.json({ success: true, message: "Action applied successfully" });
    } catch (error: any) {
        console.error("Error applying ban action:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

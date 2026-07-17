import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDeleteLink, adminUpdateLink, adminLiftGuestLock } from "@/services/links";
import { logAdminAction } from "@/services/admin-logs";

export async function PATCH(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const { slugs, action, newExpiry } = body;

        if (!Array.isArray(slugs) || slugs.length === 0) {
            return NextResponse.json({ message: "No links provided" }, { status: 400 });
        }

        let updates: any = {};
        let logMessage = "";
        
        switch (action) {
            case "revoke":
                updates = { isActive: false };
                logMessage = `Revoked ${slugs.length} links`;
                break;
            case "enable":
                updates = { isActive: true };
                logMessage = `Re-enabled ${slugs.length} links`;
                break;
            case "extend_expiry":
                if (!newExpiry || typeof newExpiry !== "number") {
                    return NextResponse.json({ message: "Invalid newExpiry timestamp" }, { status: 400 });
                }
                updates = { expiresAt: newExpiry, deleteAt: null };
                logMessage = `Extended expiry for ${slugs.length} links`;
                break;
            case "make_permanent":
                updates = { expiresAt: null, deleteAt: null };
                logMessage = `Made ${slugs.length} links permanent`;
                break;
            case "lift_guest_lock":
                updates = {};
                logMessage = `Lifted signup lock for ${slugs.length} guest links`;
                break;
            default:
                return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        // Process sequentially to avoid overwhelming the database/redis with concurrent updates
        for (const slug of slugs) {
            try {
                if (action === "lift_guest_lock") {
                    await adminLiftGuestLock(slug);
                } else {
                    await adminUpdateLink(slug, updates);
                }
            } catch (e) {
                console.error(`Failed to batch update link ${slug}:`, e);
            }
        }

        await logAdminAction(admin.email || admin.uid || "Unknown", "OTHER", logMessage);

        return NextResponse.json({ success: true, message: logMessage });
    } catch (error: any) {
        console.error("Admin link batch patch error:", error);
        return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const { slugs } = body;

        if (!Array.isArray(slugs) || slugs.length === 0) {
            return NextResponse.json({ message: "No links provided" }, { status: 400 });
        }

        for (const slug of slugs) {
            try {
                await adminDeleteLink(slug);
            } catch (e) {
                console.error(`Failed to batch delete link ${slug}:`, e);
            }
        }

        await logAdminAction(admin.email || admin.uid || "Unknown", "OTHER", `Hard deleted ${slugs.length} links and their history`);

        return NextResponse.json({ success: true, message: `Successfully deleted ${slugs.length} links` });
    } catch (error: any) {
        console.error("Admin link batch delete error:", error);
        return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
    }
}

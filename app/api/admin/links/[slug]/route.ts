import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDeleteLink, adminUpdateLink, adminLiftGuestLock } from "@/services/links";
import { logAdminAction } from "@/services/admin-logs";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { slug } = await params;
        const body = await request.json();
        const { action, newExpiry } = body;

        let updates: any = {};
        let logMessage = "";
        
        switch (action) {
            case "revoke":
                updates = { isActive: false };
                logMessage = `Revoked link ${slug}`;
                break;
            case "enable":
                updates = { isActive: true };
                logMessage = `Re-enabled link ${slug}`;
                break;
            case "extend_expiry":
                if (!newExpiry || typeof newExpiry !== "number") {
                    return NextResponse.json({ message: "Invalid newExpiry timestamp" }, { status: 400 });
                }
                updates = { expiresAt: newExpiry, deleteAt: null };
                logMessage = `Extended expiry for link ${slug}`;
                break;
            case "make_permanent":
                updates = { expiresAt: null, deleteAt: null };
                logMessage = `Made link ${slug} permanent`;
                break;
            case "lift_guest_lock":
                updates = {};
                logMessage = `Lifted signup lock for guest link ${slug}`;
                break;
            default:
                return NextResponse.json({ message: "Invalid action" }, { status: 400 });
        }

        if (action === "lift_guest_lock") {
            await adminLiftGuestLock(slug);
        } else {
            await adminUpdateLink(slug, updates);
        }
        await logAdminAction(admin.email || admin.uid || "Unknown", "OTHER", logMessage);

        return NextResponse.json({ success: true, message: logMessage });
    } catch (error: any) {
        console.error("Admin link patch error:", error);
        return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { slug } = await params;
        
        await adminDeleteLink(slug);
        await logAdminAction(admin.email || admin.uid || "Unknown", "OTHER", `Hard deleted link ${slug} and its history`);

        return NextResponse.json({ success: true, message: "Link deleted successfully" });
    } catch (error: any) {
        console.error("Admin link delete error:", error);
        return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
    }
}

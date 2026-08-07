import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { revokePartialOfferAndRevertUser } from "@/services/partial-offers";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ code: "INVALID_ID", message: "Missing offer ID" }, { status: 400 });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
        }

        const adminEmail = decoded.email || null;
        if (!isAdminEmail(adminEmail)) {
            return NextResponse.json({ code: "FORBIDDEN", message: "Admin privileges required" }, { status: 403 });
        }

        const result = await revokePartialOfferAndRevertUser(id, adminEmail || "admin");
        return NextResponse.json({
            success: true,
            message: `Revoked partial offer ${id} and reverted ${result.revokedCount} claimed user account(s).`,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to revoke partial offer.";
        logger.error("api_admin_partial_offer_revoke", message, { error: String(error) });
        return NextResponse.json({ code: "REVOCATION_FAILED", message }, { status: 500 });
    }
}

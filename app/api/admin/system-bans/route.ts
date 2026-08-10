import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, email, guestId } = body;

        logger.warn("system_bans_security_strike", `Security strike recorded for unauthorized admin access attempt`, {
            action,
            email: email || "anonymous",
            guestId: guestId || "unknown",
            ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        });

        return NextResponse.json({
            ok: true,
            isBanned: false,
            message: "Access violation warning: This workspace is reserved for configured XURL administrators.",
        });
    } catch (error) {
        logger.error("system_bans_post_error", "Failed to record security strike", { error: String(error) });
        return NextResponse.json({ ok: false, isBanned: false, message: "Security check completed." }, { status: 200 });
    }
}

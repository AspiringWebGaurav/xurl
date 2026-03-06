import { NextRequest, NextResponse } from "next/server";
import { checkGuestLimit } from "@/services/guest";

/**
 * GET /api/guest-status
 *
 * Server-synced guest state check.
 * Returns the guest's active link details if one exists,
 * or { active: false } if the guest is free to create a new link.
 *
 * Uses IP + fingerprint to identify the guest — no localStorage trust.
 */
export async function GET(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    const fingerprint = request.headers.get("x-device-fingerprint") || undefined;

    const status = await checkGuestLimit(ip, fingerprint);

    if (!status.allowed && status.slug) {
        return NextResponse.json({
            active: true,
            slug: status.slug,
            originalUrl: status.originalUrl,
            createdAt: status.createdAt,
            expiresIn: status.expiresIn,
        });
    }

    return NextResponse.json({ active: false });
}

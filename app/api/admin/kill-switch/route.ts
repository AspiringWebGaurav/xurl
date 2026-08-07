import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { getKillSwitchState, setKillSwitchState } from "@/lib/services/kill-switch";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const state = await getKillSwitchState();
    return NextResponse.json({ success: true, state });
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const active = Boolean(body.active);
        const reason = typeof body.reason === "string" ? body.reason : undefined;

        const updatedState = await setKillSwitchState(active, admin.email || "admin", reason);

        return NextResponse.json({
            success: true,
            message: active
                ? "Emergency Kill Switch ENGAGED. Public services paused."
                : "Emergency Kill Switch DISENGAGED. System operations restored.",
            state: updatedState,
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, message: "Failed to update kill switch state", error: String(err) },
            { status: 500 }
        );
    }
}

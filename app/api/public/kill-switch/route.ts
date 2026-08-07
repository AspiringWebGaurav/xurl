import { NextResponse } from "next/server";
import { getKillSwitchState } from "@/lib/services/kill-switch";

export const dynamic = "force-dynamic";

export async function GET() {
    const state = await getKillSwitchState();
    return NextResponse.json({
        active: state.active,
        reason: state.reason,
        activatedAt: state.activatedAt,
        updatedAt: state.updatedAt,
    });
}

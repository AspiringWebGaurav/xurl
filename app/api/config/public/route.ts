import { NextResponse } from "next/server";
import { getDynamicConfig } from "@/lib/services/dynamic-config";

// We want this endpoint to be fast and heavily cached, but it will rely on Redis directly.
// The dynamic-config service already hits Redis first.
export async function GET() {
    try {
        const config = await getDynamicConfig();
        return NextResponse.json({ config });
    } catch (e) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/services/analytics";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { slug, referrer, country, userAgent } = body;

        if (!slug) {
            return new NextResponse("Missing slug", { status: 400 });
        }

        // Fire-and-forget analytics
        recordClick(slug, {
            referrer,
            country,
            userAgent,
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Analytics click error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

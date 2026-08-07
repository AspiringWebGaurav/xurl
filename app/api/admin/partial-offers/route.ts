import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { createPartialOffer, getAllPartialOffers } from "@/services/partial-offers";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const targetEmail = request.nextUrl.searchParams.get("targetEmail") || undefined;
        const items = await getAllPartialOffers(targetEmail);
        return NextResponse.json({ items });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch partial offers";
        return NextResponse.json({ message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const item = await createPartialOffer(body, admin.email || "admin");
        return NextResponse.json({ success: true, item });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create partial offer";
        return NextResponse.json({ message }, { status: 400 });
    }
}

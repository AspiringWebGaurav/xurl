import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { listPromoRedemptions } from "@/services/promo-codes";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { id } = await params;
    const items = await listPromoRedemptions(id);
    return NextResponse.json({ items });
}

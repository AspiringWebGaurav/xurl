import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { deletePartialOffer, updatePartialOffer } from "@/services/partial-offers";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const item = await updatePartialOffer(id, body, admin.email || "admin");
        return NextResponse.json({ success: true, item });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update partial offer";
        return NextResponse.json({ message }, { status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { id } = await params;
        await deletePartialOffer(id, admin.email || "admin");
        return NextResponse.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete partial offer";
        return NextResponse.json({ message }, { status: 400 });
    }
}

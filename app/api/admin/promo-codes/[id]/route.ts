import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { deletePromoCode, updatePromoCode } from "@/services/promo-codes";

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
        const discountValue = body.discountValue === undefined ? undefined : Number(body.discountValue);
        const updated = await updatePromoCode(
            id,
            {
                code: body.code,
                discountType: body.discountType,
                discountValue: discountValue !== undefined && Number.isFinite(discountValue) ? discountValue : undefined,
                startsAt: body.startsAt === undefined ? undefined : body.startsAt ? Number(body.startsAt) : null,
                expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? Number(body.expiresAt) : null,
                usageLimit: body.usageLimit === undefined ? undefined : body.usageLimit ? Number(body.usageLimit) : null,
                usageCount: body.usageCount === undefined ? undefined : Number(body.usageCount),
                planRestriction: body.planRestriction === undefined ? undefined : body.planRestriction || null,
                planRestrictions: Array.isArray(body.planRestrictions) ? body.planRestrictions : null,
                status: body.status,
                isActive: body.isActive,
                perUserLimit: body.perUserLimit === undefined ? undefined : body.perUserLimit !== null ? Number(body.perUserLimit) : null,
                firstTimeOnly: body.firstTimeOnly === undefined ? undefined : Boolean(body.firstTimeOnly),
            },
            admin.uid,
            admin.email
        );

        return NextResponse.json({ success: true, item: updated });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update promo code.";
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

    const { id } = await params;
    await deletePromoCode(id, admin.uid, admin.email);
    return NextResponse.json({ success: true });
}

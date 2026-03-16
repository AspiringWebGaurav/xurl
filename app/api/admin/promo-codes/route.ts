import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { createPromoCode, listPromoCodes } from "@/services/promo-codes";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const items = await listPromoCodes();
    return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const discountValue = Number(body.discountValue);
        const created = await createPromoCode(
            {
                code: body.code,
                discountType: body.discountType,
                discountValue: Number.isFinite(discountValue) ? discountValue : undefined,
                startsAt: body.startsAt ? Number(body.startsAt) : null,
                expiresAt: body.expiresAt ? Number(body.expiresAt) : null,
                usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
                planRestriction: body.planRestriction || null,
                planRestrictions: Array.isArray(body.planRestrictions) ? body.planRestrictions : null,
                status: body.status,
                isActive: body.isActive !== false,
                perUserLimit: body.perUserLimit === undefined ? null : Number(body.perUserLimit) || null,
                firstTimeOnly: Boolean(body.firstTimeOnly),
            },
            admin.uid,
            admin.email
        );

        return NextResponse.json({ success: true, item: { id: created.id, ...created.data } });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create promo code.";
        return NextResponse.json({ message }, { status: 400 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateSchema = z.object({
    status: z.enum(["new", "read"]).optional(),
    isResolved: z.boolean().optional(),
}).refine(data => data.status !== undefined || data.isResolved !== undefined, {
    message: "At least one field (status or isResolved) must be provided",
});

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
        const validatedData = updateSchema.parse(body);

        const docRef = adminDb.collection("contact_submissions").doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json(
                { message: "Contact submission not found" },
                { status: 404 }
            );
        }

        const updateData: Record<string, unknown> = {
            updatedAt: Date.now(),
        };

        if (validatedData.status !== undefined) {
            updateData.status = validatedData.status;
        }

        if (validatedData.isResolved !== undefined) {
            updateData.isResolved = validatedData.isResolved;
        }

        await docRef.update(updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.issues[0];
            return NextResponse.json(
                { message: firstError.message },
                { status: 400 }
            );
        }

        logger.error("admin_contact_update_error", "Failed to update contact submission", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { message: "Failed to update contact submission" },
            { status: 500 }
        );
    }
}

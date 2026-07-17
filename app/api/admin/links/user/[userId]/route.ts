import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const { userId } = await params;

        const snapshot = await adminDb
            .collection("links")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        const links = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                slug: data.slug,
                originalUrl: data.originalUrl,
                createdAt: data.createdAt,
                expiresAt: data.expiresAt,
                isActive: data.isActive,
                totalClicks: data.totalClicks || 0,
            };
        });

        return NextResponse.json({ success: true, links });
    } catch (error) {
        console.error("Failed to fetch user links:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

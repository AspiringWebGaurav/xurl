import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const snapshot = await adminDb
            .collection("users")
            .where("linksCreated", ">", 0)
            .orderBy("linksCreated", "desc")
            .limit(200) // reasonable limit for admin dashboard to start
            .get();

        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                name: data.displayName || "Unknown",
                linksCreated: data.linksCreated || 0,
                activeLinks: data.activeLinks || 0,
            };
        });

        return NextResponse.json({ success: true, users });
    } catch (error) {
        console.error("Failed to fetch link users:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

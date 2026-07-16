import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) return NextResponse.json({ message: admin.message }, { status: admin.status });

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        if (!userId) return NextResponse.json({ message: "userId is required" }, { status: 400 });

        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const userData = userSnap.data()!;
        const giftQuotas = Array.isArray(userData.giftQuotas) ? userData.giftQuotas : [];
        const giftUsageCount = userData.gift_usage_count || 0;
        
        return NextResponse.json({ giftQuotas, giftUsageCount });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch gifts";
        return NextResponse.json({ message }, { status: 400 });
    }
}

export async function POST(request: NextRequest) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    try {
        const body = await request.json();
        const { userId, grantId, action, newExpiryMs } = body;

        if (!userId || !grantId || !action) {
            return NextResponse.json({ message: "userId, grantId, and action are required" }, { status: 400 });
        }

        const userRef = adminDb.collection("users").doc(userId);

        await adminDb.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                throw new Error("User not found");
            }

            const userData = userSnap.data()!;
            const giftQuotas = Array.isArray(userData.giftQuotas) ? userData.giftQuotas : [];
            const grantIndex = giftQuotas.findIndex((g: any) => g.id === grantId);

            if (grantIndex === -1) {
                throw new Error("Gift quota not found on user");
            }

            if (action === "revoke") {
                giftQuotas.splice(grantIndex, 1);
            } else if (action === "update_expiry") {
                giftQuotas[grantIndex].expiresAt = newExpiryMs === null ? null : Date.now() + newExpiryMs;
            } else {
                throw new Error("Invalid action");
            }

            transaction.set(userRef, { 
                giftQuotas, 
                updatedAt: Date.now() 
            }, { merge: true });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to manage grant";
        return NextResponse.json({ message }, { status: 400 });
    }
}

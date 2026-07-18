import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);

        if (!decoded.email || !isAdminEmail(decoded.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { guestSessionId, action } = await request.json();

        if (!guestSessionId) {
            return NextResponse.json({ error: "Missing guestSessionId" }, { status: 400 });
        }

        const docRef = adminDb.collection("banned_guests").doc(guestSessionId);

        if (action === "ban") {
            await docRef.set({
                bannedAt: Date.now(),
                bannedBy: decoded.uid
            });
            
            // Also revoke all their links to make the ban effective immediately
            const guestLinksSnapshot = await adminDb.collection("links").where("guestSessionId", "==", guestSessionId).get();
            const batch = adminDb.batch();
            guestLinksSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { isActive: false });
            });
            await batch.commit();
        } else if (action === "unban") {
            await docRef.delete();
            
            // Re-enable their links
            const guestLinksSnapshot = await adminDb.collection("links").where("guestSessionId", "==", guestSessionId).get();
            const batch = adminDb.batch();
            guestLinksSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { isActive: true });
            });
            await batch.commit();
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in guest ban route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

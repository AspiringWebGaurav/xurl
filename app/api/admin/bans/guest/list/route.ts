import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";

export async function GET(request: Request) {
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

        const snapshot = await adminDb.collection("banned_guests").orderBy("bannedAt", "desc").get();
        
        const bannedGuests = snapshot.docs.map(doc => ({
            guestSessionId: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ items: bannedGuests });
    } catch (error) {
        console.error("Error in guest ban list route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

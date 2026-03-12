import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        // 1. Verify Authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        let uid = "";
        try {
            const token = authHeader.split("Bearer ")[1];
            const decoded = await adminAuth.verifyIdToken(token);
            uid = decoded.uid;
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        // 2. Extract Device Identifiers (IP / Fingerprint)
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
        
        const body = await request.json().catch(() => ({}));
        const fingerprintArg = body.fingerprint || request.headers.get("x-device-fingerprint") || undefined;
        const fingerprintHash = fingerprintArg ? crypto.createHash("sha256").update(fingerprintArg).digest("hex") : undefined;

        // 3. Find Anonymous Links for this session
        // We will query where userId == "anonymous" (if possible) or just do a manual check
        // Unfortunately, Firestore doesn't easily let us query by multiple OR conditions on different fields without composite indexes.
        // We'll query links by IP hash first, as it's the most common denominator.
        const linksSnap = await adminDb.collection("links")
            .where("userId", "==", "anonymous")
            .get();

        const batch = adminDb.batch();
        let migratedCount = 0;

        linksSnap.forEach((doc) => {
            const data = doc.data();
            // Check if this link belongs to this current browser session
            let matches = false;
            
            // Check guest_usage if possible, but actually links just store createdUnderPlan
            // Wait, does createLink store ipHash on the link document itself?
            // Let's check services/links.ts inside createLink. It doesn't save ipHash to the link document.
            // But we can check guest_usage collection!
            if (data.userId === "anonymous") {
                // If we don't store ipHash on the link, we cannot easily migrate *only* this user's links
                // However, wait. guest_usage maps IP/Fingerprint to a slug!
            }
        });

        // ACTUALLY: Let's query guest_usage
        const guestUsageRef1 = await adminDb.collection("guest_usage").doc(ipHash).get();
        let targetSlug = null;
        if (guestUsageRef1.exists) targetSlug = guestUsageRef1.data()?.slug;
        
        if (!targetSlug && fingerprintHash) {
            const guestUsageRef2 = await adminDb.collection("guest_usage").doc(fingerprintHash).get();
            if (guestUsageRef2.exists) targetSlug = guestUsageRef2.data()?.slug;
        }

        if (targetSlug) {
            const linkDoc = await adminDb.collection("links").doc(targetSlug).get();
            if (linkDoc.exists && linkDoc.data()?.userId === "anonymous") {
                
                // Migrate the link!
                batch.update(linkDoc.ref, { 
                    userId: uid,
                    // Keep the original createdUnderPlan string (likely "free" or something) so we know its origin
                });
                
                // Also increment the user's stats
                const userRef = adminDb.collection("users").doc(uid);
                const userSnap = await userRef.get();
                if (userSnap.exists) {
                    batch.update(userRef, {
                        linksCreated: FieldValue.increment(1),
                        // Only increment active Links if it hasn't expired yet
                        activeLinks: (linkDoc.data()!.expiresAt > Date.now() && linkDoc.data()!.isActive) ? FieldValue.increment(1) : FieldValue.increment(0)
                    });
                } else {
                    // Create the user if they don't exist yet via the login sync
                    batch.set(userRef, {
                        plan: "free",
                        activeLinks: (linkDoc.data()!.expiresAt > Date.now() && linkDoc.data()!.isActive) ? 1 : 0,
                        linksCreated: 1,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
                
                // Clean up guest usage mapping so they can theoretically generate another guest link if they sign out, 
                // or just to keep the DB clean
                if (guestUsageRef1.exists) batch.delete(guestUsageRef1.ref);
                const fpRef = fingerprintHash ? adminDb.collection("guest_usage").doc(fingerprintHash) : null;
                if (fpRef) {
                    const checkFp = await fpRef.get();
                    if (checkFp.exists) batch.delete(fpRef);
                }

                await batch.commit();
                migratedCount = 1;
            }
        }

        return NextResponse.json({ success: true, migratedCount });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { checkUserBanned } from "@/lib/admin-access";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { getClientIp } from "@/lib/utils/ip-resolver";
import { resolveGuestId } from "@/services/guest";

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

        const { banned } = await checkUserBanned(uid);
        if (banned) {
            return NextResponse.json({ error: "Access suspended" }, { status: 403 });
        }

        // 2. Extract Device Identifiers (IP / Fingerprint)
        const ip = getClientIp(request);
        
        function hashData(data: string): string {
            return crypto.createHash("sha256").update(data).digest("hex");
        }
        
        const ipHash = hashData(ip);
        
        const body = await request.json().catch(() => ({}));
        const fingerprintArg = body.fingerprint || request.headers.get("x-device-fingerprint") || undefined;
        const fingerprintHash = fingerprintArg ? hashData(fingerprintArg) : undefined;

        const batch = adminDb.batch();
        let migratedCount = 0;

        // Query guest_usage to find the slug belonging to this browser session
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
                const linkData = linkDoc.data()!;
                const isLinkStillActive = linkData.isActive && (!linkData.expiresAt || linkData.expiresAt > Date.now());

                if (userSnap.exists) {
                    const updateData: Record<string, unknown> = {
                        linksCreated: FieldValue.increment(1),
                    };
                    if (isLinkStillActive) {
                        updateData.activeLinks = FieldValue.increment(1);
                    }
                    batch.update(userRef, updateData);
                } else {
                    // Create the user if they don't exist yet via the login sync
                    batch.set(userRef, {
                        plan: "free",
                        activeLinks: isLinkStillActive ? 1 : 0,
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

        // Link guest entity to user account (if exists)
        const guestId = resolveGuestId(ipHash, fingerprintHash || null);
        const guestEntityRef = adminDb.collection("guest_entities").doc(guestId);

        try {
            const guestEntitySnap = await guestEntityRef.get();
            
            if (guestEntitySnap.exists) {
                const guestData = guestEntitySnap.data();
                
                // Only link if not already linked (idempotency)
                if (!guestData?.userId) {
                    await guestEntityRef.update({
                        userId: uid,
                        lastInteractionAt: Date.now()
                    });
                    
                    console.log(`[user-sync] Linked guest entity ${guestId} to user ${uid}`);
                }
            }
            // If entity doesn't exist, skip silently (created lazily on first link)
        } catch (err) {
            // Log but don't fail the sync operation
            console.error(`[user-sync] Failed to link guest entity ${guestId}:`, err);
        }

        return NextResponse.json({ success: true, migratedCount });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

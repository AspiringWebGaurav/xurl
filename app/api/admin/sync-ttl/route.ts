import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { getAllComputedPlanConfigs } from "@/lib/services/dynamic-config";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max duration for Vercel Hobby/Pro if allowed, ignored otherwise

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        
        if (!isAdminEmail(decoded.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const computedConfigs = await getAllComputedPlanConfigs();
        const BATCH_SIZE = 500;
        let linksUpdated = 0;
        let guestsUpdated = 0;

        // 1. Update `links` collection
        let lastDoc = null;
        let hasMore = true;

        while (hasMore) {
            let query = adminDb.collection("links").orderBy("__name__").limit(BATCH_SIZE);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snap = await query.get();
            if (snap.empty) {
                hasMore = false;
                break;
            }

            const batch = adminDb.batch();
            let updatesInBatch = 0;

            snap.docs.forEach((doc) => {
                const data = doc.data();
                const plan = data.createdUnderPlan || "free";
                const config = computedConfigs[plan as keyof typeof computedConfigs];
                
                if (config && config.ttlMs) {
                    const dynamicExpiresAt = data.createdAt + config.ttlMs;
                    // Only update if it actually changed to save writes
                    if (data.expiresAt !== dynamicExpiresAt) {
                        batch.update(doc.ref, {
                            expiresAt: dynamicExpiresAt,
                            deleteAt: dynamicExpiresAt + (7 * 24 * 60 * 60 * 1000)
                        });
                        updatesInBatch++;
                        linksUpdated++;
                    }
                }
            });

            if (updatesInBatch > 0) {
                await batch.commit();
            }

            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.size < BATCH_SIZE) {
                hasMore = false;
            }
        }

        // 2. Update `guest_usage` collection
        lastDoc = null;
        hasMore = true;
        const guestConfig = computedConfigs["guest"] || computedConfigs["free"]; // Guest TTL is same as Free normally unless overridden

        while (hasMore && guestConfig?.ttlMs) {
            let query = adminDb.collection("guest_usage").orderBy("__name__").limit(BATCH_SIZE);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snap = await query.get();
            if (snap.empty) {
                hasMore = false;
                break;
            }

            const batch = adminDb.batch();
            let updatesInBatch = 0;

            snap.docs.forEach((doc) => {
                const data = doc.data();
                const dynamicExpiresAt = data.createdAt + guestConfig.ttlMs;
                
                if (data.expiresAt !== dynamicExpiresAt) {
                    batch.update(doc.ref, { expiresAt: dynamicExpiresAt });
                    updatesInBatch++;
                    guestsUpdated++;
                }
            });

            if (updatesInBatch > 0) {
                await batch.commit();
            }

            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.size < BATCH_SIZE) {
                hasMore = false;
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Synced TTL for ${linksUpdated} links and ${guestsUpdated} guest records.`
        });
    } catch (e) {
        console.error("TTL Sync Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

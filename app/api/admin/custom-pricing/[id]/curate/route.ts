import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin-access";
import { adminDb } from "@/lib/firebase/admin";
import { createPartialOffer, updatePartialOffer } from "@/services/partial-offers";
import { writeActivityEvent } from "@/lib/admin/activity-events-writer";
import { logger } from "@/lib/utils/logger";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
        return NextResponse.json({ message: admin.message }, { status: admin.status });
    }

    const { id: requestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { 
        action, 
        approvedPriceINR, 
        approvedLinks, 
        approvedApiQuota, 
        customTitle, 
        notes, 
        eligiblePlans,
        expiresInDays
    } = body;

    if (action !== "curate" && action !== "reject" && action !== "reopen") {
        return NextResponse.json(
            { code: "INVALID_ACTION", message: "Action must be 'curate', 'reject', or 'reopen'" },
            { status: 400 }
        );
    }

    const reqRef = adminDb.collection("custom_pricing_requests").doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Proposal not found" }, { status: 404 });
    }

    const reqData = reqSnap.data()!;
    const now = Date.now();

    // ─── ACTION: REJECT ──────────────────────────────────────────────────────────
    if (action === "reject") {
        try {
            // If an offer was already curated for this request, revoke it immediately
            if (reqData.curatedOfferId) {
                try {
                    await adminDb.collection("partial_offers").doc(reqData.curatedOfferId).update({
                        isActive: false,
                        isRevoked: true,
                        revokedAt: now,
                        updatedAt: now,
                    });
                } catch {
                    // Ignore if offer was already removed
                }
            }

            await reqRef.update({
                status: "rejected",
                processedAt: now,
                processedBy: admin.email || admin.uid,
                adminNotes: notes || "Proposal rejected by administrator.",
                updatedAt: now,
            });

            try {
                await writeActivityEvent({
                    type: "CUSTOM_PLAN_REJECTED",
                    actor: admin.email || admin.uid,
                    sourceCollection: "custom_pricing_requests",
                    metadata: {
                        requestId,
                        targetEmail: reqData.email,
                        notes: notes || "Rejected by admin",
                    },
                    severity: "ADMIN",
                });
            } catch {
                // Ignore logging errors
            }

            return NextResponse.json({
                success: true,
                message: "Custom pricing proposal rejected and any active offers revoked.",
                status: "rejected",
            });
        } catch (error) {
            logger.error("custom_pricing_reject_error", "Failed to reject proposal", { error: String(error), requestId });
            return NextResponse.json(
                { code: "REJECT_FAILED", message: "Failed to reject proposal." },
                { status: 500 }
            );
        }
    }

    // ─── ACTION: REOPEN ──────────────────────────────────────────────────────────
    if (action === "reopen") {
        try {
            // If there is an offer, deactivate it until re-curated
            if (reqData.curatedOfferId) {
                try {
                    await adminDb.collection("partial_offers").doc(reqData.curatedOfferId).update({
                        isActive: false,
                        updatedAt: now,
                    });
                } catch {
                    // Ignore
                }
            }

            await reqRef.update({
                status: "pending",
                adminNotes: notes || null,
                updatedAt: now,
            });

            return NextResponse.json({
                success: true,
                message: "Proposal reopened as pending.",
                status: "pending",
            });
        } catch (error) {
            logger.error("custom_pricing_reopen_error", "Failed to reopen proposal", { error: String(error), requestId });
            return NextResponse.json(
                { code: "REOPEN_FAILED", message: "Failed to reopen proposal." },
                { status: 500 }
            );
        }
    }

    // ─── ACTION: CURATE ──────────────────────────────────────────────────────────
    const finalPriceINR = Number(approvedPriceINR);
    if (isNaN(finalPriceINR) || finalPriceINR <= 0) {
        return NextResponse.json(
            { code: "INVALID_PRICE", message: "Please provide a valid approved price in Rupees (₹)." },
            { status: 400 }
        );
    }

    const finalLinks = Number(approvedLinks) > 0 ? Number(approvedLinks) : (Number(reqData.linksNeeded) || 50000);
    const finalApiQuota = Number(approvedApiQuota) > 0 ? Number(approvedApiQuota) : (Number(reqData.apiQuotaNeeded) || 2000000);
    const targetEmail = reqData.email.trim().toLowerCase();
    const offerTitle = (customTitle || "").trim() || `Curated Enterprise Plan for ${targetEmail}`;
    const offerDescription = (notes || "").trim() ||
        `Curated custom plan: ${finalLinks.toLocaleString()} permanent links & ${finalApiQuota.toLocaleString()} API calls/mo at ₹${finalPriceINR.toLocaleString()}/mo.`;

    const plansToAssign = Array.isArray(eligiblePlans) && eligiblePlans.length > 0 && !eligiblePlans.includes("all") 
        ? eligiblePlans 
        : ["enterprise"];
    const expiryTimestamp = expiresInDays && Number(expiresInDays) > 0 ? now + Number(expiresInDays) * 24 * 60 * 60 * 1000 : null;

    try {
        let offerId = reqData.curatedOfferId;

        // Check if existing offer can be updated idempotently
        if (offerId) {
            try {
                const existingOfferSnap = await adminDb.collection("partial_offers").doc(offerId).get();
                if (existingOfferSnap.exists) {
                    await updatePartialOffer(
                        offerId,
                        {
                            targetEmail,
                            title: offerTitle,
                            description: offerDescription,
                            discountType: "custom_price",
                            discountValue: finalPriceINR,
                            plans: plansToAssign,
                            billingCycle: "all",
                            expiresAt: expiryTimestamp,
                            isActive: true,
                            isRevoked: false,
                            notes: `Curated custom plan: ${finalLinks} links, ${finalApiQuota} API. Notes: ${notes || "None"}`,
                            customLinks: finalLinks,
                            customApiQuota: finalApiQuota,
                        },
                        admin.email || "admin"
                    );
                } else {
                    offerId = null;
                }
            } catch {
                offerId = null;
            }
        }

        // If no existing offer, create a new one
        if (!offerId) {
            const newOffer = await createPartialOffer(
                {
                    targetEmail,
                    title: offerTitle,
                    description: offerDescription,
                    discountType: "custom_price",
                    discountValue: finalPriceINR,
                    plans: plansToAssign,
                    billingCycle: "all",
                    startsAt: now,
                    expiresAt: expiryTimestamp,
                    usageLimit: 1,
                    perUserLimit: 1,
                    priority: 100,
                    isActive: true,
                    isRevoked: false,
                    revokedAt: null,
                    notes: `Curated custom plan: ${finalLinks} links, ${finalApiQuota} API. Notes: ${notes || "None"}`,
                    createdBy: admin.email || "admin",
                    customLinks: finalLinks,
                    customApiQuota: finalApiQuota,
                },
                admin.email || "admin"
            );
            offerId = newOffer.id;
        }

        // Update the custom pricing request document in Firestore
        await reqRef.update({
            status: "curated",
            curatedPriceINR: finalPriceINR,
            curatedLinks: finalLinks,
            curatedApiQuota: finalApiQuota,
            curatedAt: now,
            curatedBy: admin.email || admin.uid,
            curatedOfferId: offerId,
            adminNotes: notes || null,
            updatedAt: now,
        });

        try {
            await writeActivityEvent({
                type: "CUSTOM_PLAN_CURATED",
                actor: admin.email || admin.uid,
                sourceCollection: "custom_pricing_requests",
                metadata: {
                    requestId,
                    targetEmail,
                    approvedPriceINR: finalPriceINR,
                    approvedLinks: finalLinks,
                    approvedApiQuota: finalApiQuota,
                    offerId,
                },
                severity: "ADMIN",
            });
        } catch {
            // Ignore activity event write errors
        }

        logger.info("custom_pricing_curated", `Curated offer ${offerId} for ${targetEmail} at ₹${finalPriceINR}/mo`, {
            requestId,
            links: finalLinks,
            apiQuota: finalApiQuota,
            admin: admin.email,
        });

        return NextResponse.json({
            success: true,
            message: `Custom plan curated and rendered to account ${targetEmail} for ₹${finalPriceINR.toLocaleString()}/mo!`,
            status: "curated",
            offerId,
            curatedLinks: finalLinks,
            curatedApiQuota: finalApiQuota,
            curatedPriceINR: finalPriceINR,
        });
    } catch (error) {
        logger.error("custom_pricing_curate_error", "Failed to curate custom plan", {
            error: String(error),
            requestId,
        });
        return NextResponse.json(
            { code: "CURATION_FAILED", message: `Failed to curate plan: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}

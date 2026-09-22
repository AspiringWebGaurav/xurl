import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/utils/logger";

// ─── Rate Limiter Configuration ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_RATE_LIMITER_ENTRIES = 10_000;

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
        if (rateLimitMap.size >= MAX_RATE_LIMITER_ENTRIES) {
            for (const [k, val] of rateLimitMap) {
                if (now - val.windowStart >= windowMs) rateLimitMap.delete(k);
                if (rateLimitMap.size < MAX_RATE_LIMITER_ENTRIES * 0.8) break;
            }
        }
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return false;
    }

    if (entry.count >= maxRequests) return true;
    entry.count++;
    return false;
}

export async function POST(request: NextRequest) {
    try {
        // Extract Client IP
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0].trim() : (request.headers.get("x-real-ip") || "unknown");

        // 1. IP-based Rate Limiting (max 5 proposals per 15 minutes)
        if (isRateLimited(`ip:${ip}`, 5, 15 * 60 * 1000)) {
            logger.warn("custom_pricing_rate_limited", `Rate limited proposal from IP: ${ip}`);
            return NextResponse.json(
                { 
                    code: "RATE_LIMITED", 
                    message: "Too many proposal submissions. Please wait 15 minutes before submitting another request." 
                },
                { status: 429, headers: { "Retry-After": "900" } }
            );
        }

        let userId: string | null = null;
        let authenticatedEmail: string | null = null;

        const authHeader = request.headers.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await adminAuth.verifyIdToken(token);
                userId = decoded.uid;
                authenticatedEmail = decoded.email || null;
            } catch {
                // Allow guest proposal submission even if token verification fails
            }
        }

        const body = await request.json().catch(() => ({}));
        const rawEmail = (authenticatedEmail || body.email || "").trim().toLowerCase();

        // 2. Email Validation
        if (!rawEmail || !rawEmail.includes("@") || rawEmail.length > 254) {
            return NextResponse.json(
                { code: "INVALID_EMAIL", message: "A valid email address is required." },
                { status: 400 }
            );
        }

        // 3. Email-based Rate Limiting (max 3 proposals per 30 minutes)
        if (isRateLimited(`email:${rawEmail}`, 3, 30 * 60 * 1000)) {
            logger.warn("custom_pricing_email_rate_limited", `Rate limited proposal from email: ${rawEmail}`);
            return NextResponse.json(
                { 
                    code: "RATE_LIMITED", 
                    message: "You have submitted multiple proposals recently. Please wait for our team to review your request." 
                },
                { status: 429, headers: { "Retry-After": "1800" } }
            );
        }

        // 4. Boundary & Anti-Abuse Input Validation
        const proposedPriceINR = Math.round(Number(body.proposedPriceINR));
        if (isNaN(proposedPriceINR) || proposedPriceINR < 1 || proposedPriceINR > 100_000_000) {
            return NextResponse.json(
                { code: "INVALID_PRICE", message: "Please provide a valid proposed monthly budget between ₹1 and ₹10,00,00,000." },
                { status: 400 }
            );
        }

        const linksNeeded = Math.round(Number(body.linksNeeded)) || 0;
        if (linksNeeded < 1 || linksNeeded > 500_000_000) {
            return NextResponse.json(
                { code: "INVALID_LINKS", message: "Permanent links needed must be between 1 and 50,00,00,000." },
                { status: 400 }
            );
        }

        const apiQuotaNeeded = Math.round(Number(body.apiQuotaNeeded)) || 0;
        if (apiQuotaNeeded < 0 || apiQuotaNeeded > 1_000_000_000) {
            return NextResponse.json(
                { code: "INVALID_QUOTA", message: "Monthly API quota must be between 0 and 1,00,00,00,000." },
                { status: 400 }
            );
        }

        const companyName = typeof body.companyName === "string" 
            ? body.companyName.trim().slice(0, 100) 
            : null;
            
        const notes = typeof body.notes === "string" 
            ? body.notes.trim().slice(0, 1500) 
            : "";

        const now = Date.now();

        // 5. Anti-Spam Duplicate Check in Firestore (prevent rapid identical pending requests)
        try {
            const recentSnap = await adminDb
                .collection("custom_pricing_requests")
                .where("email", "==", rawEmail)
                .where("status", "==", "pending")
                .limit(5)
                .get();

            const isDuplicateRecent = recentSnap.docs.some((doc) => {
                const data = doc.data();
                return data.createdAt && now - data.createdAt < 15 * 60 * 1000; // within 15 minutes
            });

            if (isDuplicateRecent) {
                return NextResponse.json(
                    {
                        code: "PROPOSAL_PENDING",
                        message: "You already have an active proposal submitted within the last 15 minutes. Our team is actively reviewing it and will notify you via email.",
                    },
                    { status: 429 }
                );
            }
        } catch {
            // Non-fatal, continue with insertion if query fails
        }

        const requestData = {
            userId,
            email: rawEmail,
            companyName,
            linksNeeded,
            apiQuotaNeeded,
            proposedPriceINR,
            notes,
            status: "pending", // "pending" | "curated" | "rejected"
            createdAt: now,
            curatedAt: null,
            curatedBy: null,
            curatedPriceINR: null,
            curatedOfferId: null,
            adminNotes: null,
            clientIp: ip,
        };

        const docRef = await adminDb.collection("custom_pricing_requests").add(requestData);

        logger.info("custom_pricing_request_created", `Custom pricing requested by ${rawEmail} for ₹${proposedPriceINR}/mo`, {
            requestId: docRef.id,
            linksNeeded,
            apiQuotaNeeded,
            ip,
        });

        return NextResponse.json({
            success: true,
            message: "Proposal received! Once approved, you will receive an email confirmation and your curated plan will appear directly on the pricing page for 1-click purchase.",
            requestId: docRef.id,
            email: rawEmail,
            proposedPriceINR,
            linksNeeded,
            apiQuotaNeeded,
        });
    } catch (error) {
        logger.error("custom_pricing_request_error", "Failed to process custom pricing request", {
            error: String(error),
        });
        return NextResponse.json(
            { code: "SERVER_ERROR", message: "Failed to submit proposal. Please try again later." },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
        }

        const email = (decoded.email || "").trim().toLowerCase();
        const query = adminDb
            .collection("custom_pricing_requests")
            .where("email", "==", email)
            .orderBy("createdAt", "desc")
            .limit(10);

        try {
            const snap = await query.get();
            const requests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            return NextResponse.json({ requests });
        } catch {
            // Fallback if index not ready
            const fallbackSnap = await adminDb.collection("custom_pricing_requests").limit(50).get();
            const requests = fallbackSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
                .filter((r) => r.email === email)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return NextResponse.json({ requests });
        }
    } catch (error) {
        return NextResponse.json({ code: "FETCH_FAILED", message: "Failed to fetch requests" }, { status: 500 });
    }
}

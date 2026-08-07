import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getAllPartialOffers } from "@/services/partial-offers";

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        let email: string | null = null;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await adminAuth.verifyIdToken(token);
                email = decoded.email || null;
            } catch {
                // Token invalid
            }
        }

        if (!email) {
            email = request.nextUrl.searchParams.get("email");
        }

        if (!email) {
            return NextResponse.json({ offers: [] });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const allOffers = await getAllPartialOffers(normalizedEmail);
        const now = Date.now();

        const activeOffers = allOffers.filter((offer) => {
            if (!offer.isActive) return false;
            if (offer.startsAt && offer.startsAt > now) return false;
            if (offer.expiresAt && offer.expiresAt <= now) return false;
            if (offer.usageLimit !== null && offer.redemptionCount >= offer.usageLimit) return false;
            return true;
        });

        return NextResponse.json({ offers: activeOffers });
    } catch (err) {
        console.error("Failed to fetch user partial offers:", err);
        return NextResponse.json({ offers: [] });
    }
}

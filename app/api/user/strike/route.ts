import { NextRequest, NextResponse } from "next/server";
import { recordAbuseStrike } from "@/lib/auth/ban-check";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
    try {
        let uid = "anonymous";
        let guestId = request.cookies.get("guest_session")?.value;

        const body = await request.json();
        const type = body.type;
        if (body.guestId) {
            guestId = body.guestId; // Client-provided guestSessionId takes precedence
        }

        const authHeader = request.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decodedToken = await adminAuth.verifyIdToken(token);
                uid = decodedToken.uid;
            } catch (e) {
                // Invalid token, fall back to guest if possible, or reject
                console.error("Invalid token on strike endpoint", e);
            }
        }

        if (!guestId) {
            const ip = request.headers.get("x-forwarded-for") || request.ip || "unknown-ip";
            // Simple hash for IP to use as guestId
            guestId = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("")
                .substring(0, 16);
        }

        if (uid === "anonymous" && !guestId) {
            return NextResponse.json({ error: "No trackable identity" }, { status: 400 });
        }

        if (type !== "ADMIN_ACCESS") {
            return NextResponse.json({ error: "Invalid strike type" }, { status: 400 });
        }

        const strikeResult = await recordAbuseStrike(uid, "ADMIN_ACCESS", guestId);

        return NextResponse.json(strikeResult);
    } catch (e) {
        console.error("Failed to record strike:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

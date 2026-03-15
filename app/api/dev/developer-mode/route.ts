import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getDevModeForUser, isDevEnvironment, isDeveloperEmail, setDevModeForUser } from "@/lib/dev-mode";

function notFound() {
    return new NextResponse("Not found", { status: 404 });
}

async function authenticate(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false as const, status: 401, message: "Missing token" };
    }

    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || null;

        if (!isDeveloperEmail(email)) {
            return { ok: false as const, status: 403, message: "Developer access required" };
        }

        return { ok: true as const, uid: decoded.uid, email };
    } catch {
        return { ok: false as const, status: 401, message: "Invalid token" };
    }
}

export async function GET(request: NextRequest) {
    if (!isDevEnvironment()) {
        return notFound();
    }

    const auth = await authenticate(request);
    if (!auth.ok) {
        return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const enabled = await getDevModeForUser(auth.uid);
    return NextResponse.json({ developerModeEnabled: enabled });
}

export async function POST(request: NextRequest) {
    if (!isDevEnvironment()) {
        return notFound();
    }

    const auth = await authenticate(request);
    if (!auth.ok) {
        return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    let desired: boolean | null = null;
    try {
        const body = await request.json().catch(() => null);
        if (body && typeof body.enabled === "boolean") {
            desired = body.enabled;
        }
    } catch {
        // Ignore malformed JSON and fall back to toggle behavior
    }

    const current = await getDevModeForUser(auth.uid);
    const next = desired ?? !current;
    const final = await setDevModeForUser(auth.uid, next);

    return NextResponse.json({ developerModeEnabled: final });
}


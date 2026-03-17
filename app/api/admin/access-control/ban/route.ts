import { NextRequest, NextResponse } from "next/server";
import { verifyOwnerRequest, isSelfBanAttempt } from "@/lib/admin-access";
import { banSubject } from "@/services/access-control";
import type { AccessMode } from "@/types";

export async function POST(request: NextRequest) {
    const owner = await verifyOwnerRequest(request);
    if (!owner.ok) {
        return NextResponse.json({ message: owner.message }, { status: owner.status });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const { subjectType, subjectId, subjectEmail, reason, mode, expiresAt } = body;

    if (!subjectType || !subjectId) {
        return NextResponse.json({ message: "subjectType and subjectId are required" }, { status: 400 });
    }

    if (!["user", "guest"].includes(subjectType)) {
        return NextResponse.json({ message: "subjectType must be 'user' or 'guest'" }, { status: 400 });
    }

    if (subjectType === "user" && (isSelfBanAttempt(subjectEmail) || subjectId === owner.uid)) {
        return NextResponse.json(
            { message: "Nice try 🙂 You're the owner — you can't ban yourself." },
            { status: 403 }
        );
    }

    const validModes: AccessMode[] = ["temporary", "permanent"];
    const resolvedMode: AccessMode = validModes.includes(mode) ? mode : "permanent";

    if (resolvedMode === "temporary" && (!expiresAt || typeof expiresAt !== "number")) {
        return NextResponse.json({ message: "expiresAt is required for temporary bans" }, { status: 400 });
    }

    const result = await banSubject({
        subjectType,
        subjectId,
        reason: reason || null,
        mode: resolvedMode,
        expiresAt: resolvedMode === "temporary" ? expiresAt : null,
        ownerEmail: owner.email,
    });

    if (!result.ok) {
        return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, access: result.access });
}
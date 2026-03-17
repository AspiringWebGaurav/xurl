import { NextRequest, NextResponse } from "next/server";
import { verifyOwnerRequest } from "@/lib/admin-access";
import { unbanSubject } from "@/services/access-control";

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

    const { subjectType, subjectId } = body;

    if (!subjectType || !subjectId) {
        return NextResponse.json({ message: "subjectType and subjectId are required" }, { status: 400 });
    }

    if (!["user", "guest"].includes(subjectType)) {
        return NextResponse.json({ message: "subjectType must be 'user' or 'guest'" }, { status: 400 });
    }

    const result = await unbanSubject({
        subjectType,
        subjectId,
        ownerEmail: owner.email,
    });

    if (!result.ok) {
        return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, access: result.access });
}
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";

export async function verifyAdminRequest(request: NextRequest): Promise<
    | { ok: true; uid: string; email: string | null }
    | { ok: false; status: number; message: string }
> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, status: 401, message: "Missing token" };
    }

    try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || null;

        if (!isAdminEmail(email)) {
            return { ok: false, status: 403, message: "Admin access required" };
        }

        return { ok: true, uid: decoded.uid, email };
    } catch {
        return { ok: false, status: 401, message: "Invalid token" };
    }
}

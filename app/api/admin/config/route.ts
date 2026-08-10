import { NextRequest, NextResponse } from "next/server";
import { getDynamicConfig, saveDynamicConfig } from "@/lib/services/dynamic-config";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import { logAdminAction } from "@/services/admin-logs";

export async function GET(req: NextRequest) {
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

        const config = await getDynamicConfig();
        return NextResponse.json({ config });
    } catch (e) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

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

        const body = await req.json();
        const newConfig = body.config;

        await saveDynamicConfig(newConfig);

        // Audit Logging to central admin_logs
        await logAdminAction(
            decoded.email || "admin",
            "OTHER",
            "Updated dynamic plan and offer configurations"
        );
        
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Config save error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

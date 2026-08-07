import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { PLAN_CONFIGS, resolvePlanType } from "@/lib/plans";

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

        // Verify user plan and CSV export permissions
        const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
        const userPlan = resolvePlanType(userSnap.data()?.plan || "free");
        const planConfig = PLAN_CONFIGS[userPlan];

        if (!planConfig.hasCsvExport) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: "CSV Export requires a Pro, Business, or Enterprise plan." },
                { status: 403 }
            );
        }

        // Fetch user links
        const linksSnap = await adminDb
            .collection("links")
            .where("userId", "==", decoded.uid)
            .orderBy("createdAt", "desc")
            .limit(200)
            .get();

        const rows: string[] = [
            "Short Slug,Original URL,Title,Total Clicks,Is Active,Created At,Expires At"
        ];

        for (const doc of linksSnap.docs) {
            const data = doc.data();
            const slug = `"${(data.slug || "").replace(/"/g, '""')}"`;
            const originalUrl = `"${(data.originalUrl || "").replace(/"/g, '""')}"`;
            const title = `"${(data.title || data.slug || "").replace(/"/g, '""')}"`;
            const totalClicks = data.totalClicks || 0;
            const isActive = data.isActive ? "Yes" : "No";
            const createdAt = data.createdAt ? new Date(data.createdAt).toISOString() : "";
            const expiresAt = data.expiresAt ? new Date(data.expiresAt).toISOString() : "Never";

            rows.push(`${slug},${originalUrl},${title},${totalClicks},${isActive},${createdAt},${expiresAt}`);
        }

        const csvContent = rows.join("\n");
        const filename = `xurl_analytics_${decoded.uid.slice(0, 6)}_${Date.now()}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate CSV export.";
        return NextResponse.json({ code: "EXPORT_FAILED", message }, { status: 500 });
    }
}

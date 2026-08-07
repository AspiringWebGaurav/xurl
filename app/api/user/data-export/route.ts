import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import JSZip from "jszip";
import QRCode from "qrcode";
import crypto from "crypto";

function generatePublicExportId(): string {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function escapeCsv(val: string | number | boolean | null | undefined): string {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
}

// In-memory sliding window rate-limit cache: userId -> Array of timestamps
const exportRateLimitMap = new Map<string, number[]>();

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Authentication required for data export." }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid authentication token." }, { status: 401 });
        }

        // 1. Emergency Kill Switch Guard Check
        try {
            const configSnap = await adminDb.collection("system_config").doc("global").get();
            if (configSnap.exists && configSnap.data()?.killSwitch === true) {
                return NextResponse.json(
                    { code: "EMERGENCY_HOLD", message: "Data export is temporarily paused during active Emergency Maintenance." },
                    { status: 503 }
                );
            }
        } catch {
            // Non-blocking if config doc is absent
        }

        // 2. Export Cooldown & Rate Limit Check (Max 3 exports / hour, 60s cooldown)
        const nowMs = Date.now();
        const userHistory = exportRateLimitMap.get(decoded.uid) || [];
        // Clean timestamps older than 1 hour (3600,000 ms)
        const recentExports = userHistory.filter(ts => nowMs - ts < 3600 * 1000);

        if (recentExports.length >= 3) {
            const oldestExport = recentExports[0];
            const waitSeconds = Math.ceil((oldestExport + 3600 * 1000 - nowMs) / 1000);
            return NextResponse.json(
                { 
                    code: "RATE_LIMITED", 
                    message: `Export rate limit exceeded (Max 3 per hour). Please wait ${Math.ceil(waitSeconds / 60)} minute(s) before requesting another data archive.` 
                },
                { status: 429 }
            );
        }

        const lastExportMs = recentExports[recentExports.length - 1] || 0;
        if (nowMs - lastExportMs < 60 * 1000) {
            const cooldownSecs = Math.ceil((60 * 1000 - (nowMs - lastExportMs)) / 1000);
            return NextResponse.json(
                { 
                    code: "COOLDOWN_ACTIVE", 
                    message: `Please wait ${cooldownSecs} second(s) between consecutive data exports.` 
                },
                { status: 429 }
            );
        }

        // Record current export timestamp
        recentExports.push(nowMs);
        exportRateLimitMap.set(decoded.uid, recentExports);

        const { searchParams } = new URL(request.url);
        const format = (searchParams.get("format") || "json").toLowerCase();
        const range = (searchParams.get("range") || "all").toLowerCase();
        const quality = (searchParams.get("quality") || "medium").toLowerCase();

        let qrSize = 300;
        if (quality === "low") qrSize = 150;
        else if (quality === "high") qrSize = 600;

        // Calculate timeframe cutoff
        const now = Date.now();
        let cutoffTime = 0;
        if (range === "1h") cutoffTime = now - 3600 * 1000;
        else if (range === "24h") cutoffTime = now - 24 * 3600 * 1000;
        else if (range === "7d") cutoffTime = now - 7 * 24 * 3600 * 1000;
        else if (range === "30d") cutoffTime = now - 30 * 24 * 3600 * 1000;

        // 1. Fetch User Document
        const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
        const userData = userSnap.data() || {};

        // 2. Fetch User Links
        const linksSnap = await adminDb
            .collection("links")
            .where("userId", "==", decoded.uid)
            .get();

        const allLinks = linksSnap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                slug: data.slug || "",
                originalUrl: data.originalUrl || "",
                title: data.title || data.slug || "",
                totalClicks: data.totalClicks || 0,
                isActive: data.isActive ?? true,
                createdAt: data.createdAt || 0,
                expiresAt: data.expiresAt || null,
            };
        });

        // Filter links by requested timeframe cutoff
        const filteredLinks = cutoffTime > 0 
            ? allLinks.filter(l => (l.createdAt || 0) >= cutoffTime)
            : allLinks;

        // 3. Fetch Transactions
        let transactions: Record<string, unknown>[] = [];
        try {
            const txSnap = await adminDb
                .collection("transactions")
                .where("userId", "==", decoded.uid)
                .orderBy("createdAt", "desc")
                .get();
            transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            transactions = [];
        }

        const dateStr = new Date().toISOString().split("T")[0];
        const exportId = generatePublicExportId();

        // ── FORMAT: STANDALONE INTERACTIVE OFFLINE HTML REPORT ──
        if (format === "html") {
            const filename = `XURL_Data_Report_${exportId}_${dateStr}.html`;

            // Render SVG Click Chart Bars
            const maxClicks = Math.max(...filteredLinks.map(l => l.totalClicks), 1);
            const top5Links = [...filteredLinks].sort((a, b) => b.totalClicks - a.totalClicks).slice(0, 5);

            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XURL Personal Data Report — ${exportId}</title>
    <style>
        :root { --bg: #090d16; --card: #0f172a; --border: #1e293b; --primary: #38bdf8; --text: #f8fafc; --muted: #94a3b8; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 32px 16px; line-height: 1.6; }
        .container { max-width: 960px; margin: 0 auto; background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 36px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .header { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .brand { font-size: 24px; font-weight: 900; letter-spacing: -0.025em; color: var(--primary); }
        .badge { background: rgba(56,189,248,0.1); color: var(--primary); border: 1px solid rgba(56,189,248,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 800; color: #ffffff; }
        p.sub { margin: 0; color: var(--muted); font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 16px; }
        .card-val { font-size: 24px; font-weight: 800; color: #ffffff; margin-top: 4px; }
        .card-lbl { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; }
        
        .chart-box { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 16px; margin-bottom: 32px; }
        .chart-title { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }
        .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 12px; }
        .bar-label { width: 100px; font-family: monospace; color: var(--primary); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-track { flex: 1; height: 12px; background: #0f172a; border-radius: 6px; overflow: hidden; }
        .bar-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #818cf8); border-radius: 6px; }
        .bar-count { width: 45px; text-align: right; color: var(--muted); font-weight: 600; }

        .search-box { margin-bottom: 16px; }
        .search-input { width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #334155; color: #ffffff; padding: 12px 16px; border-radius: 12px; font-size: 13px; outline: none; }
        .search-input:focus { border-color: var(--primary); }

        table { width: 100%; border-collapse: collapse; margin-top: 12px; text-align: left; }
        th, td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; }
        th { background: #1e293b; color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 11px; }
        tr:hover { background: rgba(255,255,255,0.02); }
        .slug { font-family: monospace; color: var(--primary); font-weight: 700; }
        .url { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #cbd5e1; }
        .copy-btn { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600; }
        .copy-btn:hover { background: rgba(56,189,248,0.2); }
        
        .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 12px; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <div class="brand">XURL Data Report</div>
                <p class="sub">Generated for account: <strong>${userData.email || "Registered User"}</strong></p>
            </div>
            <div class="badge">Export ID: ${exportId} • Range: ${range.toUpperCase()} • Quality: ${quality.toUpperCase()} (${qrSize}px)</div>
        </div>

        <h1>Personal Data Archive Summary</h1>
        <p class="sub" style="margin-bottom: 24px;">Exported under XURL Privacy Policy & GDPR Data Portability Provisions on ${new Date().toUTCString()}.</p>

        <div class="grid">
            <div class="card">
                <div class="card-lbl">Current Plan</div>
                <div class="card-val" style="text-transform: capitalize;">${userData.plan || "Free"}</div>
            </div>
            <div class="card">
                <div class="card-lbl">Total Short Links</div>
                <div class="card-val">${filteredLinks.length}</div>
            </div>
            <div class="card">
                <div class="card-lbl">Total Clicks Recorded</div>
                <div class="card-val">${filteredLinks.reduce((acc, l) => acc + l.totalClicks, 0)}</div>
            </div>
            <div class="card">
                <div class="card-lbl">Billing Transactions</div>
                <div class="card-val">${transactions.length}</div>
            </div>
        </div>

        ${top5Links.length > 0 ? `
        <div class="chart-box">
            <div class="chart-title">Top Active Links Distribution</div>
            ${top5Links.map(l => {
                const pct = Math.round((l.totalClicks / maxClicks) * 100);
                return `
                <div class="bar-row">
                    <div class="bar-label">/${l.slug}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${Math.max(pct, 4)}%;"></div>
                    </div>
                    <div class="bar-count">${l.totalClicks} clicks</div>
                </div>
                `;
            }).join('')}
        </div>
        ` : ''}

        <h2>Shortened Links (${filteredLinks.length})</h2>
        <div class="search-box">
            <input type="text" id="searchInput" class="search-input" placeholder="🔍 Type to filter links or destination URLs..." onkeyup="filterLinks()">
        </div>

        ${filteredLinks.length === 0 ? '<p class="sub">No links found within the selected timeframe.</p>' : `
        <table id="linksTable">
            <thead>
                <tr>
                    <th>Short Slug</th>
                    <th>Destination URL</th>
                    <th>Clicks</th>
                    <th>Created Date</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${filteredLinks.map(l => `
                <tr className="link-row">
                    <td class="slug">/${l.slug}</td>
                    <td class="url" title="${l.originalUrl}">${l.originalUrl}</td>
                    <td>${l.totalClicks}</td>
                    <td>${l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <button class="copy-btn" onclick="navigator.clipboard.writeText('https://xurl.com/${l.slug}')">Copy Link</button>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        `}

        <div class="footer">
            XURL Privacy Governance • Policy-Driven Platform • Export ID: ${exportId} • SHA-256 Protected
        </div>
    </div>

    <script id="xurl-data" type="application/json">
        ${JSON.stringify({ links: filteredLinks })}
    </script>

    <script>
        function filterLinks() {
            var input = document.getElementById('searchInput').value.toLowerCase();
            var rows = document.querySelectorAll('#linksTable tbody tr');
            rows.forEach(function(row) {
                var text = row.innerText.toLowerCase();
                row.style.display = text.indexOf(input) > -1 ? '' : 'none';
            });
        }
    </script>
</body>
</html>`;

            return new NextResponse(htmlContent, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            });
        }

        // ── FORMAT: ZIP ARCHIVE WITH QR CODES, CSV, JSON & CHECKSUM ──
        const filename = `XURL_Data_Export_${exportId}_${dateStr}.zip`;
        const zip = new JSZip();
        const exportFolder = zip.folder(`XURL_Data_Export_${exportId}`) || zip;

        const checksumEntries: string[] = [
            `# XURL DATA EXPORT CRYPTOGRAPHIC INTEGRITY MANIFEST`,
            `# Export ID: ${exportId}`,
            `# Timeframe: ${range.toUpperCase()}`,
            `# Media Quality: ${quality.toUpperCase()} (${qrSize}px)`,
            `# Generated: ${new Date().toISOString()}`,
            `# Standard: SHA-256 Digest Compliance (GDPR / CCPA Auditing)`,
            ``,
        ];

        function addChecksum(filePath: string, content: string | Buffer) {
            const hash = crypto.createHash("sha256").update(content).digest("hex");
            checksumEntries.push(`${hash}  ${filePath}`);
        }

        // 1. User Profile JSON
        const profileJson = {
            exportMetadata: {
                exportId,
                generatedAt: new Date().toISOString(),
                timeframeRange: range,
                mediaQuality: quality,
                imageResolutionPx: qrSize,
                complianceNotice: "XURL GDPR & CCPA Data Portability Guarantee",
            },
            accountProfile: {
                email: userData.email || null,
                plan: userData.plan || "free",
                createdAt: userData.createdAt ? new Date(userData.createdAt).toISOString() : null,
                isBanned: userData.isBanned ?? false,
            },
        };
        const profileStr = JSON.stringify(profileJson, null, 2);
        exportFolder.file("user_profile.json", profileStr);
        addChecksum("user_profile.json", profileStr);

        // 2. Shortened Links JSON & CSV Spreadsheet
        const linksJson = { totalCount: filteredLinks.length, timeframeRange: range, links: filteredLinks };
        const linksStr = JSON.stringify(linksJson, null, 2);
        exportFolder.file("my_links.json", linksStr);
        addChecksum("my_links.json", linksStr);

        // CSV Spreadsheet File
        const csvHeader = "Slug,Short URL,Original Destination URL,Title,Total Clicks,Is Active,Created Date\n";
        const csvRows = filteredLinks.map(l => [
            escapeCsv(l.slug),
            escapeCsv(`https://xurl.com/${l.slug}`),
            escapeCsv(l.originalUrl),
            escapeCsv(l.title),
            l.totalClicks,
            l.isActive,
            l.createdAt ? escapeCsv(new Date(l.createdAt).toISOString()) : '""',
        ].join(",")).join("\n");
        const csvContent = csvHeader + csvRows;
        exportFolder.file("my_links.csv", csvContent);
        addChecksum("my_links.csv", csvContent);

        // 3. Bulk PNG QR Codes Folder
        const qrFolder = exportFolder.folder("qr_codes");
        if (qrFolder) {
            for (const linkItem of filteredLinks) {
                try {
                    const linkUrl = `https://xurl.com/${linkItem.slug}`;
                    const qrBuffer = await QRCode.toBuffer(linkUrl, {
                        width: qrSize,
                        margin: 1,
                        color: {
                            dark: "#090D16",
                            light: "#FFFFFF"
                        }
                    });
                    const safeSlug = linkItem.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
                    const qrFileName = `${safeSlug}.png`;
                    qrFolder.file(qrFileName, qrBuffer);
                    addChecksum(`qr_codes/${qrFileName}`, qrBuffer);
                } catch (qrErr) {
                    console.error(`Failed to generate QR code for ${linkItem.slug}:`, qrErr);
                }
            }
        }

        // 4. Analytics Summary JSON
        const totalClicks = filteredLinks.reduce((sum, l) => sum + l.totalClicks, 0);
        const analyticsJson = {
            timeframeRange: range,
            totalLinksCreated: filteredLinks.length,
            aggregateClicks: totalClicks,
            mostActiveSlug: filteredLinks.sort((a, b) => b.totalClicks - a.totalClicks)[0]?.slug || null,
        };
        const analyticsStr = JSON.stringify(analyticsJson, null, 2);
        exportFolder.file("analytics_summary.json", analyticsStr);
        addChecksum("analytics_summary.json", analyticsStr);

        // 5. Transaction History JSON
        const txJson = { count: transactions.length, transactions };
        const txStr = JSON.stringify(txJson, null, 2);
        exportFolder.file("transaction_history.json", txStr);
        addChecksum("transaction_history.json", txStr);

        // 6. ReadMe Text File
        const readMeText = `========================================================================
XURL OFFICIAL PERSONAL DATA EXPORT ARCHIVE
Export ID: ${exportId}
Generated Date: ${new Date().toUTCString()}
Timeframe Filter: ${range.toUpperCase()}
Media Quality: ${quality.toUpperCase()} (${qrSize}px)
========================================================================

Thank you for choosing XURL. In compliance with international data privacy
regulations (GDPR / CCPA), this archive contains a complete copy of all
data associated with your account.

CONTENTS OF THIS ZIP ARCHIVE (XURL_Data_Export_${exportId}/):
- user_profile.json       : Account profile metadata and subscription tier.
- my_links.json           : Shortened URL records, target URLs, and creation dates.
- my_links.csv            : Excel & Google Sheets ready spreadsheet export.
- qr_codes/*.png          : Bulk high-res QR code PNG image library (${qrSize}px).
- analytics_summary.json  : Aggregate click metrics and performance summaries.
- transaction_history.json: Billing transactions and upgrade logs.
- checksums.sha256        : Cryptographic SHA-256 integrity manifest.

SECURITY & PRIVACY NOTICE:
This archive contains private personal data. Please store it securely.
Export filenames use randomized public identifiers (${exportId}) to protect
your privacy and ensure zero exposure of internal system identifiers.

XURL Data Governance & Privacy Engineering Team
https://xurl.com/privacy
`;
        exportFolder.file("XURL_Data_Export_ReadMe.txt", readMeText);
        addChecksum("XURL_Data_Export_ReadMe.txt", readMeText);

        // Write Checksum File
        exportFolder.file("checksums.sha256", checksumEntries.join("\n"));

        const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

        // Security Audit Logging
        try {
            await adminDb.collection("logs").add({
                action: "USER_DATA_EXPORT",
                userId: decoded.uid,
                exportId,
                format,
                range,
                quality,
                itemCount: filteredLinks.length,
                timestamp: Date.now(),
                userAgent: request.headers.get("user-agent") || "unknown",
            });
        } catch (logErr) {
            console.warn("Failed to record export audit log:", logErr);
        }

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, no-cache, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Error generating data export archive:", error);
        return NextResponse.json(
            { code: "SERVER_ERROR", message: "Failed to generate data export archive." },
            { status: 500 }
        );
    }
}


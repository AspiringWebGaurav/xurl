/**
 * Analytics Dashboard API
 *
 * GET /api/analytics/dashboard — Returns aggregated analytics for the authenticated user.
 *
 * Calls existing getDashboardSummary() and getLinkAnalytics() from services/analytics.ts.
 * No new database schemas or collections required.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getDashboardSummary, getLinkAnalytics } from "@/services/analytics";
import { resolvePlanType } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { logger } from "@/lib/utils/logger";
import type { AnalyticsDocument } from "@/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        // ── Auth verification ──
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { code: "UNAUTHORIZED", message: "Authentication required." },
                { status: 401 }
            );
        }

        let uid: string;
        try {
            const token = authHeader.split("Bearer ")[1];
            const decoded = await adminAuth.verifyIdToken(token);
            uid = decoded.uid;
        } catch {
            return NextResponse.json(
                { code: "UNAUTHORIZED", message: "Invalid token." },
                { status: 401 }
            );
        }

        // ── Fetch user plan ──
        const userDoc = await adminDb.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        let plan: PlanType = resolvePlanType(userData?.plan);

        // Live downgrade: if paid plan has expired, treat as free
        const now = Date.now();
        if (plan !== "free" && userData?.planExpiry && userData.planExpiry < now) {
            plan = "free";
        }

        // Free/guest users still get a response (frontend handles gating)
        // but we skip the expensive analytics queries
        if (plan === "free" || plan === "guest") {
            return NextResponse.json({
                plan,
                summary: { totalClicks: 0, activeLinks: 0, topLinks: [] },
                timeline: [],
                referrers: {},
                countries: {},
                devices: {},
                browsers: {},
            });
        }

        // ── Dashboard summary (uses existing service function) ──
        const summary = await getDashboardSummary(uid);

        // ── Per-link analytics for top links (parallel fetch) ──
        const slugsToFetch = summary.topLinks.slice(0, 10).map((l) => l.slug);
        const perLinkAnalytics = await Promise.all(
            slugsToFetch.map((slug) => getLinkAnalytics(slug, 30))
        );

        // ── Aggregate into timeline and breakdowns ──
        const timelineMap = new Map<string, { clicks: number; uniqueVisitors: number }>();
        const referrers: Record<string, number> = {};
        const countries: Record<string, number> = {};
        const devices: Record<string, number> = {};
        const browsers: Record<string, number> = {};

        for (const linkDocs of perLinkAnalytics) {
            for (const doc of linkDocs) {
                // Timeline aggregation
                const existing = timelineMap.get(doc.date);
                if (existing) {
                    existing.clicks += doc.clicks || 0;
                    existing.uniqueVisitors += doc.uniqueVisitors || 0;
                } else {
                    timelineMap.set(doc.date, {
                        clicks: doc.clicks || 0,
                        uniqueVisitors: doc.uniqueVisitors || 0,
                    });
                }

                // Breakdown aggregation (handle sparse Firestore data)
                mergeRecord(referrers, (doc as AnalyticsDocument).referrers);
                mergeRecord(countries, (doc as AnalyticsDocument).countries);
                mergeRecord(devices, (doc as AnalyticsDocument).devices);
                mergeRecord(browsers, (doc as AnalyticsDocument).browsers);
            }
        }

        // Fill timeline to full 30 days with zero entries for missing dates
        const timeline = buildFullTimeline(timelineMap, 30);

        return NextResponse.json({
            plan,
            summary,
            timeline,
            referrers,
            countries,
            devices,
            browsers,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch analytics.";
        logger.error("api_analytics_dashboard", message);
        return NextResponse.json(
            { code: "ANALYTICS_FAILED", message },
            { status: 500 }
        );
    }
}

// ── Helpers ──

function mergeRecord(target: Record<string, number>, source: Record<string, number> | undefined) {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
        if (typeof value === "number") {
            target[key] = (target[key] || 0) + value;
        }
    }
}

function buildFullTimeline(
    dataMap: Map<string, { clicks: number; uniqueVisitors: number }>,
    days: number
): Array<{ date: string; clicks: number; uniqueVisitors: number }> {
    const result: Array<{ date: string; clicks: number; uniqueVisitors: number }> = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const existing = dataMap.get(dateStr);
        result.push({
            date: dateStr,
            clicks: existing?.clicks || 0,
            uniqueVisitors: existing?.uniqueVisitors || 0,
        });
    }

    return result;
}

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
import { resolvePlanType, PLAN_CONFIGS } from "@/lib/plans";
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
                os: {},
            });
        }

        const retentionDays = PLAN_CONFIGS[plan]?.analyticsRetentionDays || 30;

        // ── Dashboard summary (uses existing service function) ──
        const summary = await getDashboardSummary(uid);

        // ── Per-link analytics for top links (parallel fetch) ──
        const slugsToFetch = summary.topLinks.slice(0, 10).map((l) => l.slug);
        const perLinkAnalytics = await Promise.all(
            slugsToFetch.map((slug) => getLinkAnalytics(slug, retentionDays))
        );

        // ── Aggregate into timeline and breakdowns ──
        const timelineMap = new Map<string, { clicks: number; uniqueVisitors: number }>();
        const referrers: Record<string, number> = {};
        const countries: Record<string, number> = {};
        const devices: Record<string, number> = {};
        const browsers: Record<string, number> = {};
        const os: Record<string, number> = {};
        const sources: Record<string, number> = {};
        const utms = { sources: {} as Record<string, number>, campaigns: {} as Record<string, number> };
        let totalBots = 0;
        let totalHumans = 0;

        for (const linkDocs of perLinkAnalytics) {
            for (const doc of linkDocs) {
                const analyticsDoc = doc as AnalyticsDocument;
                // Timeline aggregation
                const existing = timelineMap.get(analyticsDoc.date);
                if (existing) {
                    existing.clicks += analyticsDoc.clicks || 0;
                    existing.uniqueVisitors += analyticsDoc.uniqueVisitors || 0;
                } else {
                    timelineMap.set(analyticsDoc.date, {
                        clicks: analyticsDoc.clicks || 0,
                        uniqueVisitors: analyticsDoc.uniqueVisitors || 0,
                    });
                }

                totalBots += analyticsDoc.bots || 0;
                totalHumans += analyticsDoc.humans || 0;

                // Breakdown aggregation (handle sparse Firestore data)
                mergeRecord(referrers, analyticsDoc.referrers);
                mergeRecord(countries, analyticsDoc.countries);
                mergeRecord(devices, analyticsDoc.devices);
                mergeRecord(browsers, analyticsDoc.browsers);
                mergeRecord(os, analyticsDoc.os);
                mergeRecord(sources, analyticsDoc.sources);
                if (analyticsDoc.utms) {
                    mergeRecord(utms.sources, analyticsDoc.utms.sources);
                    mergeRecord(utms.campaigns, analyticsDoc.utms.campaigns);
                }
            }
        }

        // Fill timeline to full retention window with zero entries for missing dates
        const timeline = buildFullTimeline(timelineMap, retentionDays);

        return NextResponse.json({
            plan,
            summary,
            timeline,
            referrers,
            countries,
            devices,
            browsers,
            os,
            bots: totalBots,
            humans: totalHumans,
            sources,
            utms,
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

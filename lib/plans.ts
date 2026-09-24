/**
 * Central Plan Configuration — Single Source of Truth
 *
 * ALL backend logic MUST reference this module instead of hardcoded values.
 * This file defines:
 *  - Every plan tier and its properties (limit, TTL, price, features)
 *  - Guest configuration
 *  - Legacy plan name mappings
 *  - Helper functions for plan resolution
 */

// ─── Plan Types ─────────────────────────────────────────────────────────────

export type PlanType = "free" | "starter" | "pro" | "business" | "enterprise" | "bigenterprise" | "guest" | "vip";

/**
 * Legacy plan names that may exist in Firestore from older versions.
 * Maps old name → current canonical name.
 */
export const LEGACY_PLAN_MAP: Record<string, PlanType> = {
    freebie: "free",
};

// ─── Plan Config Shape ──────────────────────────────────────────────────────

export interface PlanConfig {
    /** Maximum active links allowed per plan era */
    limit: number;
    /** Link time-to-live in milliseconds */
    ttlMs: number;
    /** Price in INR (0 for free tiers) */
    priceINR: number;
    /** Whether custom slug aliases are allowed */
    slugAllowed: boolean;
    /** Human-readable label */
    label: string;
    /** Optional badge text (e.g. "MOST_POPULAR") */
    badge?: string;
    /** For the free plan: max total uses before permanent block */
    maxUses?: number;
    /** For the free plan: cooldown between uses in milliseconds */
    cooldownMs?: number;
    /** Whether developer API access is enabled for the plan */
    apiAccess?: boolean;
    /** Total API requests included with the active plan purchase */
    apiQuotaTotal?: number;
    /** Analytics retention window in days */
    analyticsRetentionDays?: number;
    /** Whether UTM campaign tracking is enabled */
    hasUtmAnalytics?: boolean;
    /** Whether Bot vs Human traffic detection is enabled */
    hasBotDetection?: boolean;
    /** Whether CSV export is enabled */
    hasCsvExport?: boolean;
}

// ─── Central Plan Configuration ─────────────────────────────────────────────

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
    free: {
        limit: 5,
        ttlMs: 0,                                 // Permanent
        priceINR: 0,
        slugAllowed: true,
        label: "Free",
        maxUses: 5,
        apiAccess: true,                          // Sandbox access
        apiQuotaTotal: 50,
        analyticsRetentionDays: 7,
        hasUtmAnalytics: false,
        hasBotDetection: false,
        hasCsvExport: false,
    },
    starter: {
        limit: 25,
        ttlMs: 0,                                 // Permanent
        priceINR: 29,
        slugAllowed: true,
        label: "Starter",
        apiAccess: true,
        apiQuotaTotal: 2500,
        analyticsRetentionDays: 30,
        hasUtmAnalytics: false,
        hasBotDetection: false,
        hasCsvExport: false,
    },
    pro: {
        limit: 100,
        ttlMs: 0,                                 // Permanent
        priceINR: 79,
        slugAllowed: true,
        label: "Pro",
        apiAccess: true,
        apiQuotaTotal: 15000,
        analyticsRetentionDays: 90,
        hasUtmAnalytics: false,
        hasBotDetection: false,
        hasCsvExport: true,
    },
    business: {
        limit: 500,
        ttlMs: 0,                                 // Permanent
        priceINR: 149,
        slugAllowed: true,
        label: "Business",
        badge: "MOST_POPULAR",
        apiAccess: true,
        apiQuotaTotal: 60000,
        analyticsRetentionDays: 180,
        hasUtmAnalytics: true,
        hasBotDetection: true,
        hasCsvExport: true,
    },
    enterprise: {
        limit: 2500,
        ttlMs: 0,                                 // Permanent
        priceINR: 299,
        slugAllowed: true,
        label: "Enterprise",
        apiAccess: true,
        apiQuotaTotal: 300000,
        analyticsRetentionDays: 365,
        hasUtmAnalytics: true,
        hasBotDetection: true,
        hasCsvExport: true,
    },
    bigenterprise: {
        limit: 10000,
        ttlMs: 0,                                 // Permanent
        priceINR: 699,
        slugAllowed: true,
        label: "Big Enterprise",
        apiAccess: true,
        apiQuotaTotal: 1000000,
        analyticsRetentionDays: 365,
        hasUtmAnalytics: true,
        hasBotDetection: true,
        hasCsvExport: true,
    },
    guest: {
        limit: 1,
        ttlMs: 0,                                 // Permanent
        priceINR: 0,
        slugAllowed: false,
        label: "Guest",
        apiAccess: false,
        apiQuotaTotal: 0,
        analyticsRetentionDays: 7,
        hasUtmAnalytics: false,
        hasBotDetection: false,
        hasCsvExport: false,
    },
    vip: {
        limit: 50000,
        ttlMs: 0,                                 // Permanent
        priceINR: 1,
        slugAllowed: true,
        label: "VIP Curated Plan",
        badge: "VIP_APPROVED",
        apiAccess: true,
        apiQuotaTotal: 2000000,
        analyticsRetentionDays: 365,
        hasUtmAnalytics: true,
        hasBotDetection: true,
        hasCsvExport: true,
    }
};

// ─── Guest Configuration ────────────────────────────────────────────────────

export const GUEST_CONFIG = {
    /** Max links a guest (unauthenticated) user can create */
    limit: 1,
    /** Guest link TTL in milliseconds (0 = permanent) */
    ttlMs: 0,
    /** Human-readable label */
    label: "Guest",
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolves a plan name (potentially legacy) to a canonical PlanType.
 * Returns "free" if the plan name is unrecognized.
 */
export function resolvePlanType(raw: string | undefined | null): PlanType {
    if (!raw) return "free";
    const lower = raw.toLowerCase();
    if (lower in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[lower];
    if (lower in PLAN_CONFIGS) return lower as PlanType;
    return "free";
}

/**
 * Get the plan config for a given plan type, with legacy resolution.
 */
export function getPlanConfig(planType: string | undefined | null): PlanConfig {
    return PLAN_CONFIGS[resolvePlanType(planType)];
}

/**
 * Get pricing in paise (smallest INR unit) for Razorpay orders.
 */
export function getPricePaise(planType: PlanType): number {
    return PLAN_CONFIGS[planType].priceINR * 100;
}

/**
 * Check if a plan is a paid plan (price > 0).
 */
export function isPaidPlan(planType: PlanType): boolean {
    return PLAN_CONFIGS[planType].priceINR > 0;
}

/**
 * Ordered list of paid plan types for UI displays.
 */
export const PAID_PLAN_ORDER: PlanType[] = ["starter", "pro", "business", "enterprise", "bigenterprise"];

/**
 * All plan types in display order.
 */
export const ALL_PLAN_ORDER: PlanType[] = ["free", ...PAID_PLAN_ORDER];

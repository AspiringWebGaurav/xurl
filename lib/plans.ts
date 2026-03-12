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

export type PlanType = "free" | "starter" | "pro" | "business" | "enterprise" | "bigenterprise" | "guest";

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
}

// ─── Central Plan Configuration ─────────────────────────────────────────────

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
    free: {
        limit: 1,
        ttlMs: 10 * 60 * 1000,                   // 10 minutes
        priceINR: 0,
        slugAllowed: false,
        label: "Free",
        maxUses: 3,
        cooldownMs: 24 * 60 * 60 * 1000,          // 24 hours
    },
    starter: {
        limit: 5,
        ttlMs: 2 * 60 * 60 * 1000,                // 2 hours
        priceINR: 49,
        slugAllowed: true,
        label: "Starter",
    },
    pro: {
        limit: 25,
        ttlMs: 6 * 60 * 60 * 1000,                // 6 hours
        priceINR: 99,
        slugAllowed: true,
        label: "Pro",
    },
    business: {
        limit: 100,
        ttlMs: 12 * 60 * 60 * 1000,               // 12 hours
        priceINR: 199,
        slugAllowed: true,
        label: "Business",
        badge: "MOST_POPULAR",
    },
    enterprise: {
        limit: 300,
        ttlMs: 24 * 60 * 60 * 1000,               // 24 hours
        priceINR: 299,
        slugAllowed: true,
        label: "Enterprise",
    },
    bigenterprise: {
        limit: 600,
        ttlMs: 24 * 60 * 60 * 1000,               // 24 hours
        priceINR: 999,
        slugAllowed: true,
        label: "Big Enterprise",
    },
    guest: {
        limit: 1,
        ttlMs: 5 * 60 * 1000,                     // 5 minutes
        priceINR: 0,
        slugAllowed: false,
        label: "Guest",
    }
};

// ─── Guest Configuration ────────────────────────────────────────────────────

export const GUEST_CONFIG = {
    /** Max links a guest (unauthenticated) user can create */
    limit: 1,
    /** Guest link TTL in milliseconds (5 minutes) */
    ttlMs: 5 * 60 * 1000,
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

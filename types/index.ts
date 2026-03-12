// ─── Firestore Document Types ───────────────────────────────────────────────

/**
 * User profile document.
 * Collection: `users`
 * Document ID: Firebase Auth UID
 */
export type { PlanType } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";

export interface UserDocument {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    createdAt: number;
    updatedAt: number;
    plan: PlanType;
    planStatus: "active" | "past_due" | "canceled";
    planStart: number | null;
    planExpiry: number | null;
    planRenewals: number;      // How many times the current plan has been purchased (1 = first purchase)
    planEraStart: number | null; // Timestamp when the current plan era began (used to scope quota)
    activeLinks: number;
    cumulativeQuota?: number;
    linksCreated: number;
    /** Free plan: total link creations used (max 3 lifetime) */
    free_usage_count?: number;
    /** Free plan: timestamp of last link creation (for 24h cooldown) */
    free_last_used_at?: number | null;
    settings: UserSettings;
}

export interface UserSettings {
    defaultDomain: string;
    timezone: string;
}

/**
 * Payment Order document for idempotency and tracking.
 * Collection: `orders`
 * Document ID: Razorpay order_id
 */
export interface OrderDocument {
    orderId: string;
    userId: string;
    planId: PlanType;
    amount: number;
    currency: string;
    status: "created" | "paid" | "consumed" | "failed";
    createdAt: number;
    updatedAt: number;
}

/**
 * Link document — the slug IS the document ID for O(1) lookup.
 * Collection: `links`
 * Document ID: slug (e.g. "cb", "dev", "github")
 */
export interface LinkDocument {
    slug: string;
    originalUrl: string;
    userId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    expiresAt: number | null;
    isActive: boolean;
    password: string | null;
    tags: string[];
    createdUnderPlan: PlanType;     // Which plan the link was created under
    planEraStart: number | null;   // The user's planEraStart at time of link creation
    // Aggregated counters — no per-click documents needed for totals
    totalClicks: number;
    /** Native Firestore TTL deletion timestamp - set to 7 days after expiresAt */
    deleteAt?: number | null;
}

/**
 * Analytics rollup document — one per link per day.
 * Collection: `analytics`
 * Document ID: `{slug}_{YYYY-MM-DD}`
 */
export interface AnalyticsDocument {
    slug: string;
    date: string; // YYYY-MM-DD
    clicks: number;
    uniqueVisitors: number;
    referrers: Record<string, number>;
    countries: Record<string, number>;
    devices: Record<string, number>;
    browsers: Record<string, number>;
}

/**
 * Global counter document for atomic slug ID generation.
 * Collection: `system`
 * Document ID: `counter`
 */
export interface CounterDocument {
    currentId: number;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export interface CreateLinkInput {
    originalUrl: string;
    customSlug?: string;
    title?: string;
    expiresAt?: number | null;
    password?: string | null;
    tags?: string[];
    idempotencyKey?: string;
}

export interface CreateLinkResponse {
    slug: string;
    shortUrl: string;
    originalUrl: string;
    createdAt: number;
}

export interface RedirectResult {
    originalUrl: string;
    slug: string;
    source: "edge" | "memory" | "firestore";
}

export interface ApiError {
    code: string;
    message: string;
    status: number;
}

// ─── Cache Types ────────────────────────────────────────────────────────────

export interface CacheEntry {
    originalUrl: string;
    isActive: boolean;
    expiresAt: number | null;
    cachedAt: number;
    ttl: number;           // milliseconds
    hitCount: number;       // for adaptive TTL
}



// ─── Firestore Document Types ───────────────────────────────────────────────

/**
 * User profile document.
 * Collection: `users`
 * Document ID: Firebase Auth UID
 */
export interface UserDocument {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    createdAt: number;
    updatedAt: number;
    plan: "free" | "pro" | "enterprise";
    linksCreated: number;
    settings: UserSettings;
}

export interface UserSettings {
    defaultDomain: string;
    timezone: string;
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
    // Aggregated counters — no per-click documents needed for totals
    totalClicks: number;
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

import { adminDb } from "../firebase/admin";
import { z } from "zod";
import { PLAN_CONFIGS, PlanType } from "../plans";
import { getDynamicConfigCache, setDynamicConfigCache, invalidateDynamicConfigCache } from "../redis/config-cache";
import { logger } from "../utils/logger";

const OfferTypeSchema = z.enum(["percentage", "flat"]);

export const GlobalOfferSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    type: OfferTypeSchema,
    value: z.number().min(0),
    isActive: z.boolean(),
    expiresAt: z.number().nullable(),
});

export type GlobalOffer = z.infer<typeof GlobalOfferSchema>;

export const PlanOverrideSchema = z.object({
    priceINR: z.number().min(0).optional(),
    limit: z.number().min(1).optional(),
    ttlMs: z.number().min(60000).optional(),
});

export type PlanOverride = z.infer<typeof PlanOverrideSchema>;

export const DynamicConfigSchema = z.object({
    plans: z.record(z.string(), PlanOverrideSchema).default({}),
    offers: z.array(GlobalOfferSchema).default([]),
});

export type DynamicConfig = z.infer<typeof DynamicConfigSchema>;

export interface ComputedPlanConfig {
    limit: number;
    ttlMs: number;
    priceINR: number;
    slugAllowed: boolean;
    label: string;
    badge?: string;
    maxUses?: number;
    cooldownMs?: number;
    apiAccess?: boolean;
    apiQuotaTotal?: number;
}

/**
 * Fetches dynamic config from Redis (fast) or Firestore (slow).
 * Returns strict safe defaults if anything fails or is missing.
 */
export async function getDynamicConfig(): Promise<DynamicConfig> {
    try {
        // 1. Try Cache
        const cached = await getDynamicConfigCache();
        if (cached) {
            try {
                const parsed = DynamicConfigSchema.parse(JSON.parse(cached));
                return parsed;
            } catch (e) {
                logger.error("dynamic_config", "Cache contains invalid Zod schema, falling back to DB.");
            }
        }

        // 2. Try Firestore
        const configDoc = await adminDb.collection("system").doc("dynamic_config").get();
        if (!configDoc.exists) {
            // DB is wiped or uninitialized. Return defaults.
            const defaults = DynamicConfigSchema.parse({});
            // Don't save to Redis yet, let admin save it.
            return defaults;
        }

        // 3. Validate Firestore data
        const parsed = DynamicConfigSchema.parse(configDoc.data());
        
        // 4. Update Cache
        await setDynamicConfigCache(JSON.stringify(parsed));
        return parsed;
    } catch (error) {
        logger.error("dynamic_config", "Failed to fetch dynamic config, returning safe defaults.", { error: String(error) });
        return DynamicConfigSchema.parse({});
    }
}

/**
 * Saves dynamic config to Firestore and invalidates Cache.
 */
export async function saveDynamicConfig(config: DynamicConfig): Promise<void> {
    // Validate before saving
    const parsed = DynamicConfigSchema.parse(config);
    
    await adminDb.collection("system").doc("dynamic_config").set(parsed);
    await invalidateDynamicConfigCache();
}

/**
 * Gets a single plan config by merging defaults with overrides.
 */
export async function getComputedPlanConfig(planType: PlanType): Promise<ComputedPlanConfig> {
    const config = await getDynamicConfig();
    const defaults = PLAN_CONFIGS[planType];
    const overrides = config.plans[planType] || {};

    return {
        ...defaults,
        ...overrides,
        // Ensure price is safely numeric
        priceINR: overrides.priceINR !== undefined ? overrides.priceINR : defaults.priceINR,
        limit: overrides.limit !== undefined ? overrides.limit : defaults.limit,
        ttlMs: overrides.ttlMs !== undefined ? overrides.ttlMs : defaults.ttlMs,
    };
}

/**
 * Gets all active global offers.
 */
export async function getActiveOffers(): Promise<GlobalOffer[]> {
    const config = await getDynamicConfig();
    const now = Date.now();
    
    return config.offers.filter(offer => 
        offer.isActive && 
        (!offer.expiresAt || offer.expiresAt > now)
    );
}

/**
 * Gets the best applicable active offer.
 */
export async function getBestActiveOffer(basePrice: number): Promise<GlobalOffer | null> {
    const offers = await getActiveOffers();
    if (offers.length === 0) return null;

    let bestOffer: GlobalOffer | null = null;
    let maxDiscount = 0;

    for (const offer of offers) {
        let discount = 0;
        if (offer.type === "percentage") {
            discount = basePrice * (offer.value / 100);
        } else if (offer.type === "flat") {
            discount = offer.value;
        }

        if (discount > maxDiscount) {
            maxDiscount = discount;
            bestOffer = offer;
        }
    }

    return bestOffer;
}

/**
 * Calculates the final price for a base price given an offer.
 */
export function calculateDiscountedPrice(basePrice: number, offer: GlobalOffer | null): number {
    if (!offer) return basePrice;

    if (offer.type === "percentage") {
        return Math.max(0, basePrice * (1 - offer.value / 100));
    } else if (offer.type === "flat") {
        return Math.max(0, basePrice - offer.value);
    }
    
    return basePrice;
}

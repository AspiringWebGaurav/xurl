import { defaultPolicies, Policy } from "@/lib/constants/defaultPolicies";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

/**
 * Fetches a specific policy by ID.
 * If the database is empty or the policy doesn't exist in the DB,
 * it gracefully falls back to the deep default e-policies.
 */
export async function getPolicy(id: string): Promise<Policy | null> {
    try {
        const policyRef = doc(db, "policies", id);
        const policySnap = await getDoc(policyRef);
        
        if (policySnap.exists()) {
            return { id, ...policySnap.data() } as Policy;
        }
    } catch (error) {
        console.warn(`[getPolicy] Failed to fetch policy '${id}' from Firestore, using fallback.`, error);
    }
    
    // Fallback to local deep policies if DB fetch fails or doc doesn't exist
    return defaultPolicies[id] || null;
}

/**
 * Fetches all available governing policies.
 */
export async function getAllPolicies(): Promise<Policy[]> {
    // In a real scenario we might list all from a collection,
    // but since we rely on the defined keys in defaultPolicies for fallbacks:
    const policyIds = Object.keys(defaultPolicies);
    const policies = await Promise.all(policyIds.map(id => getPolicy(id)));
    
    return policies.filter(Boolean) as Policy[];
}

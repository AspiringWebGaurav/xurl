/**
 * Server-side quota check for zero-flash access control
 * This function is called from Server Components only
 */

import { checkGuestLimit } from "@/services/guest";

export interface GuestQuotaResult {
  allowed: boolean;
  expiresIn?: number;
  slug?: string;
  originalUrl?: string;
  createdAt?: number;
  isLifetimeLimitReached?: boolean;
}

/**
 * Check guest quota status server-side
 * Called from Server Component before rendering
 */
export async function checkGuestQuota(
  ip: string,
  fingerprint: string | undefined
): Promise<GuestQuotaResult> {
  return await checkGuestLimit(ip, fingerprint);
}

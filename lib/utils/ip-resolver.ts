import type { NextRequest } from "next/server";

/**
 * Extracts client IP address from request headers with consistent priority.
 * 
 * Priority order:
 * 1. x-forwarded-for (first IP in chain - the original client)
 * 2. x-real-ip (fallback for some proxies)
 * 3. "unknown" (fail-safe)
 * 
 * CRITICAL: This function MUST be used consistently across all API routes
 * to ensure stable guestId generation. Do NOT use inline IP extraction.
 */
export function getClientIp(request: NextRequest): string {
    // x-forwarded-for contains comma-separated list: "client, proxy1, proxy2"
    // Always use the FIRST IP (original client) for consistency
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const firstIp = forwardedFor.split(",")[0]?.trim();
        if (firstIp) return firstIp;
    }

    // Fallback to x-real-ip
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    // Final fallback
    return "unknown";
}

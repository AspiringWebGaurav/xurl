/**
 * URL validation — only http and https protocols are allowed.
 * Rejects javascript:, data:, ftp:, and any other scheme.
 * Performs DNS resolution in production to catch IP encoding tricks and DNS rebinding.
 */

import dns from "node:dns/promises";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Check if an IP address is in a private/reserved range.
 * Catches all encoding tricks (octal, hex, decimal, IPv6-mapped).
 */
function isPrivateIP(ip: string): boolean {
    // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1 → 127.0.0.1)
    const normalized = ip.replace(/^::ffff:/, "");

    if (net.isIPv4(normalized)) {
        const parts = normalized.split(".").map(Number);
        const [a, b] = parts;
        if (a === 10) return true;                          // 10.0.0.0/8
        if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
        if (a === 192 && b === 168) return true;             // 192.168.0.0/16
        if (a === 127) return true;                          // 127.0.0.0/8
        if (a === 169 && b === 254) return true;             // 169.254.0.0/16
        if (a === 0) return true;                            // 0.0.0.0/8
        return false;
    }

    if (net.isIPv6(normalized)) {
        if (normalized === "::1" || normalized === "::") return true;
        const lower = normalized.toLowerCase();
        if (lower.startsWith("fe80:")) return true;
        if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
        return false;
    }

    return false;
}

export async function validateUrl(input: string): Promise<{ valid: boolean; url: string; error?: string }> {
    const trimmed = input.trim();

    if (!trimmed) {
        return { valid: false, url: trimmed, error: "URL cannot be empty." };
    }

    // Block excessively long URLs (prevents Firestore storage abuse)
    if (trimmed.length > 2048) {
        return { valid: false, url: trimmed, error: "URL is too long. Maximum 2048 characters." };
    }

    try {
        const parsed = new URL(trimmed);

        if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            return {
                valid: false,
                url: trimmed,
                error: `Protocol "${parsed.protocol}" is not allowed. Use http or https.`,
            };
        }

        // Block localhost and private/reserved IP ranges unless in development
        // Prevents SSRF if any backend service follows short URLs programmatically
        const isDev = process.env.NODE_ENV === "development";
        if (!isDev) {
            const h = parsed.hostname;

            // Localhost variants (fast pre-check before DNS resolution)
            if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "[::1]" || h === "::1") {
                return { valid: false, url: trimmed, error: "Localhost URLs are not allowed." };
            }

            // DNS resolution — catches hex (0x7f000001), octal (0177.0.0.1),
            // decimal (2130706433) IP encodings, and DNS rebinding attacks
            try {
                const { address } = await dns.lookup(h);
                if (isPrivateIP(address)) {
                    return { valid: false, url: trimmed, error: "Private or reserved IP addresses are not allowed." };
                }
            } catch {
                return { valid: false, url: trimmed, error: "Could not resolve hostname." };
            }
        }

        return { valid: true, url: parsed.toString() };
    } catch {
        return { valid: false, url: trimmed, error: "Invalid URL format." };
    }
}

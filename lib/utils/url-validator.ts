/**
 * URL validation — only http and https protocols are allowed.
 * Rejects javascript:, data:, ftp:, and any other scheme.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function validateUrl(input: string): { valid: boolean; url: string; error?: string } {
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

        // Block localhost unless explicitly in development mode
        // (NEXT_PUBLIC_ENVIRONMENT is often unset, so we default to blocking)
        const isDev = process.env.NODE_ENV === "development";
        if (
            !isDev &&
            (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "0.0.0.0")
        ) {
            return {
                valid: false,
                url: trimmed,
                error: "Localhost URLs are not allowed.",
            };
        }

        return { valid: true, url: parsed.toString() };
    } catch {
        return { valid: false, url: trimmed, error: "Invalid URL format." };
    }
}

/**
 * Base62 encoding/decoding for slug generation.
 *
 * Charset: 0-9 a-z A-Z
 * This gives compact, URL-safe slugs from numeric IDs.
 *
 * Examples:
 *   125  → "cb"
 *   126  → "cc"
 *   1000 → "g8"
 */

const CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = CHARSET.length; // 62

/**
 * Encode a positive integer to a Base62 string.
 */
export function encodeBase62(num: number): string {
    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error("Base62 encoding requires a non-negative integer.");
    }
    if (num === 0) return CHARSET[0];

    let encoded = "";
    let n = num;

    while (n > 0) {
        encoded = CHARSET[n % BASE] + encoded;
        n = Math.floor(n / BASE);
    }

    return encoded;
}

/**
 * Decode a Base62 string back to a numeric ID.
 */
export function decodeBase62(str: string): number {
    let num = 0;

    for (const char of str) {
        const idx = CHARSET.indexOf(char);
        if (idx === -1) throw new Error(`Invalid Base62 character: "${char}"`);
        num = num * BASE + idx;
    }

    return num;
}

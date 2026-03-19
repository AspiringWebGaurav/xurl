/**
 * Generates a lightweight device fingerprint based on stable browser characteristics.
 * This is meant to prevent basic incognito/localStorage clearing bypasses.
 * We hash it server-side to preserve user privacy.
 */
export async function getDeviceFingerprint(): Promise<string> {
    if (typeof window === "undefined") return "server-side";

    try {
        const parts = [
            navigator.userAgent,
            navigator.language,
            window.screen.width,
            window.screen.height,
            window.screen.colorDepth,
            new Date().getTimezoneOffset()
        ];

        // Use Web Crypto API to hash it client-side as well for extra safety
        const data = parts.join("|");
        const encoder = new TextEncoder();
        const dataBuf = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuf);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        return hashHex;
    } catch {
        // Fallback if Crypto API is unavailable
        return "fallback-fingerprint";
    }
}

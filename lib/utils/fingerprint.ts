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

function generateUUID() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (HTTP over LAN)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function getOrCreateGuestSessionId(): Promise<string> {
    if (typeof window === "undefined") return "server-side";

    let sessionId = localStorage.getItem("xurl_guest_session_id");
    if (!sessionId) {
        try {
            sessionId = await getDeviceFingerprint();
            if (sessionId === "fallback-fingerprint") {
                sessionId = generateUUID();
            }
        } catch {
            sessionId = generateUUID();
        }
        localStorage.setItem("xurl_guest_session_id", sessionId);
    }
    return sessionId;
}

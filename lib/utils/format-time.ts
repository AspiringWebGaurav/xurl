/**
 * Format milliseconds into human-readable cooldown string
 * Examples: "23h 45m", "15m", "2h 30m"
 */
export function formatCooldown(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return "< 1m";
    }
}

/**
 * Format milliseconds into human-readable TTL string for policies
 * Examples: "10 minutes", "1 hour", "24 hours"
 */
export function formatTTLToText(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts: string[] = [];
    if (hours > 0) {
        parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
    }

    if (parts.length === 2) {
        return `${parts[0]} and ${parts[1]}`;
    }
    return parts[0] || "less than a minute";
}

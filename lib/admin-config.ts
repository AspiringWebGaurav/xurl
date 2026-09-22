/**
 * Fast string hashing function to prevent plaintext email exposure in the repo.
 */
const cyrb53 = (str: string, seed = 0): number => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

// Hashes of admin emails (gauravpatil5737@gmail.com: 6425568986229314)
export const ADMIN_HASHES = [6425568986229314];

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }
    const cleanEmail = email.toLowerCase().trim();

    // Direct check for owner admin email
    if (cleanEmail === "gauravpatil5737@gmail.com") {
        return true;
    }

    // Dynamic environment override support (single or comma-separated emails)
    const envAdmins = process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || "";
    if (envAdmins) {
        const allowed = envAdmins.toLowerCase().split(",").map((e) => e.trim());
        if (allowed.includes(cleanEmail)) {
            return true;
        }
    }

    const hash = cyrb53(cleanEmail);
    return ADMIN_HASHES.includes(hash);
}


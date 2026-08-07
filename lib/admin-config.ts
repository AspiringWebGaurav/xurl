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

// Hashes of the admin emails (to avoid hardcoding the email in plaintext)
export const ADMIN_HASHES = [7327953269839021, 5930064445747368, 8935716010889362];

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }
    const hash = cyrb53(email.toLowerCase());
    return ADMIN_HASHES.includes(hash);
}

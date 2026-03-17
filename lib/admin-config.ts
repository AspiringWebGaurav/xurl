export const ADMIN_EMAILS = ["gauravpatil9262@gmail.com"] as const;

export const OWNER_EMAIL = "gauravpatil9262@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }

    return ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }

    return email.toLowerCase() === OWNER_EMAIL;
}

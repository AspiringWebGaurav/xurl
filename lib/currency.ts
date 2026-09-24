export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP";

export const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
};

/**
 * Normalizes currency codes (e.g. undefined -> "INR", "inr" -> "INR")
 */
export function normalizeCurrency(currency?: string | null): SupportedCurrency {
    if (!currency) return "INR";
    const upper = currency.toUpperCase();
    if (upper === "USD") return "USD";
    if (upper === "EUR") return "EUR";
    if (upper === "GBP") return "GBP";
    return "INR";
}

/**
 * Returns the currency symbol for the given currency code (defaults to "₹").
 */
export function getCurrencySymbol(currency?: string | null): string {
    const norm = normalizeCurrency(currency);
    return CURRENCY_SYMBOLS[norm] || "₹";
}

/**
 * Formats a transaction amount stored in smallest currency unit (paise / cents)
 * into a standard ledger representation with the appropriate currency symbol.
 * 
 * - If amount is 0, null, or undefined: returns "Free" (or $0.00 / ₹0.00 if showFree is false)
 * - If amount is 100 paise (INR): returns "₹1.00"
 * - If amount is 100 cents (USD): returns "$1.00"
 * - If amount is 29900 paise (INR): returns "₹299.00"
 */
export function formatTransactionAmount(
    amountPaise?: number | null,
    currency?: string | null,
    options?: { showFree?: boolean }
): string {
    const showFree = options?.showFree ?? true;
    if (amountPaise === undefined || amountPaise === null || amountPaise <= 0) {
        return showFree ? "Free" : `${getCurrencySymbol(currency)}0.00`;
    }

    const norm = normalizeCurrency(currency);
    const symbol = CURRENCY_SYMBOLS[norm] || "₹";
    const mainUnit = amountPaise / 100;
    const locale = norm === "INR" ? "en-IN" : "en-US";

    const formatted = mainUnit.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${symbol}${formatted}`;
}

/**
 * Formats admin ledger amounts (e.g. ₹0, ₹1, ₹299, or $1.00).
 */
export function formatAdminTransactionAmount(
    amountPaise?: number | null,
    currency?: string | null
): string {
    if (amountPaise === undefined || amountPaise === null) {
        return "-";
    }

    const norm = normalizeCurrency(currency);
    const symbol = CURRENCY_SYMBOLS[norm] || "₹";

    if (amountPaise === 0) {
        return `${symbol}0`;
    }

    const mainUnit = amountPaise / 100;
    const locale = norm === "INR" ? "en-IN" : "en-US";

    // If whole number, format without unnecessary decimal places; otherwise 2 decimals
    const isWhole = mainUnit % 1 === 0;
    const formatted = mainUnit.toLocaleString(locale, {
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: 2,
    });

    return `${symbol}${formatted}`;
}

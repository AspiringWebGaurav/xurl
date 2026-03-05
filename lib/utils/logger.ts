/**
 * Structured logging utility.
 * Outputs JSON-structured logs suitable for production observability.
 * Never exposes sensitive data (passwords, tokens, PII).
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    level: LogLevel;
    event: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

function createLog(level: LogLevel, event: string, message: string, data?: Record<string, unknown>): LogEntry {
    return {
        level,
        event,
        message,
        timestamp: new Date().toISOString(),
        data,
    };
}

function output(entry: LogEntry) {
    const method = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
    method(JSON.stringify(entry));
}

export const logger = {
    info(event: string, message: string, data?: Record<string, unknown>) {
        output(createLog("info", event, message, data));
    },
    warn(event: string, message: string, data?: Record<string, unknown>) {
        output(createLog("warn", event, message, data));
    },
    error(event: string, message: string, data?: Record<string, unknown>) {
        output(createLog("error", event, message, data));
    },
    debug(event: string, message: string, data?: Record<string, unknown>) {
        if (process.env.NEXT_PUBLIC_ENVIRONMENT !== "production") {
            output(createLog("debug", event, message, data));
        }
    },

    // ─── Domain-Specific Loggers ─────────────────────────────────────────

    redirect(slug: string, source: string, durationMs: number) {
        output(createLog("info", "redirect", `Redirected /${slug}`, { slug, source, durationMs }));
    },

    linkCreated(slug: string, userId: string) {
        output(createLog("info", "link_created", `Link /${slug} created`, { slug, userId }));
    },

    linkDeleted(slug: string, userId: string) {
        output(createLog("info", "link_deleted", `Link /${slug} deleted`, { slug, userId }));
    },

    rateLimited(userId: string, action: string) {
        output(createLog("warn", "rate_limited", `Rate limit hit for ${action}`, { userId, action }));
    },
};

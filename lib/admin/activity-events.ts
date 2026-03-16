export type ActivitySeverity = "INFO" | "ADMIN" | "BILLING" | "SECURITY";

export type ActivityEvent = {
    id: string;
    type: string;
    actor: string | null;
    timestamp: number;
    sourceCollection: string;
    metadata: Record<string, unknown>;
    severity: ActivitySeverity;
};

type RawDoc = Record<string, unknown>;

type TimestampLike = number | { toMillis?: () => number } | null | undefined;

const TIMESTAMP_FIELDS: Record<string, string> = {
    activity_events: "timestamp",
    transactions: "createdAt",
    orders: "createdAt",
    promo_codes: "createdAt",
    promo_redemptions: "redeemedAt",
    promo_activity: "createdAt",
    links: "updatedAt",
    dev_flags: "updatedAt",
    api_logs: "createdAt",
    users: "createdAt",
};

export function getActivityTimestampField(sourceCollection: string): string {
    return TIMESTAMP_FIELDS[sourceCollection] ?? "createdAt";
}

function resolveTimestamp(value: TimestampLike): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
        return (value as { toMillis: () => number }).toMillis();
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function buildMetadata(data: RawDoc, omit: string[]) {
    const metadata: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        if (omit.includes(key)) return;
        if (value === undefined) return;
        metadata[key] = value;
    });
    return metadata;
}

function resolveApiSeverity(data: RawDoc): ActivitySeverity {
    const statusCode = Number(data.statusCode ?? 0);
    const endpoint = String(data.endpoint ?? "");

    if (statusCode === 401 || statusCode === 403 || statusCode >= 500) {
        return "SECURITY";
    }

    if (endpoint.startsWith("/api/admin") || endpoint.startsWith("/api/dev")) {
        return "ADMIN";
    }

    if (endpoint.startsWith("/api/payments") || endpoint.startsWith("/api/user/upgrade")) {
        return "BILLING";
    }

    return "INFO";
}

function resolveTransactionType(data: RawDoc): string {
    const action = String(data.action ?? "").toLowerCase();
    const source = String(data.source ?? "").toLowerCase();

    if (action === "admin_grant" || source === "admin_grant") return "ADMIN_GRANTED_PLAN";
    if (action === "admin_revoke") return "ADMIN_REVOKED_PLAN";
    if (action === "upgrade" || action === "renew") return "PLAN_PURCHASED";
    if (action === "downgrade") return "PLAN_DOWNGRADED";
    if (action === "expire") return "PLAN_EXPIRED";
    if (action === "guest_use" || action === "free_use") return "PLAN_USAGE";
    return action ? action.toUpperCase() : "PLAN_UPDATED";
}

function resolvePromoActivityType(action: string): string {
    switch (action) {
        case "PROMO_CREATE":
            return "PROMO_CREATED";
        case "PROMO_UPDATE":
            return "PROMO_UPDATED";
        case "PROMO_PAUSE":
            return "PROMO_PAUSED";
        case "PROMO_DISABLE":
            return "PROMO_DISABLED";
        case "PROMO_DELETE":
            return "PROMO_DELETED";
        default:
            return action ? action.toUpperCase() : "PROMO_UPDATED";
    }
}

export function normalizeActivityEvent(sourceCollection: string, docId: string, data: RawDoc): ActivityEvent | null {
    if (!data) return null;

    if (sourceCollection === "activity_events") {
        const timestamp = resolveTimestamp(data.timestamp as TimestampLike ?? data.createdAt as TimestampLike ?? data.updatedAt as TimestampLike);
        if (!timestamp) return null;
        const metadata = typeof data.metadata === "object" && data.metadata !== null ? (data.metadata as Record<string, unknown>) : buildMetadata(data, ["id", "timestamp", "createdAt", "updatedAt", "sourceCollection", "severity", "type", "actor", "metadata"]);
        return {
            id: String(data.id ?? docId),
            type: String(data.type ?? "ACTIVITY_EVENT"),
            actor: data.actor ? String(data.actor) : null,
            timestamp,
            sourceCollection: String(data.sourceCollection ?? sourceCollection),
            metadata,
            severity: (data.severity as ActivitySeverity) ?? "INFO",
        };
    }

    const omitBase = ["createdAt", "updatedAt", "redeemedAt", "consumedAt", "timestamp"];
    const actorFallback = data.userEmail ?? data.email ?? data.userId ?? null;
    const baseId = `${sourceCollection}:${docId}`;

    switch (sourceCollection) {
        case "transactions": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            const type = resolveTransactionType(data);
            const severity: ActivitySeverity = type.startsWith("ADMIN_") || String(data.source ?? "") === "developer_mode" ? "ADMIN" : "BILLING";
            return {
                id: baseId,
                type,
                actor: (data.adminEmail as string | undefined) ?? (data.recipientEmail as string | undefined) ?? (data.userId ? String(data.userId) : null),
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity,
            };
        }
        case "orders": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            const status = String(data.status ?? "").toLowerCase();
            const type = status === "paid" || status === "consumed" ? "PLAN_PURCHASED" : "ORDER_CREATED";
            const severity: ActivitySeverity = String(data.source ?? "") === "developer_mode" || String(data.source ?? "") === "admin_grant" ? "ADMIN" : "BILLING";
            return {
                id: baseId,
                type,
                actor: data.userId ? String(data.userId) : null,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity,
            };
        }
        case "promo_codes": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: "PROMO_CREATED",
                actor: data.createdBy ? String(data.createdBy) : null,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "ADMIN",
            };
        }
        case "promo_redemptions": {
            const timestamp = resolveTimestamp(data.redeemedAt as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: "PROMO_REDEEMED",
                actor: (data.userEmail as string | undefined) ?? (data.userId ? String(data.userId) : null),
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "INFO",
            };
        }
        case "promo_activity": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            const action = String(data.action ?? "").toUpperCase();
            return {
                id: baseId,
                type: resolvePromoActivityType(action),
                actor: (data.adminEmail as string | undefined) ?? (data.adminUid ? String(data.adminUid) : null),
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "ADMIN",
            };
        }
        case "links": {
            const createdAt = resolveTimestamp(data.createdAt as TimestampLike);
            const updatedAt = resolveTimestamp(data.updatedAt as TimestampLike);
            const isUpdated = Boolean(updatedAt && createdAt && updatedAt > createdAt + 1000);
            const timestamp = isUpdated ? updatedAt : createdAt ?? updatedAt;
            if (!timestamp) return null;
            return {
                id: baseId,
                type: isUpdated ? "LINK_UPDATED" : "LINK_CREATED",
                actor: data.userId ? String(data.userId) : null,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "INFO",
            };
        }
        case "dev_flags": {
            const timestamp = resolveTimestamp(data.updatedAt as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: "DEV_MODE_TOGGLED",
                actor: data.userId ? String(data.userId) : docId,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "ADMIN",
            };
        }
        case "api_logs": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: "API_REQUEST",
                actor: data.userId ? String(data.userId) : null,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: resolveApiSeverity(data),
            };
        }
        case "users": {
            const timestamp = resolveTimestamp(data.createdAt as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: "USER_CREATED",
                actor: data.email ? String(data.email) : (data.uid ? String(data.uid) : null),
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "INFO",
            };
        }
        default: {
            const timestampField = getActivityTimestampField(sourceCollection);
            const timestamp = resolveTimestamp(data[timestampField] as TimestampLike);
            if (!timestamp) return null;
            return {
                id: baseId,
                type: String(sourceCollection).toUpperCase(),
                actor: actorFallback ? String(actorFallback) : null,
                timestamp,
                sourceCollection,
                metadata: buildMetadata(data, omitBase),
                severity: "INFO",
            };
        }
    }
}

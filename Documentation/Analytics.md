# Analytics

XURL provides a cost-optimized click analytics pipeline designed for serverless environments. Analytics data is collected asynchronously to ensure redirect performance is never impacted.

## Overview

The analytics system tracks click events on shortened links and aggregates them into daily rollup documents in Firestore. A Redis buffer layer batches writes to minimize Firestore operations.

## Data Collection

### Click Events

When a user clicks a shortened link, the edge proxy (`proxy.ts`) dispatches click metadata asynchronously via `event.waitUntil()`:

- **Slug** - The short link identifier
- **Referrer** - The referring URL (if available)
- **User Agent** - Browser and device information
- **Country** - Geographic location (derived from request headers)
- **Timestamp** - When the click occurred

Click recording never blocks the redirect response.

### Data Points Tracked

| Metric | Description |
| --- | --- |
| Total clicks | Lifetime click count per link |
| Daily clicks | Click count per link per calendar day |
| Unique visitors | Approximate visitor count (incremented per click) |
| Referrers | Traffic sources (e.g., twitter.com, direct) |
| Countries | Geographic distribution of clicks |
| Devices | Desktop vs. mobile breakdown |
| Browsers | Browser distribution (Chrome, Safari, Firefox, etc.) |

## Storage Architecture

### Firestore Collections

**Link-Level Counters:**
The `links/{slug}` document stores a `totalClicks` field that provides the fastest read path for summaries and top-link rankings.

**Daily Rollups:**
Each day's analytics are stored in `analytics/{slug}_{YYYY-MM-DD}` documents containing aggregated counters, referrer maps, country maps, device breakdowns, and browser distributions.

### Redis Click Buffer

To reduce Firestore write costs, clicks are first buffered in Redis using `clicks:{slug}` keys. The cleanup endpoint (`POST /api/cleanup`) periodically flushes these buffers to Firestore.

## Dashboard

Paid plan users have access to a full analytics dashboard at `/analytics` that displays:

- **Total clicks** across all links
- **Active links** count
- **Top performing links** ranked by click count
- **30-day click timeline** chart
- **Traffic breakdowns** by device, browser, referrer, and country

Free and guest users see a locked preview of the dashboard with an upgrade prompt.

### Dashboard API

```
GET /api/analytics/dashboard
```

Returns aggregated analytics for the authenticated user. See the [API Reference](API.md) for request and response details.

## Analytics Lifecycle

### Collection

1. Edge proxy intercepts `/{slug}` request
2. Redirect is served immediately
3. Click metadata dispatched asynchronously to `POST /api/analytics/click`
4. Click is recorded in Firestore and optionally buffered in Redis

### Aggregation

1. `totalClicks` on the link document is incremented atomically
2. Daily rollup document is upserted with aggregated counters
3. Redis click buffers accumulate high-frequency counts

### Maintenance

1. `POST /api/cleanup` flushes Redis click buffers to Firestore
2. Analytics documents older than 90 days are pruned during cleanup
3. Rate limiter state is cleaned during the same maintenance window

## Rate Limiting

The click recording endpoint is rate-limited to 60 requests per minute per IP address to prevent abuse while allowing legitimate high-traffic links to be tracked accurately.

## Limitations

- **Unique visitors** is an approximate metric; the current implementation increments per click rather than performing distinct-visitor deduplication.
- **Analytics retention** is 90 days by default, after which daily rollup documents are pruned during cleanup.
- **Real-time data** has a slight delay due to the Redis buffering layer; flushed data appears after the next cleanup cycle.

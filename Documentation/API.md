# API Reference

XURL exposes a RESTful API through Next.js API routes. All endpoints are served under `/api/` and follow consistent authentication and error handling patterns.

## Authentication

Most endpoints require a Firebase ID token passed in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

Guest endpoints accept unauthenticated requests and identify users by IP address and browser fingerprint.

## Base URL

```
https://your-domain.com/api
```

---

## Link Management

### Create a Short Link

```
POST /api/links
```

Creates a new shortened URL for guest or authenticated users.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Optional | Firebase ID token for authenticated users |
| `x-fingerprint` | Optional | Browser fingerprint for guest identification |

**Request Body:**

```json
{
  "originalUrl": "https://example.com/long-url",
  "customSlug": "my-alias"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `originalUrl` | string | Yes | The destination URL (max 2048 characters, http/https only) |
| `customSlug` | string | No | Custom alias (paid plans only, alphanumeric + hyphens) |

**Response (201):**

```json
{
  "slug": "a1b2c3",
  "shortUrl": "https://xurl.in/a1b2c3",
  "expiresAt": "2025-01-15T12:30:00.000Z"
}
```

**Error Responses:**

| Status | Description |
| --- | --- |
| 400 | Invalid URL, blocked URL, or invalid slug format |
| 403 | Quota exceeded or guest limit reached |
| 409 | Custom slug already taken |
| 429 | Rate limit exceeded (10 requests/minute) |

---

### List User Links

```
GET /api/links
```

Returns paginated list of the authenticated user's short links with quota information.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Query Parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `pageSize` | number | 25 | Number of links per page |
| `cursor` | string | - | Pagination cursor from previous response |

**Response (200):**

```json
{
  "links": [
    {
      "slug": "a1b2c3",
      "originalUrl": "https://example.com",
      "shortUrl": "https://xurl.in/a1b2c3",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "expiresAt": "2025-01-15T16:00:00.000Z",
      "isActive": true,
      "totalClicks": 42
    }
  ],
  "plan": "pro",
  "limit": 25,
  "freeLinksCreated": 2,
  "paidLinksCreated": 10,
  "planTtlHours": 6
}
```

---

### Delete a Link

```
DELETE /api/links
```

Deletes an authenticated user's short link and invalidates all caches.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Request Body:**

```json
{
  "slug": "a1b2c3"
}
```

**Response (200):**

```json
{
  "success": true
}
```

---

## Redirect

### Resolve a Short Link

```
GET /api/redirect/{slug}
```

Resolves a short link slug to its destination URL. Used internally by the edge proxy.

**Path Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `slug` | string | The short link slug to resolve |

**Response (200):**

```json
{
  "url": "https://example.com/long-url",
  "redirectUrl": "/r?dest=https://example.com/long-url"
}
```

**Error Responses:**

| Status | Description |
| --- | --- |
| 404 | Slug not found |
| 410 | Link has expired |
| 429 | Abuse protection triggered |

---

## Guest Status

### Check Guest Active Link

```
GET /api/guest-status
```

Returns the current active link status for a guest user identified by IP and fingerprint.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `x-fingerprint` | Yes | Browser fingerprint hash |

**Response (200):**

```json
{
  "hasActiveLink": true,
  "slug": "a1b2c3",
  "originalUrl": "https://example.com",
  "expiresAt": "2025-01-15T10:05:00.000Z"
}
```

**Rate Limit:** 30 requests/minute per IP

---

## Slug Availability

### Check Slug Availability

```
GET /api/check-slug?slug=my-alias
```

Checks whether a custom slug is available for use.

**Query Parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | Yes | The slug to check |

**Response (200):**

```json
{
  "available": true
}
```

**Rate Limit:** 30 requests/minute per IP

---

## URL Preview

### Extract URL Metadata

```
GET /api/preview?url=https://example.com
```

Extracts the title and favicon from a target URL with SSRF protection.

**Query Parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | Yes | The URL to extract metadata from |

**Response (200):**

```json
{
  "title": "Example Domain",
  "favicon": "https://example.com/favicon.ico"
}
```

**Rate Limit:** 20 requests/minute per IP

---

## Analytics

### Record a Click

```
POST /api/analytics/click
```

Records a click event for a shortened link. Used internally by the edge proxy. Fire-and-forget; never blocks redirects.

**Request Body:**

```json
{
  "slug": "a1b2c3",
  "referrer": "https://twitter.com",
  "userAgent": "Mozilla/5.0...",
  "country": "US"
}
```

**Response (200):**

```json
{
  "success": true
}
```

**Rate Limit:** 60 requests/minute per IP

---

### Analytics Dashboard

```
GET /api/analytics/dashboard
```

Returns aggregated analytics for the authenticated user's links. Available to paid plan users only.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Response (200):**

```json
{
  "totalClicks": 1250,
  "activeLinks": 8,
  "topLinks": [
    {
      "slug": "a1b2c3",
      "originalUrl": "https://example.com",
      "totalClicks": 420
    }
  ],
  "timeline": [
    { "date": "2025-01-15", "clicks": 85 }
  ],
  "devices": { "desktop": 720, "mobile": 530 },
  "browsers": { "Chrome": 600, "Safari": 400, "Firefox": 250 },
  "referrers": { "twitter.com": 300, "direct": 500 },
  "countries": { "US": 400, "IN": 350, "UK": 200 }
}
```

---

## Payments

### Create Payment Order

```
POST /api/payments/create-order
```

Creates a Razorpay payment order for a plan upgrade.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Request Body:**

```json
{
  "planId": "pro"
}
```

**Response (200):**

```json
{
  "orderId": "order_ABC123",
  "amount": 9900,
  "currency": "INR"
}
```

**Rate Limit:** 10 requests/hour per user

---

### Verify Payment

```
POST /api/payments/verify
```

Verifies a Razorpay payment signature and applies the plan upgrade.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Request Body:**

```json
{
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "hmac_signature_here"
}
```

**Response (200):**

```json
{
  "success": true,
  "plan": "pro",
  "cumulativeQuota": 25
}
```

---

### Payment Webhook

```
POST /api/payments/webhook
```

Server-to-server callback from Razorpay. Verifies HMAC-SHA256 signature and applies plan upgrade idempotently.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `x-razorpay-signature` | Yes | HMAC-SHA256 signature |

This endpoint is configured in the Razorpay dashboard and not called directly by clients.

---

## User Management

### Get or Create User Profile

```
GET /api/user/profile
```

Returns the authenticated user's profile. Creates a new user document on first access.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Response (200):**

```json
{
  "uid": "firebase_uid",
  "displayName": "John Doe",
  "email": "john@example.com",
  "photoURL": "https://...",
  "plan": "pro",
  "planStatus": "active",
  "planExpiry": "2025-02-15T00:00:00.000Z",
  "cumulativeQuota": 25,
  "activeLinks": 3,
  "linksCreated": 12
}
```

---

### Update User Profile

```
PATCH /api/user/profile
```

Updates the user's display name and profile information.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Request Body:**

```json
{
  "displayName": "Jane Doe"
}
```

---

### Sync Guest Links

```
POST /api/user/sync
```

Migrates a guest's active link to the authenticated user's account after login.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |
| `x-fingerprint` | Yes | Browser fingerprint hash |

---

### Get Purchase History

```
GET /api/user/transactions
```

Returns paginated purchase and plan event history.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

**Response (200):**

```json
{
  "transactions": [
    {
      "action": "upgrade",
      "planType": "pro",
      "linksAllocated": 25,
      "paymentId": "pay_XYZ789",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### Apply Plan Upgrade

```
POST /api/user/upgrade
```

Applies a free or already-paid plan upgrade.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | Firebase ID token |

---

## Exchange Rates

### Get Currency Rates

```
GET /api/exchange-rates
```

Returns INR to USD and EUR exchange rates for the pricing page. Cached for 24 hours at the edge.

**Response (200):**

```json
{
  "USD": 0.012,
  "EUR": 0.011
}
```

---

## Maintenance

### Cleanup (Cron)

```
POST /api/cleanup
```

Scheduled maintenance endpoint for analytics pruning, rate limiter cleanup, and Redis click buffer flushing.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <CLEANUP_SECRET>` |

This endpoint should be called by a scheduler (e.g., Vercel Cron, Cloud Scheduler) and is not intended for direct client use.

---

## Rate Limiting Summary

| Endpoint | Limit | Mechanism |
| --- | --- | --- |
| `POST /api/links` | 10/min per user or IP | Redis protection + in-memory fallback |
| `POST /api/analytics/click` | 60/min per IP | In-memory rate limiter |
| `GET /api/check-slug` | 30/min per IP | In-memory rate limiter |
| `GET /api/preview` | 20/min per IP | In-memory rate limiter |
| `GET /api/guest-status` | 30/min per IP | In-memory rate limiter |
| `GET /api/redirect/{slug}` | Burst/abuse scoring | Redis evaluateRequest() |
| `POST /api/payments/create-order` | 10/hour per user | Redis + in-memory fallback |

## Error Format

All API errors follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

HTTP status codes follow standard conventions: 400 for client errors, 401 for authentication failures, 403 for authorization failures, 404 for missing resources, 429 for rate limits, and 500 for server errors.

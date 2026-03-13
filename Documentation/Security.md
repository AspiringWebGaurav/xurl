# Security

XURL implements multiple layers of security to protect users, prevent abuse, and ensure the integrity of the URL shortening service.

## Authentication and Authorization

### Firebase Auth

- **Google OAuth 2.0** is the sole authentication method, providing industry-standard identity verification.
- ID tokens are verified server-side using the Firebase Admin SDK on every authenticated API request.
- User identity is derived exclusively from the verified token; client-supplied user IDs are never trusted.

### Authorization Model

- All write operations go through server-side API routes using the Firebase Admin SDK.
- Firestore security rules enforce read access:
  - `links` are publicly readable (required for redirect lookups)
  - `users` are readable only by the authenticated owner
  - `analytics` are readable by authenticated users
  - All other collections are restricted to admin SDK access

## Abuse Protection

### Redis Protection Gateway

The primary abuse protection system (`lib/redis/protection.ts`) evaluates every link creation and redirect request using atomic Lua scripts that combine:

- **Abuse scoring** - Behavioral pattern analysis with a threshold of 40 points
- **Burst detection** - Maximum 5 requests per second per identity
- **Rate limiting** - 30 requests per minute per identity (configurable per route)
- **Fingerprint limits** - Device-based constraints for guest users
- **Token bucket** - Plan-based quota enforcement

### Rate Limiting Matrix

| Endpoint | Limit | Mechanism |
| --- | --- | --- |
| `POST /api/links` | 10/min per user or IP | Redis protection + in-memory fallback |
| `POST /api/analytics/click` | 60/min per IP | In-memory rate limiter |
| `GET /api/check-slug` | 30/min per IP | In-memory rate limiter |
| `GET /api/preview` | 20/min per IP | In-memory rate limiter |
| `GET /api/guest-status` | 30/min per IP | In-memory rate limiter |
| `GET /api/redirect/{slug}` | Burst/abuse scoring | Redis evaluateRequest() |
| `POST /api/payments/create-order` | 10/hour per user | Redis + in-memory fallback |

### Graceful Degradation

When Redis is unavailable, the protection layer falls back to process-local in-memory rate limiters. These provide basic protection but are not distributed across serverless instances.

## URL Safety

### SSRF Protection

`lib/utils/url-validator.ts` implements comprehensive protection against Server-Side Request Forgery:

- **DNS resolution** before storing any URL
- **Private IP blocking** - Rejects URLs resolving to:
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
  - `127.0.0.0/8`
  - `::1` and other IPv6 loopback/private addresses
- **Protocol filtering** - Only `http://` and `https://` URLs are accepted
- **Length limit** - Maximum 2,048 characters

### Redirect Safety

- Short links redirect through an interstitial page (`/r`) rather than performing direct 302 redirects
- Expired or inactive links return HTTP 410 without exposing the original URL
- Negative caching in Redis prevents slug-scanning attacks

## Payment Security

### Razorpay Integration

- **Order creation** uses server-side Razorpay API with 10-second timeout
- **Signature verification** uses HMAC-SHA256 with timing-safe comparison
- **Webhook validation** verifies the `x-razorpay-signature` header before processing
- **Idempotency** prevents double upgrades by checking order status (`consumed` flag)
- **Dual verification** - Both client-side verify and server-side webhook paths ensure payment completion

## Guest Security

### Identity Verification

Guest users are identified by a combination of:
- **IP address** - SHA-256 hashed before storage
- **Browser fingerprint** - SHA-256 hashed before storage

This dual-factor approach prevents quota circumvention while preserving user privacy.

### Guest Restrictions

- One active link at a time
- 5-minute TTL on all guest links
- No custom aliases
- Automatic cleanup via Firestore TTL

## Data Protection

### Data Minimization

- Only essential data is collected (email via Google Auth, hashed IP, hashed fingerprint)
- No passwords are stored (Google OAuth handles authentication)
- Sensitive identifiers are hashed before persistence

### Firestore TTL

Documents containing temporary data are automatically deleted:
- Expired links are removed via Firestore TTL on `expiresAt`
- Guest usage records are cleaned up after the guest window ends

### Environment Security

- All secrets are managed through environment variables (never committed to source)
- `lib/env.ts` validates configuration at startup using Zod schemas
- Production mode fails hard on missing or invalid configuration

## Security Testing

XURL includes a comprehensive security testing suite:

```bash
# Full security audit
node scripts/security-tests/run_full_audit.mjs

# Redis protection tests
node scripts/security-tests/redis_protection_tests.mjs

# Deep abuse scenario testing
node scripts/security-tests/deep_redis_scenarios.mjs
```

The audit suite covers 11 security test files testing URL validation, rate limiting, abuse detection, payment verification, and SSRF protection.

## Reserved Routes

The following slugs are reserved and cannot be used as custom aliases:

`api`, `login`, `expired`, `_next`, `not-found`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`, `sw.js`, `workbox`, `vercel`, `.well-known`, `admin`, `dashboard`, `settings`, `preview`, `terms`, `privacy`, `acceptable-use`, `about`, `contact`, `help`, `support`, `docs`, `profile`, `purchase-history`, `pricing`, `guest-policy`, `placeholder`, `r`

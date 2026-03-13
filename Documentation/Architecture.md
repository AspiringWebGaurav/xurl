# Architecture

XURL is a serverless URL shortening platform built on a modern event-driven architecture designed for low latency, high throughput, and zero infrastructure management.

## System Overview

```
Browser (React 19 + Firebase Auth)
  |
  +-- /{slug} --> Edge Middleware (proxy.ts)
  |                +-- In-memory cache (5 min TTL, 5000 entries)
  |                +-- /api/redirect/{slug} on miss
  |                |     +-- Redis positive/negative cache
  |                |     +-- Firestore fallback
  |                +-- Async analytics dispatch
  |                +-- Redirect to /r?dest={url} (interstitial)
  |
  +-- /api/* --> Next.js API Routes (Node.js runtime)
                  +-- Firebase Admin SDK (auth, Firestore)
                  +-- Redis protection gateway
                  +-- Razorpay payment processing
                  +-- Firestore (system of record)

Background:
  +-- Firestore TTL auto-deletes expired links/guest_usage
  +-- Firebase Function onLinkDeleted -> counter correction
  +-- POST /api/cleanup (cron) -> analytics pruning, Redis flush
```

## Runtime Boundaries

| Runtime | Scope | Responsibility |
| --- | --- | --- |
| **Browser** | React 19, Firebase Client SDK | User interface, authentication, fingerprinting, pricing UI |
| **Edge Proxy** | `proxy.ts` | Slug interception, in-memory caching, analytics dispatch |
| **Node.js API** | `app/api/**/*` | Auth verification, link CRUD, payments, redirect fallback |
| **Service Layer** | `services/*`, `lib/*` | Transactional business logic, Redis protection, URL validation |
| **Firebase Functions** | `functions/src/index.ts` | Post-TTL counter correction for authenticated links |

## Three-Tier Caching Strategy

XURL employs a layered caching approach to minimize redirect latency:

### Tier 1: Edge In-Memory Cache

- **Location:** `proxy.ts` (process-local)
- **TTL:** 5 minutes
- **Capacity:** 5,000 entries (LRU eviction)
- **Latency:** Sub-millisecond

### Tier 2: Redis Distributed Cache

- **Provider:** Upstash Redis
- **Positive cache TTL:** 1 hour
- **Negative cache TTL:** 2 minutes (anti-scan defense)
- **Features:** Click buffering, atomic Lua operations

### Tier 3: Firestore (Source of Record)

- **Role:** Persistent storage, queried only on double cache miss
- **TTL:** Native Firestore TTL for automatic document expiry
- **Consistency:** Strong consistency within transactions

## Core Data Flows

### Link Creation

```
POST /api/links
  -> Redis evaluateRequest() (burst/rate/abuse scoring)
  -> Guest: checkGuestLimit() | Auth: verifyIdToken()
  -> validateUrl() (SSRF protection)
  -> Firestore Transaction:
      Read: user doc, counter, links query, guest_usage
      Enforce: plan limits (free: 3 lifetime / paid: cumulative quota)
      Generate: base62(counter++) or validate custom slug
      Write: links/{slug}, user counters, guest_usage
  -> Post-commit: warm Redis cache, invalidate negative cache
  <- { slug, shortUrl, expiresAt }
```

### Redirect Resolution

```
GET /{slug}
  -> proxy.ts: validate slug format
  -> Check edge cache -> HIT: redirect to /r?dest=...
  -> MISS: fetch /api/redirect/{slug}
      -> Redis positive cache -> HIT: return
      -> Redis negative cache -> HIT: return 404
      -> Firestore links/{slug} -> cache in Redis
  -> Active: redirect to /r?dest={url} + dispatch analytics
  -> Expired/missing: redirect to /expired
```

### Payment Processing

```
/login?plan=pro
  -> Google sign-in -> POST /api/user/sync (migrate guest links)
  -> POST /api/payments/create-order -> Razorpay API -> Firestore orders/{id}
  -> Razorpay checkout popup
  -> POST /api/payments/verify (HMAC-SHA256 signature check)
      -> applyPlanUpgrade(): user.cumulativeQuota += plan.limit
  -> Webhook backup: POST /api/payments/webhook (idempotent)
```

### Authentication

1. Client initiates Google sign-in via Firebase Auth popup.
2. On auth state change, `ensureUserDocument` calls `GET /api/user/profile` with the ID token.
3. Server verifies the token via Firebase Admin SDK and upserts `users/{uid}`.
4. All authenticated API routes derive the acting user exclusively from the verified token.
5. Guest-to-user migration occurs via `POST /api/user/sync` during the login flow.

## Database Schema

| Collection | Primary Key | Purpose |
| --- | --- | --- |
| `users` | Firebase Auth UID | User profile, plan state, quota counters |
| `links` | `slug` | Core short-link records with TTL |
| `analytics` | `{slug}_{YYYY-MM-DD}` | Daily click rollups |
| `orders` | Razorpay `orderId` | Payment order tracking (idempotency) |
| `transactions` | Auto-generated | Plan event audit ledger |
| `guest_usage` | SHA-256 hash | Guest quota enforcement |
| `system` | `counter` | Global monotonic slug counter |

### Firestore Security Rules

- **links**: Publicly readable (redirect lookups), writes admin-only
- **users**: Readable only by authenticated owner, writes admin-only
- **analytics**: Readable by authenticated users, writes admin-only
- **system**: Fully restricted (admin SDK only)
- Default deny on all other paths

## Background Processing

### Firestore TTL

Configured for `links.expiresAt` and `guest_usage.expiresAt`. Firestore automatically deletes expired documents asynchronously.

### Firebase Cloud Function

`onLinkDeleted` listens for deleted link documents and decrements `users.activeLinks` to maintain counter accuracy after TTL cleanup.

### Cleanup Endpoint

`POST /api/cleanup` performs scheduled maintenance:
1. Prunes analytics documents older than 90 days
2. Cleans in-memory rate limiter state
3. Flushes Redis click buffers to Firestore

## Design Principles

- **Transactional safety:** All link creation and plan upgrades use Firestore transactions with reads-before-writes.
- **Idempotency:** Payment verification prevents double upgrades via order status checking.
- **Graceful degradation:** Redis circuit breaker ensures the app works (slower) when Redis is down.
- **Fire-and-forget analytics:** Click recording never blocks the redirect response.
- **SSRF protection:** URL validation resolves DNS and blocks private IP ranges before storing links.
- **Cumulative quotas:** Paid plan purchases add to quota permanently, quotas never reset.

# Developer Guide

This guide covers local development setup, project conventions, and available tooling for working on the XURL codebase.

## Local Setup

### Prerequisites

- Node.js 18 or later
- npm
- A Firebase project with Auth and Firestore enabled
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```bash
git clone https://github.com/your-org/xurl.git
cd xurl
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root with the required environment variables. See the [Deployment Guide](Deployment.md) for the full variable matrix.

At minimum, you need:
- Firebase client SDK keys (`NEXT_PUBLIC_FIREBASE_*`)
- Firebase Admin credentials (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- App URLs (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SHORT_DOMAIN`, `NEXT_PUBLIC_API_BASE`)

### Running the Development Server

```bash
npm run dev
```

The application starts at `http://localhost:3000`.

### Build and Lint

```bash
npm run lint      # ESLint
npm run build     # Production build
```

### Firebase Functions (Optional)

If you need TTL counter correction locally:

```bash
npm --prefix functions install
npm --prefix functions run build
```

### Firestore TTL and Indexes (Optional)

```bash
npm run deploy:ttl
```

## Project Structure

```
xurl/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── (legal)/            # Legal pages (terms, privacy, acceptable-use, refund)
│   ├── api/                # Server-side API endpoints
│   ├── analytics/          # Analytics dashboard
│   ├── login/              # Auth + payment checkout
│   ├── pricing/            # Plan comparison
│   ├── profile/            # User profile
│   ├── r/                  # Redirect interstitial
│   └── page.tsx            # Homepage (main shortener UI)
├── components/
│   ├── layout/             # Shell components (navbar, footer, sidebar)
│   └── ui/                 # Reusable UI primitives (shadcn/ui)
├── Documentation/          # Project documentation
├── functions/              # Firebase Cloud Functions
├── lib/
│   ├── firebase/           # Firebase Admin + Client SDKs
│   ├── redis/              # Redis client, protection gateway, redirect cache
│   └── utils/              # Helpers (base62, fingerprint, logger, URL validation)
├── scripts/                # Operational and testing scripts
├── services/               # Business logic layer
├── types/                  # Shared TypeScript interfaces
└── proxy.ts                # Edge middleware
```

## Key Patterns

### Service Layer

Business logic lives in `services/` and is shared between API routes. API routes handle HTTP concerns (parsing, auth, responses) while services handle domain logic.

### Transactional Safety

All link creation and plan upgrades use Firestore transactions with reads-before-writes to prevent race conditions.

### Redis Protection Gateway

`lib/redis/protection.ts` evaluates requests atomically using Lua scripts. It combines burst detection, rate limiting, abuse scoring, and pattern analysis in a single Redis round-trip.

### Graceful Degradation

When Redis is unavailable, the app falls back to:
- Firestore for redirect lookups (bypassing Redis cache)
- In-memory rate limiters (process-local, not distributed)
- Direct Firestore writes (bypassing click buffering)

### URL Validation

`lib/utils/url-validator.ts` resolves DNS and blocks private IP ranges (10.x, 172.x, 192.168.x, 127.x, ::1) to prevent SSRF attacks.

### Plan Definitions

`lib/plans.ts` is the single source of truth for all plan tiers, including limits, TTLs, prices, and feature flags. All backend logic references this file.

## Available Scripts

### Health and Smoke Tests

| Script | Purpose |
| --- | --- |
| `node scripts/health-check.mjs [baseUrl]` | Basic system smoke test |
| `node scripts/test-all-journeys.mjs` | Full user-journey and payment-path verification |
| `node scripts/test-payment.mjs` | Payment-focused checks |

### Quota and Migration Tests

| Script | Purpose |
| --- | --- |
| `node scripts/test_guest_migration.mjs` | Guest-to-user migration verification |
| `node scripts/test_historical_quotas.mjs` | Historical quota behavior validation |
| `node scripts/test_quota_api.mjs` | API-side quota testing |
| `node scripts/verify_quotas.mjs` | Counter and quota inspection |

### Security Tests

| Script | Purpose |
| --- | --- |
| `node scripts/security-tests/run_full_audit.mjs` | Full security audit suite |
| `node scripts/security-tests/redis_protection_tests.mjs` | Redis protection coverage |
| `node scripts/security-tests/deep_redis_scenarios.mjs` | Deep Redis and abuse scenarios |

### Utility Scripts

| Script | Purpose |
| --- | --- |
| `node scripts/dump_db.mjs` | Firestore data dump for debugging |
| `node scripts/inject_mock_expired_link.mjs` | Expired-link fixture creation |
| `node scripts/stress-test.mjs` | Load/stress testing |

Most scripts require a running local app and valid Firebase admin credentials in `.env.local`.

## Tech Stack

| Technology | Purpose |
| --- | --- |
| Next.js 16 | App Router, API routes, edge middleware |
| React 19 | UI components with React Compiler |
| TypeScript | Type safety across the full stack |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui | Reusable UI component primitives |
| Framer Motion | Animations and transitions |
| Firebase Auth | Google sign-in (client popup + server verification) |
| Firestore | Primary database with native TTL |
| Firebase Functions | Post-TTL counter correction |
| Upstash Redis | Distributed caching and abuse protection |
| Razorpay | Payment processing |
| Zod | Runtime schema validation |

## Configuration Files

| File | Purpose |
| --- | --- |
| `lib/plans.ts` | Plan tiers, limits, prices, TTLs (single source of truth) |
| `lib/env.ts` | Zod-validated environment configuration |
| `next.config.ts` | Next.js configuration (React Compiler enabled) |
| `firebase.json` | Firestore rules + functions deploy config |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite indexes + TTL field overrides |

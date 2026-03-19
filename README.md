# XURL

**Fast, secure URL shortening with built-in analytics and abuse protection.**

XURL is a serverless SaaS URL shortening platform built for speed, security, and scalability. Create short links instantly as a guest, sign in for extended features, or upgrade to a paid plan for custom aliases, longer TTLs, and a full analytics dashboard.

## Features

- **Instant Link Shortening** — Create short URLs in one click, no account required
- **Guest Access** — Try the service immediately with no sign-up friction
- **Google Sign-In** — One-click authentication with Firebase Auth
- **Custom Aliases** — Choose your own slug for branded, memorable links (paid plans)
- **Click Analytics** — Track clicks, referrers, devices, browsers, countries, and daily trends
- **Analytics Dashboard** — Visual breakdowns of link performance with 30-day timelines
- **Abuse Protection** — Multi-layer defense with Redis-backed burst detection, rate limiting, and abuse scoring
- **SSRF Protection** — DNS-validated URL submission blocks private IPs and malicious destinations
- **QR Code Generation** — Auto-generated QR codes for every shortened link
- **Link Preview** — Metadata extraction (title + favicon) for destination URLs
- **Automatic Expiry** — Plan-based TTL with Firestore native TTL cleanup
- **Payment Integration** — Secure Razorpay checkout with idempotent order processing
- **Admin Console** — Promo code CRUD with redemptions, per-user limits, free-plan promos; plan grants with custom durations
- **Developer Mode** — Dev-only simulated payments (no Razorpay calls) for the whitelisted dev email
- **Edge Caching** — Three-tier caching (edge, Redis, Firestore) for sub-millisecond redirects
- **Desktop-Optimized UI** — Clean, modern interface built with shadcn/ui and Framer Motion

## Architecture

```
Browser (React 19 + Firebase Auth)
  |
  +-- /{slug} --> Edge Middleware
  |                +-- In-memory cache (5 min TTL)
  |                +-- Redis distributed cache
  |                +-- Firestore (source of record)
  |                +-- Async analytics dispatch
  |
  +-- /api/* --> Next.js API Routes
                  +-- Firebase Admin SDK
                  +-- Redis protection gateway
                  +-- Razorpay payments
                  +-- Firestore persistence

Background:
  +-- Firestore TTL (auto-delete expired links)
  +-- Firebase Function (counter correction)
  +-- Cleanup cron (analytics pruning, Redis flush)
```

XURL uses a three-tier caching strategy for redirect resolution:

1. **Edge in-memory** — Process-local, sub-millisecond, 5-minute TTL
2. **Redis** — Distributed, 1-hour positive cache, 2-minute negative cache
3. **Firestore** — Source of record, queried only on double cache miss

For detailed architecture documentation, see [Documentation/Architecture.md](Documentation/Architecture.md).

## Tech Stack

| Technology | Purpose |
| --- | --- |
| [Next.js 16](https://nextjs.org) | App Router, API routes, edge middleware |
| [React 19](https://react.dev) | UI with React Compiler |
| [TypeScript](https://typescriptlang.org) | Full-stack type safety |
| [Tailwind CSS 4](https://tailwindcss.com) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | UI component primitives |
| [Framer Motion](https://motion.dev) | Animations and transitions |
| [Firebase Auth](https://firebase.google.com/products/auth) | Google OAuth authentication |
| [Firestore](https://firebase.google.com/products/firestore) | Primary database with native TTL |
| [Firebase Functions](https://firebase.google.com/products/functions) | Post-TTL counter correction |
| [Upstash Redis](https://upstash.com) | Distributed caching and abuse protection |
| [Razorpay](https://razorpay.com) | Payment processing |
| [Zod](https://zod.dev) | Runtime schema validation |

Additional capabilities

- **Promo code policy** — Percentage, fixed, and free_plan discounts; plan scoping; total/per-user limits; redemptions tracked; admin-only CRUD
- **Admin grants** — Zero-amount grants with custom durations and source=admin_grant
- **Developer mode** — Dev-only toggle that simulates successful payments with source=developer_mode; production untouched

## Plans

| Plan | Price (INR) | Links | TTL | Custom Alias |
| --- | ---: | ---: | --- | --- |
| Guest | Free | 1 | 5 min | No |
| Free | Free | 1 (3 lifetime) | 10 min | No |
| Starter | 49 | 5 | 2 hr | Yes |
| Pro | 99 | 25 | 6 hr | Yes |
| Business | 199 | 100 | 12 hr | Yes |
| Enterprise | 299 | 300 | 24 hr | Yes |
| Big Enterprise | 999 | 600 | 24 hr | Yes |

Paid plan purchases are cumulative — each purchase adds to your total quota permanently.

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Auth and Firestore enabled
- (Optional) Upstash Redis instance
- (Optional) Razorpay account for payment features

### Installation

```bash
git clone https://github.com/your-org/xurl.git
cd xurl
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=localhost:3000
NEXT_PUBLIC_API_BASE=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin
FIREBASE_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Redis (recommended)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Payments (optional)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Operations
CLEANUP_SECRET=your_cleanup_secret
```

See the [Deployment Guide](Documentation/Deployment.md) for the full environment variable reference.

### Local Development

```bash
npm run dev       # Start development server at http://localhost:3000
npm run lint      # Run ESLint
npm run build     # Production build
```

### Firebase Functions (Optional)

```bash
npm --prefix functions install
npm --prefix functions run build
```

### Deploy Firestore TTL

```bash
npm run deploy:ttl
```

## Production Deployment

1. Deploy the Next.js application with all environment variables
2. Apply Firestore rules and indexes: `firebase deploy --only firestore`
3. Deploy TTL configuration: `npm run deploy:ttl`
4. Deploy Firebase Functions: `npm --prefix functions run deploy`
5. Configure Razorpay webhook to `POST /api/payments/webhook`
6. Schedule cleanup cron to `POST /api/cleanup`
7. Verify with `node scripts/health-check.mjs https://your-domain.com`

For the complete deployment checklist, see the [Deployment Guide](Documentation/Deployment.md).

## Folder Structure

```
xurl/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── (legal)/            # Legal pages (terms, privacy, AUP, refund)
│   ├── api/                # 16 server-side API endpoints
│   ├── analytics/          # Analytics dashboard
│   ├── login/              # Auth + payment checkout
│   ├── pricing/            # Plan comparison
│   └── page.tsx            # Homepage (main shortener UI)
├── components/             # React components (layout + UI primitives)
├── Documentation/          # Project documentation
├── functions/              # Firebase Cloud Functions
├── lib/                    # Shared libraries (Firebase, Redis, utilities)
├── scripts/                # Operational and testing scripts
├── services/               # Business logic layer
├── types/                  # Shared TypeScript interfaces
└── proxy.ts                # Edge middleware (slug interception)
```

## Documentation

Complete documentation is available in the [`Documentation/`](Documentation/) directory:

| Document | Description |
| --- | --- |
| [Architecture](Documentation/Architecture.md) | System design, data flows, caching strategy |
| [API Reference](Documentation/API.md) | All endpoints with request/response examples |
| [Analytics](Documentation/Analytics.md) | Click tracking pipeline and dashboard |
| [Deployment](Documentation/Deployment.md) | Environment variables, production checklist |
| [Developer Guide](Documentation/Developer-Guide.md) | Local setup, project patterns, scripts |
| [Security](Documentation/Security.md) | Auth, abuse protection, SSRF, rate limiting |
| [Promo Policy](Documentation/Promo-Policy.md) | Promo types, limits, redemptions, admin rules |

### Legal

| Document | Description |
| --- | --- |
| [Terms of Service](Documentation/Terms-of-Service.md) | Service terms and conditions |
| [Privacy Policy](Documentation/Privacy-Policy.md) | Data collection and usage practices |
| [Acceptable Use Policy](Documentation/Acceptable-Use-Policy.md) | Prohibited content and activities |
| [Refund Policy](Documentation/Refund-Policy.md) | Billing terms and refund eligibility |

### Operations & Scripts

- `scripts/test-dev-admin.mjs` — Dev/admin end-to-end: dev mode toggle, promo validation, admin grant, dev-mode purchase, per-user limit, transactions/redemptions
- `scripts/clean_all.mjs` — Flush Redis, delete key Firestore collections, reset counters, delete Auth users (destructive)
- `scripts/wipe-firestore-all.mjs` — Delete all top-level Firestore collections (destructive)
- `scripts/flush-redis.mjs` — Upstash Redis FLUSHALL (destructive)

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and ensure `npm run lint` and `npm run build` pass
4. Commit with a descriptive message
5. Open a pull request against `main`

### Guidelines

- Follow existing code patterns and TypeScript conventions
- All link creation and plan logic must use Firestore transactions
- New API endpoints should include appropriate rate limiting
- URL inputs must pass through `lib/utils/url-validator.ts`
- Plan-related changes must reference `lib/plans.ts` as the single source of truth

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

<div align="center">

# XURL

### Fast, secure URL shortening with built-in analytics and abuse protection.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_+_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Redis](https://img.shields.io/badge/Upstash-Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://upstash.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Create short links instantly. Track every click. Scale without limits.**

XURL is a production-grade, serverless SaaS URL shortening platform built for speed, security, and scalability. Create short links as a guest in one click, sign in for extended features, or upgrade to a paid plan for custom aliases, longer TTLs, and a full analytics dashboard.

[Live Demo](https://xurl.eu.cc) &middot; [API Docs](https://xurl.eu.cc/documentation/api) &middot; [Report Bug](https://github.com/AspiringWebGaurav/xurl/issues) &middot; [Request Feature](https://github.com/AspiringWebGaurav/xurl/issues)

</div>

---

## Table of Contents

- [Why XURL](#why-xurl)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Plans & Pricing](#plans--pricing)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why XURL

Most URL shorteners are either too simple (no analytics, no auth) or too bloated (slow, over-engineered). XURL sits right in the middle — a **production-ready, developer-friendly platform** with:

- **Sub-millisecond redirects** via three-tier edge caching
- **Zero-friction onboarding** — shorten a link without signing up
- **Built-in abuse protection** — no separate WAF needed
- **Real payment flow** — not a demo; actual Razorpay checkout with idempotent processing
- **Clean, modern UI** — built with shadcn/ui, Framer Motion, and Tailwind CSS 4

---

## Features

<table>
<tr>
<td width="50%">

**Core**
- **Instant Shortening** — One-click link creation, no account required
- **Guest Access** — Zero sign-up friction to try the service
- **Google Sign-In** — One-click OAuth via Firebase Auth
- **Custom Aliases** — Branded, memorable slugs (paid plans)
- **QR Codes** — Auto-generated for every shortened link
- **Link Preview** — Metadata extraction (title + favicon)

</td>
<td width="50%">

**Analytics & Security**
- **Click Analytics** — Referrers, devices, browsers, countries, daily trends
- **Analytics Dashboard** — Visual breakdowns with 30-day timelines
- **Abuse Protection** — Redis-backed burst detection, rate limiting, abuse scoring
- **SSRF Defense** — DNS-validated URLs block private IPs and malicious targets
- **Automatic Expiry** — Plan-based TTL with Firestore native cleanup
- **Edge Caching** — Three-tier: in-memory, Redis, Firestore

</td>
</tr>
<tr>
<td width="50%">

**Payments & Plans**
- **Razorpay Integration** — Secure checkout with webhook verification
- **Idempotent Orders** — No double-charges, ever
- **Cumulative Quotas** — Each purchase adds to your total permanently
- **Promo Codes** — Percentage, fixed, and free-plan discounts
- **Plan Grants** — Admin-issued plans with custom durations

</td>
<td width="50%">

**Developer Experience**
- **Developer API** — RESTful endpoints with key-based auth
- **Admin Console** — Promo CRUD, plan grants, user management
- **Developer Mode** — Simulated payments for local testing
- **Full TypeScript** — End-to-end type safety
- **MDX-Ready Docs** — Modular documentation architecture

</td>
</tr>
</table>

---

## Architecture

```
                         ┌─────────────────────────────────┐
                         │      Browser / API Client       │
                         │   React 19 · Firebase Auth      │
                         └──────────┬────────────┬─────────┘
                                    │            │
                    /{slug} redirect│            │ /api/* requests
                                    ▼            ▼
                         ┌──────────────────────────────────┐
                         │        Edge Middleware            │
                         │     (Next.js 16 App Router)      │
                         └──────────┬───────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                 ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
          │  In-Memory   │ │    Redis     │ │    Firestore     │
          │   Cache      │ │   (Upstash)  │ │  (Source of      │
          │  5 min TTL   │ │  1 hr cache  │ │   Record)        │
          └──────────────┘ └──────────────┘ └──────────────────┘
                                                     │
                                    ┌────────────────┤
                                    ▼                ▼
                         ┌──────────────┐  ┌──────────────────┐
                         │  Razorpay    │  │ Firebase         │
                         │  Payments    │  │ Functions        │
                         └──────────────┘  │ (TTL Cleanup)    │
                                           └──────────────────┘
```

**Three-tier caching** ensures sub-millisecond redirects:

| Tier | Layer | TTL | Latency |
| :--: | --- | --- | --- |
| 1 | **Edge in-memory** — Process-local cache | 5 min | < 1 ms |
| 2 | **Redis** — Distributed via Upstash | 1 hr (positive) · 2 min (negative) | ~ 5 ms |
| 3 | **Firestore** — Source of record | Permanent until expiry | ~ 50 ms |

> For the full system design, data flows, and caching strategy, see **[Architecture Documentation](Documentation/Architecture.md)**.

---

## Tech Stack

<table>
<tr><td><b>Category</b></td><td><b>Technology</b></td><td><b>Purpose</b></td></tr>
<tr><td rowspan="4">Frontend</td>
<td><a href="https://nextjs.org">Next.js 16</a></td><td>App Router, API routes, edge middleware</td></tr>
<tr><td><a href="https://react.dev">React 19</a></td><td>UI with React Compiler</td></tr>
<tr><td><a href="https://tailwindcss.com">Tailwind CSS 4</a></td><td>Utility-first styling</td></tr>
<tr><td><a href="https://ui.shadcn.com">shadcn/ui</a> + <a href="https://motion.dev">Framer Motion</a></td><td>Component primitives &amp; animations</td></tr>
<tr><td rowspan="3">Backend</td>
<td><a href="https://firebase.google.com/products/auth">Firebase Auth</a></td><td>Google OAuth authentication</td></tr>
<tr><td><a href="https://firebase.google.com/products/firestore">Firestore</a></td><td>Primary database with native TTL</td></tr>
<tr><td><a href="https://firebase.google.com/products/functions">Firebase Functions</a></td><td>Post-TTL counter correction</td></tr>
<tr><td rowspan="2">Infrastructure</td>
<td><a href="https://upstash.com">Upstash Redis</a></td><td>Distributed caching &amp; abuse protection</td></tr>
<tr><td><a href="https://razorpay.com">Razorpay</a></td><td>Payment processing &amp; webhooks</td></tr>
<tr><td rowspan="2">Tooling</td>
<td><a href="https://typescriptlang.org">TypeScript 5</a></td><td>Full-stack type safety</td></tr>
<tr><td><a href="https://zod.dev">Zod</a></td><td>Runtime schema validation</td></tr>
</table>

---

## Plans & Pricing

| Plan | Price (INR) | Active Links | TTL | Custom Alias | API Access |
| :--- | ---: | ---: | :--- | :---: | :---: |
| **Guest** | Free | 1 | 5 min | — | — |
| **Free** | Free | 1 (3 lifetime) | 10 min | — | — |
| **Starter** | 49 | 5 | 2 hr | Yes | — |
| **Pro** | 99 | 25 | 6 hr | Yes | — |
| **Business** | 199 | 100 | 12 hr | Yes | Yes |
| **Enterprise** | 299 | 300 | 24 hr | Yes | Yes |
| **Big Enterprise** | 999 | 600 | 24 hr | Yes | Yes |

> **Cumulative quotas** — Each purchase adds to your total permanently. No subscriptions, no recurring charges.

---

## Getting Started

### Prerequisites

| Requirement | Notes |
| --- | --- |
| **Node.js 18+** | Required |
| **Firebase project** | Auth + Firestore enabled |
| **Upstash Redis** | Recommended for caching & abuse protection |
| **Razorpay account** | Optional — only for payment features |

### Installation

```bash
# Clone the repository
git clone https://github.com/AspiringWebGaurav/xurl.git
cd xurl

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

<details>
<summary><b>Click to expand full .env.local template</b></summary>

```env
# ── App ──────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHORT_DOMAIN=localhost:3000
NEXT_PUBLIC_API_BASE=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development

# ── Firebase Client ──────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# ── Firebase Admin ───────────────────────────────────
FIREBASE_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── Redis (recommended) ─────────────────────────────
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# ── Payments (optional) ─────────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ── Operations ───────────────────────────────────────
CLEANUP_SECRET=your_cleanup_secret
```

</details>

> See the **[Deployment Guide](Documentation/Deployment.md)** for the complete environment variable reference.

### Local Development

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run lint         # Run ESLint
npm run build        # Production build
```

**Optional — Firebase Functions:**

```bash
npm --prefix functions install
npm --prefix functions run build
```

**Optional — Firestore TTL:**

```bash
npm run deploy:ttl
```

---

## Production Deployment

```
1.  Deploy the Next.js app with all environment variables
2.  Apply Firestore rules and indexes     → firebase deploy --only firestore
3.  Deploy TTL configuration              → npm run deploy:ttl
4.  Deploy Firebase Functions             → npm --prefix functions run deploy
5.  Configure Razorpay webhook            → POST /api/payments/webhook
6.  Schedule cleanup cron                 → POST /api/cleanup
7.  Verify health                         → node scripts/health-check.mjs https://your-domain.com
```

> For the complete step-by-step checklist, see the **[Deployment Guide](Documentation/Deployment.md)**.

---

## Project Structure

```
xurl/
├── app/                        # Next.js App Router
│   ├── (legal)/                #   Legal pages (terms, privacy, AUP, refund)
│   ├── api/                    #   16 server-side API endpoints
│   ├── analytics/              #   Analytics dashboard
│   ├── documentation/          #   Developer API docs (modular, scroll-spy)
│   ├── login/                  #   Auth + payment checkout
│   ├── pricing/                #   Plan comparison
│   └── page.tsx                #   Homepage — main shortener UI
│
├── components/                 # React components
│   ├── documentation/api/      #   API docs system (sidebar, TOC, scroll-spy)
│   ├── layout/                 #   Navbar, footer, overlays
│   └── ui/                     #   shadcn/ui primitives
│
├── Documentation/              # Project documentation (11 guides)
├── functions/                  # Firebase Cloud Functions
├── lib/                        # Shared libraries (Firebase, Redis, utils)
├── scripts/                    # Operational & testing scripts
├── services/                   # Business logic layer
├── types/                      # Shared TypeScript interfaces
└── proxy.ts                    # Edge middleware (slug interception)
```

---

## Documentation

Complete documentation lives in the [`Documentation/`](Documentation/) directory:

### Technical

| Document | Description |
| :--- | :--- |
| **[Architecture](Documentation/Architecture.md)** | System design, data flows, caching strategy |
| **[API Reference](Documentation/API.md)** | All endpoints with request/response examples |
| **[Analytics](Documentation/Analytics.md)** | Click tracking pipeline and dashboard features |
| **[Deployment](Documentation/Deployment.md)** | Environment variables, production checklist |
| **[Developer Guide](Documentation/Developer-Guide.md)** | Local setup, project patterns, scripts |
| **[Security](Documentation/Security.md)** | Auth model, abuse protection, SSRF, rate limiting |
| **[Promo Policy](Documentation/Promo-Policy.md)** | Promo types, limits, redemptions, admin rules |

### Legal

| Document | Description |
| :--- | :--- |
| **[Terms of Service](Documentation/Terms-of-Service.md)** | Service terms and conditions |
| **[Privacy Policy](Documentation/Privacy-Policy.md)** | Data collection and usage practices |
| **[Acceptable Use Policy](Documentation/Acceptable-Use-Policy.md)** | Prohibited content and activities |
| **[Refund Policy](Documentation/Refund-Policy.md)** | Billing terms and refund eligibility |

### Operations & Scripts

| Script | Description |
| :--- | :--- |
| `scripts/test-dev-admin.mjs` | Dev/admin E2E: dev mode, promo validation, grants, purchases |
| `scripts/clean_all.mjs` | Flush Redis, delete Firestore collections, reset counters, delete Auth users |
| `scripts/wipe-firestore-all.mjs` | Delete all top-level Firestore collections |
| `scripts/flush-redis.mjs` | Upstash Redis `FLUSHALL` |

> **Warning** — Scripts marked above are destructive. Use only in development/staging environments.

---

## Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/your-feature

# 3. Make changes and verify
npm run lint && npm run build

# 4. Commit and push
git commit -m "feat: describe your change"
git push origin feature/your-feature

# 5. Open a pull request against main
```

### Guidelines

- Follow existing code patterns and TypeScript conventions
- All link creation and plan logic **must** use Firestore transactions
- New API endpoints should include appropriate rate limiting
- URL inputs must pass through `lib/utils/url-validator.ts`
- Plan-related changes must reference `lib/plans.ts` as the single source of truth

---

## License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with care by [Gaurav](https://github.com/AspiringWebGaurav)**

[Live App](https://xurl.eu.cc) &middot; [API Documentation](https://xurl.eu.cc/documentation/api) &middot; [Report Issue](https://github.com/AspiringWebGaurav/xurl/issues)

</div>

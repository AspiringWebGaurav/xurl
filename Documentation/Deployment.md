# Deployment Guide

This guide covers everything needed to deploy XURL to a production environment.

## Prerequisites

- Node.js 18 or later
- A Firebase project with Auth, Firestore, and Cloud Functions enabled
- An Upstash Redis instance
- A Razorpay account (for paid plan checkout)
- A hosting platform that supports Next.js (e.g., Vercel)

## Required Services

| Service | Purpose | Required |
| --- | --- | --- |
| Firebase Auth | Google sign-in | Yes |
| Firestore | Core persistence | Yes |
| Upstash Redis | Caching and abuse protection | Recommended |
| Razorpay | Paid plan checkout | For paid features |
| Firebase Functions | Counter correction after TTL | Recommended |

## Environment Variables

### Public App Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical app URL (e.g., `https://xurl.in`) |
| `NEXT_PUBLIC_SHORT_DOMAIN` | Yes | Domain for generated short URLs |
| `NEXT_PUBLIC_API_BASE` | Yes | Public API base URL |
| `NEXT_PUBLIC_ENVIRONMENT` | Yes | `development`, `production`, or `test` |

### Firebase Client SDK

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |

### Firebase Admin (Server-Side)

| Variable | Required | Description |
| --- | --- | --- |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | Service account private key (escaped newlines are normalized) |

### Redis

| Variable | Required | Description |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Recommended | Primary Redis endpoint |
| `REDIS_URL` | Optional | Alternate URL fallback |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash REST API auth token |

### Payments and Operations

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | For payments | Public Razorpay checkout key |
| `RAZORPAY_KEY_SECRET` | For payments | Server-side Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | For webhooks | Webhook signature verification |
| `CLEANUP_SECRET` | Yes | Bearer token for the cleanup endpoint |

### Validation

`lib/env.ts` validates the public app configuration at startup using Zod. In production, invalid configuration causes a hard failure. In development, fallback defaults are used but real Firebase credentials are still required.

## Production Deployment Checklist

### 1. Deploy the Application

Deploy the Next.js application to your hosting platform with all environment variables configured.

```bash
npm run build
```

### 2. Apply Firestore Rules and Indexes

Deploy security rules and composite indexes to your Firebase project:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 3. Deploy TTL Configuration

Firestore TTL automatically deletes expired documents. Deploy the TTL field overrides:

```bash
npm run deploy:ttl
```

This deploys TTL configuration for:
- `links.expiresAt` - Removes expired short-link documents
- `guest_usage.expiresAt` - Frees guest claim state after expiry

Firestore TTL deletion is asynchronous; records may remain visible briefly after expiry.

### 4. Deploy Firebase Functions

Deploy the `onLinkDeleted` Cloud Function to keep `activeLinks` counters accurate after TTL deletes:

```bash
npm --prefix functions install
npm --prefix functions run build
npm --prefix functions run deploy
```

### 5. Configure Razorpay Webhook

In your Razorpay dashboard, configure the webhook URL:

```
POST https://your-domain.com/api/payments/webhook
```

Set the webhook secret to match your `RAZORPAY_WEBHOOK_SECRET` environment variable.

### 6. Schedule Cleanup

Configure a cron scheduler to call the cleanup endpoint periodically:

```
POST https://your-domain.com/api/cleanup
Authorization: Bearer <CLEANUP_SECRET>
```

Recommended frequency: every 6-12 hours.

The cleanup endpoint performs:
- Analytics pruning (documents older than 90 days)
- In-memory rate limiter cleanup
- Redis click buffer flushing to Firestore

### 7. Verify Deployment

Run the health check script against your production environment:

```bash
node scripts/health-check.mjs https://your-domain.com
```

## Infrastructure Notes

### Redis Availability

Redis is strongly recommended for production. Without Redis:
- Redirect caching falls back to Firestore (higher latency)
- Abuse protection falls back to process-local in-memory limiters
- Click buffering is disabled
- Negative caching (anti-scan defense) is unavailable

The Redis client includes a circuit breaker that retries every 60 seconds after failure.

### Firestore TTL

After deploying TTL configuration:
- Firestore watches `expiresAt` fields and deletes matching documents automatically
- TTL deletion is asynchronous and may take minutes to hours
- The `onLinkDeleted` Cloud Function handles counter correction for authenticated links
- Guest usage cleanup is fully automatic

### Scaling

XURL is designed for serverless deployment:
- Stateless API routes scale horizontally
- Edge proxy uses process-local caching (not shared across instances)
- Redis provides distributed state for multi-instance deployments
- Firestore handles automatic scaling and replication

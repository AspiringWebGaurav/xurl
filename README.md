# XURL — Minimal & Fast URL Shortener

XURL is a modern, blazing-fast, and edge-ready URL shortener designed to be vastly cheaper and more performant than enterprise alternatives.

## 🚀 Main Features
- **Instant Shortening**: Drop a long link, get a short one instantly.
- **Custom Aliases**: Claim memorable slugs (e.g. `xurl.eu.cc/my-campaign`).
- **QR Codes**: Auto-generated QR codes available for every link you create.
- **Link History & Analytics**: Logged-in users can track their historical links.
- **Progressive Plans**:
  - **Guest (No Login)**: 1 Free link (5-minute expiry).
  - **Free Tier**: 5 Links (1-hour expiry). 
  - **Starter & Pro**: Up to 50 active links (12–24 hour TTL).
  - **Business & Enterprise**: Up to Unlimited links, lasting forever.
- **Cumulative Quotas**: Renewing or upgrading plans additively expands your link capacity!
- **Integrated Payments**: Fully automated Razorpay integration for seamless upgrades.

## 💰 Why is it cheaper than alternatives?
Traditional URL shorteners run expensive, always-on servers. XURL is built on a modern, scale-to-zero serverless architecture:
1. **Next.js App Router**: Runs on serverless functions that only charge per actual request.
2. **Upstash Redis**: Handles rate-limiting and quota checking at the edge with microsecond latency, costing fractions of a cent per million reads.
3. **Firebase Firestore**: Stores long-term data like user plans and transaction logs cleanly and securely, leveraging generous free tiers.
4. **No Idle Server Costs**: You don't pay for idle time, making the operational cost nearly zero for low traffic, and perfectly linear for high traffic.

## 🛠 Tech Stack
- **Framework**: Next.js 14 App Router + React
- **Styling**: Tailwind CSS + Framer Motion
- **Database**: Firebase Firestore (users, transactions)
- **Caching/Rate-Limiting**: Upstash Redis (links, quotas)
- **Auth**: Firebase Auth (Google Sign-In)
- **Payments**: Razorpay Node SDK

---

> **Note**: For full terms, privacy, and acceptable use policies, please refer to the live application's footer. Documentation is kept exclusively in this repository.

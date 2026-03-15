# Promo & Admin Feature Policy

## Promo Codes
- **Types:** `percentage`, `fixed`, `free_plan` (grants plan access without charge).
- **Scope:** Promos may be restricted to specific plans. Free-plan promos must declare a target plan.
- **Limits:**
  - **Total limit:** Optional cap on total redemptions.
  - **Per-user limit:** Optional cap per user; enforced via promo redemptions.
- **Expiry:** Optional expiry timestamp; expires automatically.
- **Redemptions:** Each successful application creates a `promo_redemptions` record and increments `usageCount/redemptionCount`.
- **Validation:** Performed server-side in `/api/payments/create-order` and promo services before order creation or dev-mode simulation.
- **Admin-only:** Create/update/delete/list/redemptions are gated by admin email and admin API routes.

## Developer Mode (Dev-only)
- **Toggle:** `/api/dev/developer-mode` (admin dev email only, dev environment only).
- **Behavior:** Simulates successful payments with `source=developer_mode`; Razorpay is not called in dev mode.
- **Safety:** Production remains unchanged; keys are never exposed.

## Admin Plan Grants
- **Endpoint:** `/api/admin/grant-plan` (admin-only).
- **Behavior:** Applies plan with custom duration and `source=admin_grant`, amount ₹0.
- **Audit:** Transactions logged with source; shows in purchase history.

## Purchase History
- **Sources:** Displays `razorpay`, `developer_mode`, `admin_grant` and amounts.

## Operations
- **Cleanup scripts:**
  - `scripts/clean_all.mjs` — flush Redis, delete key Firestore collections, reset counters, delete Auth users (destructive).
  - `scripts/wipe-firestore-all.mjs` — delete all top-level Firestore collections (destructive).
  - `scripts/flush-redis.mjs` — Upstash Redis FLUSHALL (destructive).
- **Tests:** `scripts/test-dev-admin.mjs` exercises dev mode, promos (including per-user limits and free_plan), admin grants, and transactions/redemptions.

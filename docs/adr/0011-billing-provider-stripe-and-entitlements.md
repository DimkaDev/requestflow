# ADR-0011: Billing Provider Architecture, Declarative Entitlements & 7-Day Dunning Grace Period

- **Status:** Accepted
- **Date:** 2026-11-14
- **Decisions Covered:** `DEC-02`, `E3-Step-1` to `E3-Step-9`

## 1. Context

FlowTrace requires a commercial subscription and entitlements engine to monetize its 4 universal tiers (`FREE`, `PRO` \$29/mo, `BUSINESS` \$99/mo, `ENTERPRISE` \$299/mo) across both microservice topology teams and live e-commerce storefronts:
1. We need to evaluate **Stripe Billing** against a **Merchant of Record (Paddle / Lemon Squeezy)** for an EU/Belgium operator (`DEC-02`), while ensuring local development and CI tests run with zero external secrets.
2. Plan limits (`monthlyEventQuota`, `softCapMultiplier`, `maxRetentionDays`, `maxSeats`, `maxBlocksPerProject`, `maxEdgesPerProject`, `allowedPacks`) and prices must come from a single declarative `EntitlementsService` (`GET /api/v1/billing/plans`).
3. Paid customers must never suffer sudden traffic drops at 100.1% of their monthly event quota or surprise overage bills, nor lose project diagrams if a card renewal fails.

## 2. Decisions

### 2.1 `DEC-02`: `BillingProviderPort` with Stripe (`stripe`) + Local Sandbox (`sandbox`) Adapters
- **Comparison (Stripe Billing vs Merchant of Record):**
  - *Stripe Billing + Stripe Tax*: lower transaction fees (~1.5% + €0.25 for EU cards vs 5% + \$0.50 on MoRs), first-class webhook reliability (`Stripe-Signature` `t=...,v1=...` `HMAC-SHA256`), native B2B EU VAT ID collection with reverse-charge support, and instant Customer Portal sessions.
  - *Merchant of Record (Paddle / Lemon Squeezy)*: acts as reseller of record for global B2C VAT, but charges ~2x–3x higher fees and has more restrictive B2B invoicing customization.
- **Decision:** We adopt **Stripe Billing** as the primary production provider behind a pure outbound port `BillingProviderPort`, paired with a built-in **`LocalSandboxBillingAdapter`** (`provider = "sandbox"`, active by default when `flowtrace.billing.stripe.secret-key` is not set). The sandbox adapter executes the exact same domain state machine, idempotency table, HMAC signature verifier, invoice ledger, and 7-day dunning workflow locally and in automated tests.

### 2.2 Unified 4-Tier Declarative Catalog (`EntitlementsService`)
- All plan quotas, prices (Monthly and Annual `-20%`), editor limits, and feature lists are centralized in `PlanTier` + `EntitlementsService` and exposed via `GET /api/v1/billing/plans`.
- Supported promo codes (`LAUNCH20` for 20% off, `FLOW50` for 50% off) and EU B2B VAT ID validation (`^[A-Z]{2}[0-9A-Z]{8,12}$`) are handled in the domain layer.

### 2.3 120% Soft-Cap Buffer & 7-Day Dunning Grace Period
- **Quota Enforcement:**
  - `FREE`: hard stop at `100%` of `monthlyEventQuota` (`100,000` events/month).
  - Paid plans (`PRO`, `BUSINESS`, `ENTERPRISE`): soft-cap alerts at `80%` and `100%`, with a **120% buffer** (`softCapMultiplier = 1.20`) before hard-stopping ingestion. No automatic overage charges are billed.
- **7-Day Dunning Grace Period (`PAST_DUE`):**
  - When `invoice.payment_failed` arrives via `POST /api/v1/webhooks/billing`, the subscription status transitions to `PAST_DUE` with `grace_period_ends_at = now + 7 days`.
  - During the 7-day window, the organization retains its paid plan limits while displaying a prominent warning banner in `/billing`.
  - If unpaid after `grace_period_ends_at`, `BillingService.expirePastDueSubscriptions()` downgrades the organization to `FREE` (`status = CANCELED`) without deleting any projects, diagrams, or historical traces.

### 2.4 Webhook Idempotency
- Every incoming webhook event ID (`evt_...`) is recorded in `billing_webhook_events(event_id PRIMARY KEY, organization_id, event_type, processed_at)`. Duplicate deliveries of the same `event_id` return `200 OK` (`duplicate = true`) without re-mutating state or creating duplicate invoices.

## 3. Consequences

- **Positive:** Zero external secret dependencies for local/CI verification; full cryptographic `Stripe-Signature` verification in both sandbox and production; predictable no-surprise billing for customers.
- **Negative:** Maintaining subscription and invoice metadata in PostgreSQL (`V8__billing_subscriptions_and_invoices.sql`) requires an `Admin Resync` endpoint (`POST /api/v1/organizations/{orgId}/billing/resync`) to reconcile state if webhooks are delayed.

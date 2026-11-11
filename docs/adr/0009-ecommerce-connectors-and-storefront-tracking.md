# ADR-0009: E-Commerce Connectors, Webhook Mapping, and Storefront Tracking

## Status
Accepted

## Context
FlowTrace has completed Gate G1-S (the public Live Shop demo with entity avatars and cart payloads). To progress towards Gate G1-E and G2-S (real storefront traffic without waiting for full app-store approval processes), merchants and developers need two frictionless connectivity options:
1. **Storefront JavaScript Tracker (`flowtrace.js`):** A lightweight (< 4KB), zero-dependency client script embeddable on any website or e-commerce storefront (Shopify liquid, WooCommerce themes, Medusa, custom headless React/Next.js/Vue stores). It emits non-blocking beacon events (`visit`, `browse`, `product`, `cart`, `checkout`) with session-scoped pseudonymization and zero cookie/IP persistence (adhering to DEC-11 and DEC-13).
2. **Generic Incoming Webhook Receiver with Field Mapping:** An HTTP endpoint (`POST /api/v1/connectors/webhook/{token}`) that receives raw webhooks from Shopify, WooCommerce, Stripe, or custom backend services, applies configurable field mapping (JSONPath/property extraction), and transforms them into standard FlowTrace Protocol v1.1 checkpoint events.
3. **Connector Registry & Health Monitor:** Persistent connector tracking with operational status (`connected`, `waiting`, `error`), last event timestamp, and event throughput counters.

## Decision
1. **Domain Layer (`dev.flowtrace.domain`):**
   - Create pure Java 21 models (0 framework imports):
     - `ConnectorType`: `STOREFRONT_JS`, `GENERIC_WEBHOOK`, `SHOPIFY_WEBHOOK`, `WOOCOMMERCE_WEBHOOK`, `STRIPE_WEBHOOK`.
     - `ConnectorStatus`: `WAITING`, `CONNECTED`, `ERROR`.
     - `WebhookMapping`: extraction rules for `traceId`, `node`, `entityRef`, `entityName`, `avatar`, `items`, `totalAmount`, `status`.
     - `ConnectorConfig`: project association, secret token hash, mapping rules, counters, and timestamps.
     - `StorefrontPayload`: normalized client-side payload from `flowtrace.js`.

2. **Persistence & Flyway Migration (V5):**
   - Create `V5__connectors.sql`:
     - Table `project_connectors`: `id`, `project_id`, `name`, `connector_type`, `token_prefix`, `token_hash`, `mapping_json`, `status`, `last_event_at`, `total_events`, `last_error`, `created_at`, `updated_at`.
   - Implement `ConnectorRepository` and `JdbcConnectorRepository` ensuring strict tenant/project scoping.

3. **Inbound HTTP Adapters:**
   - `ConnectorResource`:
     - `GET /api/v1/projects/{id}/connectors`: list project connectors.
     - `POST /api/v1/projects/{id}/connectors`: create or configure a connector.
     - `POST /api/v1/projects/{id}/connectors/{connectorId}/test`: test mapping on a sample JSON payload.
     - `POST /api/v1/connectors/webhook/{token}`: public ingest endpoint for incoming webhooks with secret token validation and payload transformation to `IngestEventUseCase`.
     - `GET /flowtrace.js`: lightweight tracking library serving minified vanilla JavaScript.

4. **Storefront JS Tracker (`flowtrace.js`):**
   - Self-initializing global `window.FlowTrace`.
   - Method `FlowTrace.track(node, data)` using `navigator.sendBeacon` with `fetch(..., { keepalive: true })` fallback.
   - Generates session-scoped UUIDv7/random IDs in memory (`sessionStorage`), avoids tracking cookies, and transmits no raw IPs or sensitive payment card data.

5. **Angular Frontend Integration:**
   - Dedicated "Store Connectors" tab / panel in Project Settings:
     - Storefront Snippet generator with active key pre-filled.
     - Webhook presets (Shopify Orders, WooCommerce Webhooks, Stripe Payments, Custom JSON).
     - Interactive Test Bench to paste sample JSON and view real-time mapping transformation.
     - Status badges (`Connected`, `Waiting`, `Error`) with last event timestamps.

## Consequences
- **Positive:**
  - Merchants can connect any existing store in under 5 minutes without waiting for official Shopify/WooCommerce App Store reviews.
  - Full compatibility with Gate G1-S avatars, cart trails, and revenue counters.
  - GDPR/ePrivacy compliant by design (no third-party cookie persistence, no raw IP retention).
- **Negative / Trade-offs:**
  - Dynamic JSON property extraction requires defensive parsing for malformed webhook bodies.

# ADR-0006: Business Flows, Entity Tokens and Carried Payloads ("Live Shop" Extension)

## Status
Accepted

## Context
FlowTrace MVP provides an animated, real-time token visualization for microservices and technical request routing (`spec.md` sections 5–10). In microservice mode, tokens are anonymous dots identified by `traceId`, traversing services (`node` to `node`).

For commercial business workflows (online shops, restaurant orders, delivery tracking, appointment bookings, support funnels per `docs/TASKS_v2.md`), business owners need to visualize:
1. **Identifiable Customer Entities:** A visitor is represented by an entity persona (`avatar` such as animal avatar or customer badge, `label`, and client `ref`), rather than an anonymous dot.
2. **Carried Payloads (`carry`):** As the customer moves through funnel steps (`visit -> browse -> product -> cart -> checkout -> payment -> paid`), they accumulate carried items (candles, coffee, apparel) with quantities, prices, currency, and icons.
3. **Business Terminal Outcomes:** Beyond technical `enter` and `error`, business steps finish with:
   - `complete` (order placed and paid),
   - `fail` (payment failed),
   - `abandon` (cart abandoned, customer leaves).
4. **Live Business Metrics & Privacy:** The server computes aggregates (active visitors, carts, sales, revenue today, conversion) while ensuring client identifiers (`ref`) are never exposed in cleartext (pseudonymized with project salt per E23-01).

## Decision

1. **Protocol Extension to v1.1 (Backward Compatible):**
   - The event payload is extended with optional fields `"entity"` and `"carry"`.
   - When `"entity"` is omitted, the engine defaults to standard microservice mode (anonymous token dot).
   - `EventType` gains three business terminal statuses: `complete`, `fail`, `abandon` (alongside `enter`, `error`, `end`).
   - Limits: $\le 20$ items per carry event, $\le 50$ items per trace, item `label` $\le 60$ chars, `icon` $\le 200$ chars.

2. **Server-Side Carry State in `TraceState`:**
   - In-memory `TraceState` (`HopResolver`) maintains a `CarryState` for the active trace (with same 30s idle expiry):
     - `set`: replaces carried items,
     - `add`: adds new items or increments quantity if `sku` matches,
     - `remove`: decrements quantity or removes item,
     - `clear`: empties carried items.
   - Computes a lightweight `CarrySummary` (`count`, `total`, `currency`, `topIcons`) attached to emitted `UiEvent.SpawnEvent`, `UiEvent.HopEvent`, and dedicated `UiEvent.CarryEvent`.

3. **Hexagonal Architecture Discipline:**
   - All models (`EntityInfo`, `CarryItem`, `CarryOp`, `CarryPayload`, `CarrySummary`) reside strictly in `dev.flowtrace.domain` as pure Java 21 records with zero framework dependencies.
   - Non-blocking live ingest path is preserved: carry state transitions operate in-memory on the existing trace state map without additional I/O or blocking locks.

## Consequences

### Positive
- Allows immediate visualization of customer shopping carts and business funnels alongside technical traces.
- Enables rich business KPI calculations (revenue, cart count, conversion rate) in real time.
- Fully backward compatible: existing v1 producers (Java SDK, simulator, cURL) continue working without changes.

### Neutral
- Emitted UI event payloads include an optional `carry` and `entity` object, slightly increasing WebSocket payload size when business flows are active.

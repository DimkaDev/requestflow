# FlowTrace — Live Request Flow Visualizer

> **Working name:** FlowTrace (change in one place: `docs/BRANDING.md` + `app.name` config).
> **Audience:** autonomous coding agent (Codex / Antigravity). Build it milestone by milestone (section 17).
> **Status:** spec v0.1.

---

## 1. Product in one paragraph

FlowTrace shows **how requests travel through a system, live and animated**. A developer drops a one-line *checkpoint* call into their code (or sends a UDP/TCP/HTTP message). Each request carries a **trace UUID**. FlowTrace receives checkpoint events and renders them on an n8n-style diagram: blocks connected by lines, and a small glowing dot that travels along the line from one block to the next every time a request moves. Branching (`if` → path A / path B) is visible because dots take different lines.

**The "wow" is the UI.** It must look polished, dark, smooth, and alive.

## 2. Goals / Non-goals

**Goals (MVP)**
- Ingest checkpoint events over **HTTP, UDP, TCP**.
- Live diagram with animated tokens moving between blocks (WebSocket-driven).
- Diagram editor (drag/drop nodes, connect with lines) + auto-discovery of edges from traffic.
- Persistence + replay of past traces.
- Built-in **demo simulator** so the UI is alive without any client integration.
- Deploy on **AWS** with IaC.

**Non-goals (MVP)**
- Full distributed tracing (OpenTelemetry replacement), span timing analytics, log search.
- Billing, teams/RBAC beyond owner-only projects.
- Mobile apps.

## 3. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Project** | A workspace holding one diagram, API keys, and traces. |
| **Diagram** | Graph of **Nodes** and **Edges** (versioned JSON). |
| **Node** | A block (e.g. `website`, `load-balancer`, `if-premium`, `service-a`). Has a stable string `key` used by checkpoints. |
| **Edge** | A directed line between two nodes. |
| **Trace** | One request's journey, identified by `traceId` (UUID, v7 recommended). |
| **Checkpoint / Event** | "Trace T is now at node N." Sent by client code. |
| **Hop** | Derived movement of a trace from node A → node B. One hop = one token animation along an edge. |
| **Token** | The animated dot representing a trace on the canvas. |
| **Branch** | Optional sub-path name for parallel work inside one trace (default `main`). |

## 4. Architecture overview

```
 Client code / SDK ──HTTP──▶ ┐
                   ──UDP───▶ ├─▶ [Ingest adapters] ─▶ [Ingest pipeline] ─▶ [EventFanout] ─▶ [WebSocket] ─▶ Angular UI
                   ──TCP───▶ ┘        (Quarkus)      validate · auth · rate-limit      │
                                                      hop resolution (TraceState)      └─▶ [Async batch writer] ─▶ PostgreSQL
```

- **Backend:** Java 21, Quarkus (current LTS), Maven, Vert.x (included in Quarkus) for UDP/TCP servers, Quarkus WebSockets Next for the UI stream, Flyway + PostgreSQL, Micrometer metrics.
- **Frontend:** latest stable Angular (standalone components, signals, new control flow), TypeScript strict.
- **Style:** Clean/Hexagonal architecture. `domain` has no framework imports. Adapters (HTTP, UDP, TCP, WS, DB) depend inward only.
- **Decisions to record as ADRs** (`docs/adr/NNNN-*.md`, short, Context/Decision/Consequences): rendering approach, realtime transport, event-fanout strategy, IaC tool, auth provider, ID format.

### 4.1 Backend module layout

```
backend/
  domain/            # Trace, Hop, Diagram, Node, Edge, ApiKey, events; pure Java
  application/       # use cases: IngestEvent, ResolveHop, CreateTrace, SaveDiagram, ReplayTrace...
  adapter-in-http/   # REST controllers
  adapter-in-udp/    # Vert.x DatagramSocket server
  adapter-in-tcp/    # Vert.x NetServer, newline-delimited JSON
  adapter-in-ws/     # WebSocket stream to UI
  adapter-out-pg/    # persistence (Flyway migrations, repositories)
  adapter-out-fanout/# EventFanout implementations (in-JVM now, Redis later)
  app/               # Quarkus bootstrap, config, wiring
```
Single deployable (`app`). Multi-module Maven is fine; keep it simple if the agent prefers a single module with strict package boundaries (decide in ADR-0001).

## 5. Ingestion protocols

All protocols feed the **same pipeline** and use the **same event schema** (section 6).

### 5.1 HTTP (primary, easiest, ACK'd)
- `POST /api/v1/events` — body is one event or an array (max 100).
- Auth: header `X-API-Key: <ingest key>`.
- Response: `202 Accepted` `{"accepted": n, "rejected": [{"index":0,"reason":"..."}]}`.
- `POST /api/v1/traces` — server-generated trace ID: `{"traceId":"<uuid>"}`. Optional; clients may generate their own UUID (recommended: UUIDv7, no round trip).

### 5.2 UDP (fire-and-forget, lowest overhead)
- One datagram = one JSON event or JSON array; **≤ 1200 bytes** (avoid fragmentation).
- API key is inside the message (`"key"` field). No ACK, no response, ever.
- Invalid/unauthorized datagrams are silently dropped but **counted** (`ingest_dropped_total{protocol,reason}`).
- Default port `9001/udp`.

### 5.3 TCP (persistent connection, optional ACK)
- Newline-delimited JSON (`\n`), UTF-8, one event or array per line.
- First message may be a handshake: `{"type":"hello","key":"...","ack":true}` → server replies `{"type":"hello_ok"}` or `{"type":"error","reason":"..."}` and closes.
- After handshake the `"key"` field is not needed per event.
- `ack:false` (default): no per-event response. `ack:true`: if event has `"seq": N`, server replies `{"ack":N}`; on reject `{"nack":N,"reason":"..."}`.
- Idle timeout 60s, max line 8 KB, max 100 connections per key.
- Default port `9000/tcp`.

### 5.4 Limits & protection (all protocols)
- Max event size: HTTP 4 KB, UDP 1200 B, TCP 4 KB.
- `attrs`: ≤ 10 keys, string/number/bool values, value ≤ 100 chars.
- Rate limit per key: token bucket, default **1000 events/s**, burst 2000, configurable per key.
- Back-pressure: bounded queues; when full → drop newest + increment metric (never block the ingest thread, never OOM).

## 6. Event schema (v1)

```json
{
  "v": 1,
  "key": "ft_live_xxx",
  "traceId": "0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11",
  "node": "service-a",
  "from": "load-balancer",
  "type": "enter",
  "branch": "main",
  "ts": 1760000000000,
  "label": "route=A",
  "attrs": { "tier": "pro", "region": "eu" },
  "seq": 42
}
```

| Field | Req | Notes |
|---|---|---|
| `v` | no | schema version, default 1 |
| `key` | UDP/TCP* | ingest API key (HTTP uses header). *TCP only before handshake. |
| `traceId` | **yes** | UUID string |
| `node` | **yes** | target node `key` (`[a-z0-9-_.]{1,64}`) |
| `from` | no | explicit source node; otherwise derived (6.1) |
| `type` | no | `enter` (default) \| `error` \| `end` |
| `branch` | no | default `main`; use for parallel sub-paths of one trace |
| `ts` | no | client epoch ms; **server receive time is authoritative for ordering**, `ts` kept as metadata |
| `label` | no | short text (≤ 40 chars) shown on the token tooltip / edge |
| `attrs` | no | small key/value map for the trace inspector |
| `seq` | no | client sequence number, used for TCP ACK |

### 6.1 Hop resolution rules (server side, `ResolveHop` use case)
`TraceState` = last known node per `(projectId, traceId, branch)`, held in a Caffeine cache with expiry (default 30 s idle).

1. If `from` is present → hop `from → node`.
2. Else if TraceState has a last node → hop `last → node`.
3. Else → **spawn** at `node` (token appears at the node with a fade-in; no edge animation).
4. Update TraceState to `node`.
5. If hop edge `from → node` **does not exist** in the diagram:
   - project `autoDiscover = true` (default for new projects): create the edge, mark `discovered: true` (dashed amber line), notify UI;
   - else: emit hop with `edgeId = null` flagged `unmapped`; UI shows a dashed "ghost" transition and a warning badge.
6. If `node` does not exist: same logic (auto-create node at an auto-layout position when `autoDiscover`).
7. `type = error` → hop is emitted with `status = "error"` (red token, node flashes red).
8. `type = end` or idle timeout → emit `end` (token fades out at its current node).
9. Idempotency: ignore exact duplicates of `(traceId, branch, seq)` within 10 s when `seq` is present.

## 7. Real-time stream to the UI

**Transport:** WebSocket `GET /ws/v1/projects/{projectId}/stream` (Quarkus WebSockets Next). ALB supports WebSocket natively. (SSE is an acceptable fallback; record in ADR.)

**Auth:** UI session JWT (see section 11) passed as `Sec-WebSocket-Protocol` bearer or short-lived ticket obtained from `POST /api/v1/projects/{id}/ws-ticket`. Never put long-lived secrets in the URL.

**On connect** server sends a `snapshot`:
```json
{"t":"snapshot","diagram":{...},"active":[{"traceId":"...","branch":"main","node":"service-a"}],"stats":{...},"serverTime":1760000000000}
```
**Then streams:**
```json
{"t":"spawn","traceId":"...","branch":"main","node":"website","ts":...}
{"t":"hop","traceId":"...","branch":"main","from":"website","to":"load-balancer","edgeId":"e1","status":"ok","label":"route=A","ts":...,"seq":1201}
{"t":"end","traceId":"...","branch":"main","node":"db","ts":...}
{"t":"diagram_patch","ops":[{"op":"addEdge","edge":{...}}]}
{"t":"stats","windowMs":1000,"nodes":{"service-a":{"in":12}},"edges":{"e1":{"hops":12,"errors":0}}}
{"t":"dropped","count":37}
```
- `stats` every 1 s (counters drive node badges and edge "heat").
- Per-session bounded send buffer; if the client is slow → drop oldest hop events, send `dropped`, never block other sessions.
- UI auto-reconnects with exponential backoff; on reconnect receives a fresh `snapshot`.

**Fanout abstraction:** `EventFanout` interface (`publish(projectId, UiEvent)`, `subscribe(projectId)`).
- MVP implementation: in-JVM (Vert.x event bus). **Run exactly 1 task in AWS for MVP** (NLB spreads UDP/TCP across tasks, so a WS client on task A would miss events ingested on task B).
- Phase 2 implementation: Redis pub/sub (ElastiCache). Do not leak implementation details into `application`.

## 8. Data model (PostgreSQL)

Flyway migrations. Use `uuid` PKs, `timestamptz` everywhere.

```
users(id, external_id /*cognito sub*/, email, created_at)
projects(id, owner_id, name, auto_discover bool default true, retention_days int default 7, created_at)
api_keys(id, project_id, name, key_prefix, key_hash /*sha256*/, rate_limit_per_s, created_at, last_used_at, revoked_at)
diagrams(id, project_id, version int, graph jsonb, created_at)        -- latest = max(version); keep last 20
traces(id /*traceId*/, project_id, started_at, last_event_at, ended bool, status, event_count)
trace_events(id bigserial, project_id, trace_id, branch, from_node, node, type, label, attrs jsonb, client_ts, server_ts, seq)
   -- PARTITION BY RANGE (server_ts) daily; drop partitions older than retention_days (scheduled job)
```
- Writes are **async + batched** (flush every 250 ms or 500 events). The live path must never wait for the DB.
- API key format: `ft_live_<32 url-safe random chars>`; show full key **once**; store only prefix + SHA-256 hash; cache validated keys in memory (60 s TTL) with revocation eviction.

### Diagram graph JSON
```json
{
  "schema": 1,
  "direction": "TB",
  "nodes": [
    {"key":"website","label":"Website","type":"source","x":0,"y":0,"icon":"globe"},
    {"key":"lb","label":"Load Balancer","type":"service","x":0,"y":160},
    {"key":"if-premium","label":"Premium?","type":"decision","x":0,"y":320},
    {"key":"service-a","label":"Service A","type":"service","x":-180,"y":480},
    {"key":"service-b","label":"Service B","type":"service","x":180,"y":480},
    {"key":"db","label":"Database","type":"datastore","x":0,"y":640}
  ],
  "edges": [
    {"id":"e1","from":"website","to":"lb"},
    {"id":"e2","from":"lb","to":"if-premium"},
    {"id":"e3","from":"if-premium","to":"service-a","label":"yes"},
    {"id":"e4","from":"if-premium","to":"service-b","label":"no"},
    {"id":"e5","from":"service-a","to":"db"},
    {"id":"e6","from":"service-b","to":"db"}
  ]
}
```
Node `type` ∈ `source | service | decision | datastore | queue | external | end` (affects icon/shape/colour only).

## 9. REST API (UI + management)

All under `/api/v1`, JSON, JWT-protected except ingest endpoints (API key). OpenAPI generated via `quarkus-smallrye-openapi`; UI client may be generated from it.

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/projects` | list / create (creates default sample diagram) |
| GET/PATCH/DELETE | `/projects/{id}` | read / update (name, autoDiscover, retention) / delete |
| GET/PUT | `/projects/{id}/diagram` | get latest / save new version |
| GET | `/projects/{id}/diagram/versions` | history |
| GET/POST | `/projects/{id}/keys` | list / create key (full key returned once) |
| DELETE | `/projects/{id}/keys/{keyId}` | revoke |
| GET | `/projects/{id}/traces?from&to&status&node&limit&cursor` | search traces |
| GET | `/projects/{id}/traces/{traceId}` | full event timeline |
| POST | `/projects/{id}/ws-ticket` | short-lived WS ticket |
| POST/DELETE | `/projects/{id}/demo` | start / stop simulator (body: `rate`, `errorRate`) |
| POST | `/events`, `/traces` | **ingest** (API key) |
| GET | `/q/health`, `/q/metrics` | ops (not public) |

## 10. Frontend (Angular) — the part that must look great

### 10.1 Screens
1. **Login** (Cognito hosted UI / OIDC redirect).
2. **Projects** list + "New project" (starts with the sample diagram + demo running).
3. **Live view** (main screen): full-screen canvas, top bar, right inspector drawer.
4. **Editor mode** (toggle on the same canvas): palette, drag/connect/rename/delete.
5. **Traces / Replay**: list + timeline scrubber that re-plays a stored trace (or a time window) on the canvas.
6. **Project settings**: API keys, ingest endpoints, **copy-paste snippets** (curl, Java SDK, netcat/UDP) pre-filled with the project's key, auto-discovery toggle, retention.

### 10.2 Canvas & rendering
- Pan (drag), zoom (wheel/pinch), fit-to-screen, optional minimap, subtle dotted grid background.
- **Nodes:** rounded cards (radius 14), icon + label, status ring, live counter badge (events/s or total), soft shadow; `decision` nodes are diamond or card with a branch icon; selected node gets an accent outline.
- **Edges:** smooth bezier curves, arrowhead, optional label chip at the midpoint, thin neutral colour at rest; **heat**: brightness/width increases with recent hop rate (from `stats`).
- **Rendering approach (decide in ADR, default recommendation):** SVG for nodes/edges + a single `requestAnimationFrame` loop that moves tokens along edge `SVGPathElement` using `getPointAtLength()`. Candidate library for node dragging/connection: **Foblex Flow** (Angular-native); fallback: custom SVG + `d3-zoom`. Layout: `elkjs` or `dagre` (top-to-bottom default). If > ~300 concurrent tokens are required, move tokens to a Canvas 2D overlay layer.
- Keep rendering logic framework-light (plain TS classes + signals) so it is unit-testable.

### 10.3 Animation spec (exact behaviours)
| Event | Animation |
|---|---|
| `spawn` | token fades/scales in at node (200 ms), node does a soft pulse ring |
| `hop` | token travels along the edge path; duration = `clamp(600ms / speed, 250ms, 1500ms)`; ease-in-out; leaves a fading **trail** (~600 ms) along the traversed segment; on arrival: node pulse (scale 1 → 1.05 → 1, 300 ms) and counter ticks up |
| `hop` with `status=error` | red token; on arrival node flashes red + small shake (200 ms) |
| `hop` unmapped (no edge) | dashed ghost line drawn from A to B for the hop's duration, amber token, warning badge on target |
| `end` | token shrinks/fades out (300 ms); optional "completed" tick on node |
| `diagram_patch: addEdge` | edge draws itself (stroke-dashoffset, 400 ms), dashed amber until user "accepts" it in editor |

- Token: circle r≈6 px, accent gradient (cyan → violet), glow via SVG filter (`feGaussianBlur`) or CSS `drop-shadow`. Colour by status: ok = accent, error = red, discovered/unmapped = amber.
- Several traces on the same edge at once must be visible as separate tokens (slight stagger so they don't overlap perfectly).
- **Catch-up logic:** keep a per-`(trace, branch)` queue. If events arrive faster than animation durations, shorten durations (down to 150 ms) so a token never lags real time by more than ~2 s. Setting: `Realtime` (default) vs `Smooth` (no speed-up, may lag).
- **Overload:** cap visible tokens (default 300). Beyond cap, don't render individual tokens; pulse the edge proportionally instead and show "sampling" chip.
- Respect `prefers-reduced-motion` (replace travel with a simple edge highlight).
- Tab hidden → pause animation loop, drop queued hops older than 5 s on return.

### 10.4 Controls & inspector
- Toolbar: Live/Paused, speed 0.25×–4×, realtime/smooth, show labels, show counters, fit view, editor toggle, theme.
- Click a token/node/edge → drawer: node key (copy button — this is the string used in code), in/out counters, last 20 traces through it; click a trace → highlight its path and show timeline with timestamps, labels, attrs.
- Search box: filter/highlight by `traceId` prefix.

### 10.5 Editor
- Palette: node types. Drag from palette → canvas. Drag from a node's output port to another node's input port → edge.
- Inline rename; **node `key` is auto-slugified from label, editable, unique**, with a warning that changing it breaks existing checkpoints.
- Undo/redo (last 50 ops), multi-select, delete, auto-layout button, import/export JSON.
- Save = `PUT /diagram` (new version). Autosave debounce 1.5 s with "Saved" indicator. Discovered edges can be accepted/rejected.

### 10.6 Visual design
- Dark theme default (n8n / Linear-like), light theme supported. All colours/spacing/radii as CSS variables (design tokens) in one file.
- Font: Inter (or system fallback). Accent: cyan→violet gradient. Neutral greys slightly blue-tinted.
- Empty state for a new project is **never empty**: sample diagram + running demo.
- Responsive: usable on tablet; phone = view-only live mode.
- Accessibility: keyboard navigation for nodes, visible focus, ARIA labels, contrast AA.
- Test hooks: tokens render with `data-token-id`, `data-trace-id`, `data-edge-id`; nodes with `data-node-key` (used by e2e).

## 11. Auth & security
- **UI auth:** Amazon Cognito (OIDC) via `quarkus-oidc`; Angular uses Authorization Code + PKCE. (Record in ADR; Keycloak is the alternative.)
- **Ingest auth:** API keys (section 8). Ingest keys are **write-only** — they cannot read data.
- Multi-tenant isolation: every query scoped by `project_id` that belongs to the authenticated user; enforce in the application layer, covered by tests.
- Input validation on every adapter; reject oversized payloads early; strict JSON parsing (no unknown-field crashes, ignore unknown fields).
- UDP spoofing note: UDP is unauthenticated by nature — the key in the datagram is a shared secret, acceptable for MVP; document that TCP/HTTP over TLS is preferred for sensitive environments. Optional later: HMAC signature field.
- TLS: HTTPS/WSS everywhere via ALB + ACM. TCP ingest: plain on `9000` for MVP, TLS listener on NLB as Phase 2.
- No PII guidance in docs: `attrs` must not contain secrets; add a UI warning.
- CORS restricted to the frontend origin. Security headers via CloudFront response policy.
- Secrets in AWS Secrets Manager / SSM, never in the repo.

## 12. Client integration (SDK + snippets)

**Java client** module `client-java` (zero heavy deps, Java 11+):

```java
FlowTrace ft = FlowTrace.builder()
    .endpoint("udp://ingest.flowtrace.example:9001")   // or tcp://…:9000, https://…/api/v1
    .apiKey(System.getenv("FLOWTRACE_KEY"))
    .build();

String traceId = ft.newTrace();                 // UUIDv7, no network call
ft.checkpoint(traceId, "website");
ft.checkpoint(traceId, "load-balancer");
ft.checkpoint(traceId, "if-premium", Map.of("tier", "pro"));
ft.checkpoint(traceId, "service-a");
ft.error(traceId, "db", "timeout");
ft.end(traceId);
```
Requirements: **never blocks and never throws into the host app**; bounded in-memory queue (drop + counter when full); background batching for HTTP/TCP; automatic reconnect for TCP; `close()` flushes. Also provide a `FlowTraceContext` helper (ThreadLocal / `ScopedValue`) so `ft.checkpoint("node")` works without passing `traceId` around. Interface `Transport` with `HttpTransport`, `UdpTransport`, `TcpTransport`.

Also publish in docs (and show in UI settings page): `curl` example, `netcat` UDP example (`echo '{...}' | nc -u -w0 host 9001`), and a minimal Node/Python snippet. Other SDKs are future work.

## 13. Demo simulator (must-have)
- Backend component `DemoSimulator` that injects synthetic traces through the **real ingest pipeline** (not directly into the UI) for the project's current diagram.
- Walks the graph from source nodes; at `decision` nodes picks outgoing edges by configurable weights (default equal); random per-hop delay 80–600 ms; configurable `ratePerSecond` (default 2), `errorRate` (default 3 %).
- `POST /projects/{id}/demo` start, `DELETE` stop; auto-stops after 15 min; UI has a "Demo" toggle.
- A standalone CLI mode (`java -jar simulator.jar --url … --key … --rate 50 --protocol udp`) for load tests.

## 14. AWS infrastructure
Region default `eu-west-1` (configurable; user is in Belgium).

| Concern | Service |
|---|---|
| Frontend | S3 (private) + CloudFront (OAC), SPA fallback to `index.html` |
| API + WebSocket | ECS Fargate service behind **ALB** (HTTPS, WS enabled, idle timeout ≥ 300 s) |
| TCP/UDP ingest | **NLB** with TCP `9000` and UDP `9001` listeners → same Fargate tasks (IP targets). Note: UDP target groups need a health check on a **TCP/HTTP port** (use the Quarkus health port). |
| Database | RDS PostgreSQL (`db.t4g.micro` dev, Multi-AZ prod) |
| Auth | Cognito user pool + app client (PKCE) |
| DNS/TLS | Route 53 + ACM (app, api, ingest subdomains) |
| Images | ECR |
| Secrets/config | Secrets Manager + SSM Parameter Store |
| Observability | CloudWatch Logs (JSON logs), metrics via Micrometer → CloudWatch (or EMF), alarms: 5xx, ingest drop rate, CPU, DB connections |

- **IaC:** AWS CDK in Java (`infra/`) — same language as backend (ADR to confirm; Terraform acceptable alternative). Stacks: `Network`, `Data`, `Auth`, `Backend`, `Frontend`. Two environments: `dev`, `prod`.
- **Cost-conscious dev:** 1 AZ, 1 Fargate task, smallest RDS; avoid NAT Gateway (public subnets + tight security groups, or VPC endpoints). Provide a `cdk destroy` path and tag everything `app=flowtrace,env=…`.
- **MVP runs exactly 1 backend task** (see fanout note in section 7). Autoscaling is enabled only after the Redis fanout exists.
- **CI/CD:** GitHub Actions with AWS OIDC role (no long-lived keys): build + test → build Docker image → push ECR → `cdk deploy` for dev on `main`; manual approval for prod. Frontend build → S3 sync → CloudFront invalidation.
- **Docker:** multi-stage Dockerfile for backend (JVM mode first; native image is an optional later optimization), `docker-compose.yml` for local dev (Postgres + backend + frontend dev server + optional Keycloak/mock-auth profile so local dev works without Cognito).

## 15. Non-functional targets (MVP)
- Ingest → token starts moving in UI: **p95 < 250 ms** (same region).
- One backend task sustains **≥ 2,000 events/s** ingest with 20 connected UI sessions.
- UI holds **60 fps** with 100 concurrent tokens on a mid laptop; degrades gracefully above the cap.
- Zero data loss guarantee is **not** required for UDP; HTTP/TCP-with-ack must not ack before the event is accepted into the pipeline.
- Startup < 5 s (JVM), memory < 512 MB under target load.
- Observability: structured logs with `projectId`/`traceId`; metrics `ingest_events_total{protocol}`, `ingest_dropped_total{protocol,reason}`, `ws_sessions`, `ws_dropped_total`, `hop_latency_seconds`, `db_flush_seconds`.

## 16. Testing strategy
- **Unit:** `ResolveHop` rules (every branch of 6.1), rate limiter, key hashing, diagram validation, animation scheduler/catch-up logic (pure TS).
- **Integration (Quarkus + Testcontainers Postgres):** ingest over HTTP/UDP/TCP → assert WS client receives expected `hop` events; auth isolation between two users; retention job.
- **Protocol tests:** malformed JSON, oversized payloads, bad key, ACK/NACK behaviour, TCP idle timeout.
- **Load:** simulator CLI against local stack, k6 for HTTP; assert section 15 numbers; record results in `docs/PERF.md`.
- **Frontend:** component tests for editor operations; e2e with **Playwright**: start demo, assert `data-token-id` elements appear and move between `data-node-key` nodes; editor creates a node + edge and saves; reconnect behaviour when WS drops.
- CI fails on test failure, lint errors, or OpenAPI drift.

## 17. Milestones (build in this order; each ends with a runnable state + passing tests)

**M0 — Skeleton (½ day)**
Monorepo, Quarkus app with health endpoint, Angular app with routing shell, docker-compose (Postgres), CI build, ADR-0001 (architecture & module layout), `AGENTS.md`, `docs/PROGRESS.md`.
*DoD:* `docker compose up` runs everything; CI green.

**M1 — Ingest + live stream, no persistence**
Event schema, HTTP/UDP/TCP adapters, API-key auth (in-memory seed key for now), `ResolveHop`, in-JVM fanout, WebSocket stream, rate limiting, metrics.
*DoD:* `curl` / `nc -u` / `nc` each produce `hop` messages visible via a WS test client; unit + integration tests for 6.1.

**M2 — Canvas + animation (the wow)**
Angular live view with hard-coded sample diagram, pan/zoom, nodes/edges, token animation per 10.3, counters, catch-up logic, controls, dark theme, **demo simulator** (section 13).
*DoD:* start the app → sample diagram animates by itself; 60 fps with 100 tokens; reduced-motion supported.

**M3 — Persistence, projects, auth**
Flyway schema, projects/keys/diagram CRUD, Cognito OIDC (+ local mock profile), async batch writer, retention job, project settings page with snippets.
*DoD:* sign in → create project → get key → send events with curl → see them animate; data survives restart.

**M4 — Editor + auto-discovery**
Editor mode, drag/connect, undo/redo, auto-layout, versions, import/export, discovered-edge flow.
*DoD:* build a diagram from scratch in the UI; send events for unknown nodes/edges and watch them appear dashed; accept them.

**M5 — Traces & replay**
Trace search, trace timeline drawer, replay on canvas (scrub + speed).
*DoD:* pick a stored trace → replay animates the exact path with original relative timing.

**M6 — Java SDK + docs**
`client-java` (HTTP/UDP/TCP transports, context helper), README with quick start, published to local Maven repo (Maven Central later).
*DoD:* sample app in `examples/` sends a trace through 5 checkpoints; shown live.

**M7 — AWS deploy**
CDK stacks, ALB+NLB, Fargate, RDS, S3/CloudFront, Cognito, DNS/TLS, GitHub Actions deploy, alarms, runbook `docs/RUNBOOK.md`.
*DoD:* public URL; UDP/TCP/HTTP ingest work through NLB/ALB; WS works through ALB; `dev` fully reproducible from scratch with one command.

**M8 — Polish & hardening**
Visual polish pass, empty/error states, a11y, perf tuning, load test report, Redis fanout (behind the `EventFanout` interface) + enable autoscaling.

## 18. Repository layout

```
flowtrace/
  AGENTS.md
  README.md
  docker-compose.yml
  backend/            # Quarkus (section 4.1)
  frontend/           # Angular app
  client-java/        # SDK
  simulator/          # CLI load generator (reuses client-java)
  examples/           # sample integrations
  infra/              # AWS CDK (Java)
  docs/
    adr/  PROGRESS.md  PERF.md  RUNBOOK.md  BRANDING.md  PROTOCOL.md
  .github/workflows/
```
`docs/PROTOCOL.md` = the normative description of sections 5–6 (keep in sync with code; schema tests read from it or from a shared JSON Schema file `docs/event.schema.json`).

## 19. Instructions for the coding agent (put the essence into `AGENTS.md`)
1. Work **one milestone at a time**; do not start the next before the current DoD passes. Tick items in `docs/PROGRESS.md`.
2. Before coding each milestone, write/refresh the relevant ADRs. Prefer the defaults in this spec; deviate only with a recorded reason.
3. Verify current stable versions of Quarkus, Angular, Java, Foblex Flow/elkjs, CDK **at the time of implementation** (don't rely on versions remembered from training) and pin them.
4. Domain code stays framework-free. No business logic in controllers/adapters.
5. Never block ingest threads; never let the DB or a slow UI client affect the live path.
6. Every public behaviour in sections 5, 6.1, 10.3 needs a test.
7. Keep commits small and conventional (`feat:`, `fix:`, `chore:`).
8. When something is ambiguous, pick the simplest default listed in section 20, note it in `docs/PROGRESS.md`, and continue — don't stall.
9. Do not add features from "Out of scope / later".

## 20. Assumptions & defaults (override if you disagree)
- Name: FlowTrace (placeholder). Java package root: `dev.flowtrace`.
- Java 21, Quarkus current LTS, Angular latest stable, PostgreSQL 16+.
- One diagram per project in MVP (multiple diagrams per project = later).
- Auth: Cognito; local dev: mock auth profile.
- Trace IDs: UUID (v7 recommended), validated as UUID on ingest.
- Retention: 7 days; stats window 1 s; trace idle timeout 30 s.
- Region: `eu-west-1`.
- Single backend task in AWS until Redis fanout lands.

## 21. Out of scope / later
- Public read-only share links and embeddable `<iframe>` widget (great for demos/marketing).
- OpenTelemetry ingestion adapter (map spans → hops).
- SDKs for Node, Python, Go, .NET.
- Teams, RBAC, billing/plans (SaaS), usage quotas.
- Multiple diagrams per project, sub-diagrams, node groups.
- gRPC ingest, TLS on TCP ingest, HMAC-signed UDP.
- Alerts (e.g. "error rate on edge X > 5 %") and anomaly highlighting.
- Native image build, multi-region.

# FlowTrace — Implementation Progress

> Tracked milestone by milestone per `spec.md` section 17.

## Milestones

- [x] **M0 — Skeleton**
  - [x] `AGENTS.md`, `docs/PROGRESS.md`, `docs/BRANDING.md`, `docs/PROTOCOL.md`, `docs/event.schema.json`
  - [x] ADRs (`0001` through `0004`)
  - [x] Root Maven `pom.xml` + Quarkus `backend` skeleton with `/q/health`
  - [x] Angular `frontend` routing shell
  - [x] `docker-compose.yml` + `.github/workflows/ci.yml`
- [x] **M1 — Ingest + live stream, no persistence**
  - [x] Pure Java domain (`TraceSummary`, `HopResolver`, `DiagramGraph`, `CheckpointEvent`, `UiEvent`)
  - [x] `ResolveHop` use case (all rules of 6.1 + idempotency + auto-discovery)
  - [x] Token-bucket rate limiter per API key + payload validation
  - [x] HTTP (`/api/v1/events`, `/api/v1/traces`), UDP (`9001`), TCP (`9000` with `hello` handshake & ACK/NACK)
  - [x] In-JVM `EventFanout` + WebSocket stream `/ws/v1/projects/{projectId}/stream` with 1s `stats` & slow-client drop protection
  - [x] Unit + integration tests for 5.x & 6.1
- [x] **M2 — Canvas + animation (the wow)**
  - [x] Dark/Light design system (`styles.css`), n8n/Linear aesthetic
  - [x] Interactive SVG canvas (pan/zoom, nodes, Bezier edges, arrowheads, edge heat, counters)
  - [x] `AnimationEngine` (`spawn`, `hop` with trail & pulse, `error` flash/shake, `unmapped` ghost edge, `end` fade, catch-up logic, 300-token cap, `prefers-reduced-motion`)
  - [x] Backend `DemoSimulator` service + UI Demo controls
- [x] **M3 — Persistence, projects, auth**
  - [x] Flyway schema + PostgreSQL/JDBC repositories + async batched trace/event writer + retention job
  - [x] Projects, API keys (`ft_live_...`, SHA-256 hash), Diagram versions CRUD
  - [x] Cognito OIDC + local mock auth profile + multi-tenant isolation tests
  - [x] Project Settings UI with pre-filled `curl`, Java SDK, `nc` UDP/TCP snippets
- [x] **M4 — Editor + auto-discovery**
  - [x] Editor palette, drag/drop nodes, port-to-port edge connection, inline rename with auto-slugified `key`
  - [x] Undo/redo (50 ops), auto-layout, version history, JSON export, accept/reject discovered edges
- [x] **M5 — Traces & replay**
  - [x] Trace search API & UI drawer + timeline inspector
  - [x] Interactive canvas replay mode with timeline progress & speed controls
- [x] **M6 — Java SDK + docs**
  - [x] `client-java` (`FlowTrace`, `HttpTransport`, `UdpTransport`, `TcpTransport`, `FlowTraceContext`, UUIDv7)
  - [x] `simulator` standalone CLI jar + `examples/CheckoutServiceExample.java`
- [x] **M7 — AWS deploy**
  - [x] `infra/` AWS CDK Java stacks (`Network`, `Data`, `Auth`, `Backend` ALB+NLB+Fargate, `Frontend` S3)
  - [x] `.github/workflows/deploy.yml` + `docs/RUNBOOK.md`
- [x] **M8 — Polish & hardening**
  - [x] Clean `EventFanout` interface & slow-client protection
  - [x] Load/perf benchmark report in `docs/PERF.md` + full unit & integration test suite

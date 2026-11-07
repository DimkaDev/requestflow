# AGENTS.md — FlowTrace Coding Agent Instructions

> **Source of truth:** `spec.md` (and `docs/PROTOCOL.md` for sections 5–6).

## Golden Rules

1. **Work one milestone at a time (M0 → M8)**; do not start the next before the current Definition of Done (DoD) passes. Tick items in `docs/PROGRESS.md`.
2. **Write/refresh ADRs before coding each milestone** in `docs/adr/NNNN-*.md` (short Context / Decision / Consequences). Prefer the defaults in `spec.md`; deviate only with a recorded reason.
3. **Pinned versions (verified at implementation time):**
   - Java: `21` (Temurin 21.0.13 LTS; `/home/antigravity/.local/jdk21` in VM)
   - Quarkus BOM: `3.20.4` (LTS)
   - Angular: `22.2.x` (standalone components, signals, `@if`/`@for` control flow, strict TypeScript)
   - Layout engine: `elkjs` `0.12.1` + custom deterministic hierarchical layout
   - AWS CDK (`aws-cdk-lib`): `2.275.0`
   - PostgreSQL: `16` in Docker / RDS (`15+` compatible for local native dev)
4. **Hexagonal / Clean Architecture:**
   - `dev.flowtrace.domain` stays 100% framework-free (pure Java 21 records/classes, no Quarkus/Jakarta/Vert.x/Jackson imports).
   - `dev.flowtrace.application` orchestrates use cases (`IngestEventUseCase`, `ResolveHopUseCase`, `ManageProjectUseCase`, `DemoSimulatorService`, `ReplayTraceUseCase`) via port interfaces.
   - Inbound adapters (`adapter.in.http`, `adapter.in.udp`, `adapter.in.tcp`, `adapter.in.ws`) and outbound adapters (`adapter.out.pg`, `adapter.out.fanout`) depend inward only.
5. **Non-blocking Live Path:**
   - Never block ingest threads (HTTP/UDP/TCP).
   - Never let database writes or a slow WebSocket UI client affect the live ingest or fanout path.
   - Bounded queues everywhere; on overflow, drop and increment Micrometer metrics (`ingest_dropped_total`, `ws_dropped_total`).
6. **Testing:**
   - Every public behaviour in sections 5 (protocols), 6.1 (hop resolution), and 10.3 (animation/scheduler) must have automated unit/integration tests.
7. **Commits:**
   - Keep commits small and conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
8. **Scope discipline:**
   - Do not add features listed under "Out of scope / later" (section 21).

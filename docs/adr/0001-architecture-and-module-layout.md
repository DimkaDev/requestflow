# ADR-0001: Architecture & Module Layout

- **Status:** Accepted
- **Date:** 2026-11-07

## Context
FlowTrace ingests high-throughput checkpoint events over HTTP, UDP, and TCP, resolves hops in real time, fans out events to WebSocket UI sessions, and asynchronously persists traces to PostgreSQL. The specification (`spec.md` section 4.1) allows either a multi-module Maven layout or a single deployable module with strict package boundaries, plus a separate `client-java` SDK module, `simulator` CLI, and `infra` AWS CDK module.

## Decision
1. **Root Maven aggregator (`pom.xml`)** at repository root managing:
   - `backend`: Single Quarkus (`3.20.4` LTS, Java 21) deployable module with strict Hexagonal package boundaries:
     - `dev.flowtrace.domain` — Pure Java 21 domain models (`Trace`, `Hop`, `Diagram`, `Node`, `Edge`, `ApiKey`, `Project`, `CheckpointEvent`, `UiEvent`) with zero framework imports (verified via ArchUnit/unit test).
     - `dev.flowtrace.application` — Use cases (`ResolveHopUseCase`, `IngestEventUseCase`, `ProjectService`, `DemoSimulator`, `TraceQueryService`) and port interfaces (`EventFanout`, `TraceRepository`, `ProjectRepository`, `ApiKeyRepository`).
     - `dev.flowtrace.adapter.in.http` — REST controllers (`/api/v1/...`).
     - `dev.flowtrace.adapter.in.udp` — Vert.x `DatagramSocket` server on port `9001/udp`.
     - `dev.flowtrace.adapter.in.tcp` — Vert.x `NetServer` newline-delimited JSON server on port `9000/tcp`.
     - `dev.flowtrace.adapter.in.ws` — Quarkus WebSockets Next endpoint `/ws/v1/projects/{projectId}/stream`.
     - `dev.flowtrace.adapter.out.fanout` — In-JVM `EventFanout` implementation (and configurable Redis pub/sub adapter behind the same interface).
     - `dev.flowtrace.adapter.out.pg` — Flyway migrations, async batched writer, and PostgreSQL repositories.
     - `dev.flowtrace.app` — Quarkus bootstrap, configuration (`FlowTraceConfig`), and bean wiring.
   - `client-java`: Zero-heavy-dependency Java 21 SDK (`HttpTransport`, `UdpTransport`, `TcpTransport`, `FlowTraceContext`, UUIDv7 generator).
   - `simulator`: Standalone CLI load generator reusing `client-java`.
   - `infra`: AWS CDK (Java, `aws-cdk-lib` `2.275.0`) stacks (`NetworkStack`, `DataStack`, `AuthStack`, `BackendStack`, `FrontendStack`).
2. **Frontend (`frontend/`)**: Standalone Angular `22.2.x` application using Signals and strict TypeScript.

## Consequences
- Fast Quarkus build and test cycles in `backend` while enforcing clean architectural boundaries via package visibility and tests.
- Shared root Maven build compiles and tests `backend`, `client-java`, `simulator`, and `infra` together.

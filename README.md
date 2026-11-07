# FlowTrace — Live Request Flow Visualizer

> **Show how requests travel through your system, live and animated.**

FlowTrace receives lightweight checkpoint events (`traceId` + `node`) over **HTTP, UDP, or TCP** and renders them on an interactive n8n-inspired canvas: blocks connected by Bezier edges, with glowing tokens that travel along edges in real time, branch across `if` decisions, pulse target nodes, and record timelines for historical replay.

---

## Architecture & Repository Layout

```
requestflow/
  AGENTS.md                  # Agent & architecture instructions
  README.md                  # Quick-start guide
  docker-compose.yml         # Local full-stack setup (PostgreSQL + Backend + Frontend)
  backend/                   # Java 21 + Quarkus 3.20.4 LTS (Clean/Hexagonal architecture)
    src/main/java/dev/flowtrace/
      domain/                # Pure Java domain (HopResolver, CheckpointEvent, DiagramGraph, UiEvent, UuidV7)
      application/           # Use cases (IngestEventUseCase, ProjectService, DemoSimulator, StatsTracker)
      adapter/in/http/       # REST API (/api/v1/events, /api/v1/traces, /api/v1/projects/**)
      adapter/in/udp/        # Vert.x DatagramSocket server (9001/udp, fire-and-forget)
      adapter/in/tcp/        # Vert.x NetServer (9000/tcp, newline-delimited JSON, hello + ACK/NACK)
      adapter/in/ws/         # Quarkus WebSockets Next (/ws/v1/projects/{id}/stream)
      adapter/out/fanout/    # In-JVM EventFanout (and Redis pub/sub ready port)
      adapter/out/pg/        # Flyway migrations + async batched PostgreSQL writer + retention job
  frontend/                  # Angular 21+ standalone signals app + SVG & RAF AnimationEngine
  client-java/               # Zero-heavy-dependency Java SDK (HttpTransport, UdpTransport, TcpTransport)
  simulator/                 # Standalone CLI load generator (simulator.jar)
  examples/                  # Sample Java checkout integration
  infra/                     # AWS CDK (Java) stacks (VPC, RDS, Cognito, ECS Fargate + ALB + NLB, S3)
  docs/                      # ADRs, PROTOCOL.md, event.schema.json, BRANDING.md, PERF.md, RUNBOOK.md
```

---

## Quick Start

### 1. Run with Docker Compose
```bash
docker compose up --build
```
- **Angular UI:** `http://localhost:4200`
- **Backend REST & WebSocket API:** `http://localhost:8080`
- **TCP Ingest:** `localhost:9000`
- **UDP Ingest:** `localhost:9001`

### 2. Run Locally (Development Mode)
```bash
# Backend (Quarkus)
mvn -pl backend quarkus:dev

# Frontend (Angular)
cd frontend && npm start
```

### 3. Send Live Checkpoints

#### HTTP (`curl`)
```bash
curl -X POST http://localhost:8080/api/v1/events \
  -H "X-API-Key: ft_live_demo0000000000000000000000000000" \
  -H "Content-Type: application/json" \
  -d '[
    {"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"website"},
    {"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"lb"},
    {"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"if-premium","attrs":{"tier":"pro"}},
    {"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"service-a"},
    {"traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"db","type":"end"}
  ]'
```

#### UDP (`netcat`)
```bash
echo '{"key":"ft_live_demo0000000000000000000000000000","traceId":"0194f1c0-7b52-7c1e-9a3e-5f0d2b6c8a11","node":"service-a","from":"if-premium"}' | nc -u -w0 localhost 9001
```

#### Java SDK (`client-java`)
```java
FlowTrace ft = FlowTrace.builder()
    .endpoint("udp://localhost:9001") // or tcp://localhost:9000, http://localhost:8080/api/v1
    .apiKey(System.getenv("FLOWTRACE_KEY"))
    .build();

String traceId = ft.newTrace(); // UUIDv7, no network round-trip
ft.checkpoint(traceId, "website");
ft.checkpoint(traceId, "lb");
ft.checkpoint(traceId, "if-premium", Map.of("tier", "pro"));
ft.checkpoint(traceId, "service-a");
ft.end(traceId, "db");
```

---

## Documentation
- [Protocol & Event Schema (`docs/PROTOCOL.md`)](./docs/PROTOCOL.md)
- [JSON Schema (`docs/event.schema.json`)](./docs/event.schema.json)
- [Architecture Decision Records (`docs/adr/`)](./docs/adr/0001-architecture-and-module-layout.md)
- [AWS Deployment Runbook (`docs/RUNBOOK.md`)](./docs/RUNBOOK.md)
- [Performance Report (`docs/PERF.md`)](./docs/PERF.md)
- [Milestone Progress (`docs/PROGRESS.md`)](./docs/PROGRESS.md)

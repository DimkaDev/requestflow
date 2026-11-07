# ADR-0002: Realtime Transport & Event Fanout Strategy

- **Status:** Accepted
- **Date:** 2026-11-07

## Context
The Angular UI requires low-latency (< 250 ms p95) real-time updates (`snapshot`, `spawn`, `hop`, `end`, `diagram_patch`, `stats`, `dropped`) and protection against slow clients. In AWS, the MVP runs a single ECS Fargate task behind an ALB (for HTTP/WS) and NLB (for TCP/UDP).

## Decision
1. **Realtime Transport:** Quarkus WebSockets Next at `GET /ws/v1/projects/{projectId}/stream`.
   - Authenticated via short-lived ticket obtained from `POST /api/v1/projects/{id}/ws-ticket` (passed via `ticket` query param or `Sec-WebSocket-Protocol` header) or dev bearer token.
   - Immediately sends a `snapshot` message on connect, followed by real-time events and a 1-second periodic `stats` message.
   - Each session maintains a bounded non-blocking outbound queue (capacity 256). If full, oldest `hop` messages are dropped and a `{"t":"dropped","count":N}` summary is sent.
2. **Event Fanout (`EventFanout` port):**
   - Clean interface in `dev.flowtrace.application.port.out.EventFanout`.
   - Default MVP implementation: `InMemoryEventFanout` backed by concurrent subscriber sets and non-blocking dispatch on virtual/worker threads.
   - Phase 2 / M8 implementation: `RedisEventFanout` (activatable via `flowtrace.fanout.type=redis`) so horizontal autoscaling across multiple Fargate tasks works without touching `application` or `domain`.

## Consequences
- Zero external broker required for local dev and single-task MVP deployment.
- Slow or disconnected browser tabs never block ingestion or other WebSocket clients.

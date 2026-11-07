# FlowTrace Ingestion & Streaming Protocol Specification (v1)

This document is the normative protocol specification for FlowTrace (mirroring sections 5, 6, and 7 of `spec.md`).

## 1. Event Schema (v1)

JSON schema file: [`docs/event.schema.json`](./event.schema.json)

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

### Field Rules
- `v`: optional integer, default `1`.
- `key`: ingest API key (`ft_live_...`). Required in UDP payloads and TCP payloads prior to `hello` handshake; passed via `X-API-Key` header in HTTP.
- `traceId`: **required** valid UUID string.
- `node`: **required** node key matching `^[a-z0-9-_.]{1,64}$`.
- `from`: optional source node key matching `^[a-z0-9-_.]{1,64}$`.
- `type`: optional enum `enter` (default) | `error` | `end`.
- `branch`: optional string (1..64 chars), default `main`.
- `ts`: optional client epoch milliseconds (number). Server receive timestamp is authoritative for ordering.
- `label`: optional string, max 40 chars.
- `attrs`: optional flat map of `≤ 10` keys; values must be string (`≤ 100` chars), number, or boolean.
- `seq`: optional integer sequence number (used for idempotency within 10s and TCP ACK/NACK).

## 2. Ingestion Transports

### 2.1 HTTP (`POST /api/v1/events`)
- Header: `X-API-Key: <ingest key>`
- Body: single JSON event object or JSON array of 1..100 event objects. Max event size 4 KB.
- Response: `202 Accepted`
  ```json
  {
    "accepted": 1,
    "rejected": [
      { "index": 0, "reason": "invalid node key" }
    ]
  }
  ```
- Server-generated Trace ID (`POST /api/v1/traces`): returns `201 Created` `{"traceId":"<uuid-v7>"}`.

### 2.2 UDP (`9001/udp`)
- One datagram = one JSON event or JSON array (`≤ 1200` bytes).
- Includes `"key"` field inside event JSON.
- Fire-and-forget: never sends a response packet. Invalid/unauthorized packets increment `ingest_dropped_total{protocol="udp",reason="..."}`.

### 2.3 TCP (`9000/tcp`)
- Newline-delimited JSON (`\n`), UTF-8, max line 8 KB, idle timeout 60s, max 100 connections per API key.
- Optional initial handshake line:
  - Client: `{"type":"hello","key":"ft_live_...","ack":true}`
  - Server: `{"type":"hello_ok"}` (or `{"type":"error","reason":"..."}` and closes).
- Subsequent event lines do not need `"key"`.
- If `ack: true` and event has `"seq": N`, server replies `{"ack":N}` on acceptance or `{"nack":N,"reason":"..."}` on rejection.

## 3. Hop Resolution Rules (`ResolveHop`)
1. `TraceState` tracks the last known node per `(projectId, traceId, branch)` with 30s idle expiry.
2. Exact duplicate of `(traceId, branch, seq)` within 10s (when `seq` is present) is ignored as idempotent.
3. If `from` is explicitly provided → hop `from → node`.
4. Else if `TraceState` has a previous node → hop `lastNode → node`.
5. Else → `spawn` at `node`.
6. Update `TraceState` to `node` (or remove if `type == "end"`).
7. Missing node or edge:
   - If project `autoDiscover == true`: automatically add missing node/edge marked `discovered: true` and emit `diagram_patch`.
   - Else: emit hop with `edgeId: null, unmapped: true`.
8. `type == "error"` → hop status is `"error"`.
9. `type == "end"` → emit `end` event at `node`.

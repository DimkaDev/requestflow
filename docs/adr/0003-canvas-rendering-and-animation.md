# ADR-0003: Canvas Rendering & Animation Engine

- **Status:** Accepted
- **Date:** 2026-11-07

## Context
FlowTrace's core value proposition is a smooth, dark, n8n-inspired interactive diagram where glowing tokens animate along bezier edges in real time at 60 fps with up to 100–300 concurrent tokens, supporting pan/zoom, node dragging, port-to-port edge creation, catch-up scheduling, trail effects, and `prefers-reduced-motion`.

## Decision
1. **Graph & Node/Edge Layer:** Interactive SVG canvas with custom pan/zoom matrix transform (`translate(x,y) scale(k)`), rounded node cards, cubic Bezier `SVGPathElement` edges with arrowheads, heat glow based on 1s hop rates, and port drag-and-drop in Editor mode.
2. **Token Animation Scheduler (`AnimationEngine`):**
   - Framework-independent TypeScript class (`frontend/src/app/core/animation-engine.ts`) driven by a single `requestAnimationFrame` loop.
   - Per-`(traceId, branch)` queue with **Catch-up logic**: in `realtime` mode, when queue depth grows, hop duration scales down from `clamp(600ms / speed, 250ms, 1500ms)` toward `150ms` so tokens never lag real time by more than ~2s.
   - Uses `SVGPathElement.getPointAtLength()` (with mathematical cubic Bezier evaluation fallback for unit testing and ghost edges) to compute exact `(x, y)` coordinates and trailing segments.
   - Enforces a hard cap of `300` concurrent tokens; above the cap, new tokens are sampled out (`sampling: true`) and edge heat pulses instead.
   - Exposes `data-token-id`, `data-trace-id`, `data-edge-id`, and `data-node-key` DOM attributes for Playwright E2E testing.

## Consequences
- Pure TypeScript `AnimationEngine` is 100% unit-testable without a browser DOM.
- Single `requestAnimationFrame` loop avoids per-token timers or CSS animation thrashing, sustaining 60 fps.

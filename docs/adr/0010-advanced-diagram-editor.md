# ADR-0010: Advanced Diagram Editor Architecture & Canvas Engine (DEC-16, DEC-17, DEC-18, DEC-19)

- **Status:** Proposed (Awaiting Human Approval)
- **Date:** 2026-11-14
- **Related Tasks:** E26 (P1–P5), E19-03, E18-10, DEC-16, DEC-17, DEC-18, DEC-19, H-18, H-19

---

## 1. Context

Epic E26 requires a full-featured visual Diagram Editor at `/projects/:projectId/editor` so users who start from **"No template / Blank canvas"** (or remix an existing diagram) can build a complete request-flow architecture from zero:
- Drag/click blocks from a data-driven multi-pack Block Library (`catalog/<pack>.json`).
- Connect ports with flow semantics (weights, expected latency, condition labels, animation overrides).
- Group nodes into collapsible zones/lanes ("Store", "Checkout"), align/distribute multi-selections, and auto-layout via deterministic hierarchical layout (`elkjs` / deterministic layered engine).
- Maintain a 100+ step Command-pattern Undo/Redo stack.
- Edit a **Draft** (`PUT /api/v1/projects/{id}/diagram/draft`) with optimistic concurrency without affecting live traffic until **Publish** (`POST /api/v1/projects/{id}/diagram/publish`).
- Run a client-side **Preview Flow** (`⌘/Ctrl+Enter`) using the existing `AnimationEngine` and entity/carry token renderer at 60 fps (sustaining up to 300 blocks / 600 edges with viewport culling).

Before coding E26, `DEC-16` requires comparing candidate canvas/graph libraries against Sections 6 and 11 of E26, and recording decisions for `DEC-17` (vendor icons), `DEC-18` (collaboration), and `DEC-19` (plan limits).

---

## 2. Decision Drivers (from E26 Sections 6 & 11)

1. **Zero Duplication of Live Renderer & `AnimationEngine`:** The editor's **Preview Flow** and dry-run **"Send test event"** must animate tokens using the exact same `AnimationEngine` (`frontend/src/app/core/animation-engine.ts`), Bezier path math, and entity/carry badges as the Live View.
2. **Performance (300 blocks / 600 edges at 60 fps):** Must support viewport culling (rendering only visible nodes/edges when count > 80) and zero DOM layout thrashing while 50+ tokens animate simultaneously.
3. **Rich Editor Interactions:** Marquee selection, Shift-click multi-select, 8 px snap-to-grid, dynamic alignment guides to sibling nodes, port-to-empty-space quick-add menu, edge endpoint reconnection, self-loops (retries), and collapsible group zones that move their child nodes.
4. **Full Keyboard & Screen-Reader Accessibility (WCAG AA):** Tab navigation across nodes, arrow-key nudging (1 px / 10 px), keyboard "Connect to..." picker, ARIA live announcements, and `prefers-reduced-motion` support.
5. **Bundle Size & Angular 21+ Standalone Signal Compatibility:** Pinned Angular workspace without heavy third-party wrapper lock-in or Zone.js thrashing.

---

## 3. Options Considered for DEC-16 (Canvas & Graph Library)

| Criterion | Option A: Custom Signal-Driven SVG + Viewport Culling + Shared `AnimationEngine` (Recommended) | Option B: Foblex Flow (`@foblex/flow`) | Option C: Cytoscape.js / Rete.js / JointJS |
|---|---|---|---|
| **Reuse of existing `AnimationEngine` & Live Renderer** | **100% Native reuse.** Uses the exact same SVG coordinate space, node card templates, and `AnimationEngine` token layer. | **Partial / Friction.** Foblex manages its own DOM wrappers and connection paths; overlaying `AnimationEngine` entity tokens and ghost edges requires reverse-engineering internal SVG paths. | **None.** Separate canvas/WebGL model; would require rewriting token animation and entity/carry rendering from scratch (violates E26 Trap #1). |
| **300 Nodes / 600 Edges @ 60 fps** | **High.** Signal-based viewport bounding-box culling skips off-screen nodes/edges while keeping data in memory; single `transform: translate3d(...) scale(...)` layer. | **Medium.** Renders one Angular component host per node/connector in the DOM without built-in virtualized culling for 300+ complex cards. | **High (Cytoscape) / Medium (JointJS).** Fast rendering, but loses rich HTML/Tailwind/SVG node styling from `DESIGN.md`. |
| **Port-to-Empty Quick-Add, Self-Loops, Zones & Guides** | **Full control.** Trivial to compute cubic Bezier / orthogonal step paths, self-loop arcs, snap guides, and zone bounding boxes in pure TypeScript. | **Limited.** Customizing self-loop Bezier geometry, zone parent-child dragging, and port-to-empty quick-add popovers requires workarounds against library internals. | **Varies.** High integration boilerplate and CSS isolation issues. |
| **Accessibility (Keyboard Connect, Tab Order, ARIA)** | **Full control.** Native `<g tabindex="0" role="button">` nodes with custom keyboard "Connect to..." popover and `aria-live` region. | **Partial.** Mouse/pointer-centric; custom keyboard connection workflows must be built externally anyway. | **Poor.** Canvas-based renderers lack native DOM focusables per node. |
| **Supply-Chain & Bundle Impact** | **0 KB added.** Pure TypeScript + existing Angular Signals. | Adds external npm dependency with version coupling to Angular major releases. | Heavy bundle footprint (+150 KB to +400 KB). |

---

## 4. Decisions

### DEC-16: Custom Signal-Driven SVG Canvas + Deterministic Auto-Layout + Shared `AnimationEngine`
We choose **Option A**:
- Build a shared, modular interactive SVG canvas architecture (`EditorCanvasComponent` + pure TypeScript `EditorCommandHistory`, `DiagramValidator`, `PreviewFlowRunner`, and `AutoLayoutEngine`) that shares the exact node/edge rendering primitives and `AnimationEngine` with `FlowCanvasComponent`.
- Support pan/zoom (`25%–200%`), 8 px grid snap, dynamic alignment guides (`x`/`y` center and edge snapping), marquee selection, collapsible `DiagramGroup` zones, self-loop Bezier paths, curved/straight/step edge routing, and viewport culling when node count exceeds 80.
- Use deterministic hierarchical Sugiyama/ELK-compatible layout (`TB` and `LR`) with animated transitions and full Undo/Redo command encapsulation.

### DEC-17: Vendor Icon Policy (AWS, Google Cloud, Tech Packs)
- Until human task **H-18** (verification of current official AWS Architecture Icons and Google Cloud trademark/SaaS embedding terms) is completed and approved, all catalog packs (`standard`, `shop`, `aws`, `gcp`, `tech`, `ai-agent`, `business`) ship with **vendor-neutral generic SVG/Material symbols** (`lib:compute`, `lib:database`, `lib:queue`, `lib:storage`, `lib:function`, `lib:gateway`, etc.) and a free-text `vendorLabel` property.
- Each catalog JSON (`catalog/<pack>.json`) includes `"license": { "source": "own", "notes": "Neutral generic icons. Not affiliated with or endorsed by AWS, Google Cloud, or other vendors." }`, and the UI renders the non-affiliation notice in the Block Library footer.
- Swapping in official vendor SVGs after H-18 approval is a **pure data change** in `catalog/<pack>.json` + icon map, requiring zero code changes.

### DEC-18: Single-Writer Optimistic Concurrency (No Real-Time Multi-User Editing)
- Real-time CRDT/OT multi-user collaboration is explicitly out of scope for E26.
- Draft saves (`PUT /api/v1/projects/{id}/diagram/draft`) use an integer `draftVersion` (`expectedDraftVersion` in request payload).
- If the server's `draft_version` is newer than the client's `expectedDraftVersion`, the backend returns `HTTP 409 Conflict` with `updatedBy`, `updatedAt`, and the server's current draft. The editor displays a non-destructive conflict banner: **"Updated by {user} at {time}: Reload server draft / Keep mine (overwrite)"**.

### DEC-19: Config-Driven Plan Entitlements for Editor Limits
- Plan limits (`maxBlocksPerProject`, `maxEdgesPerProject`, `allowedPacks`, `customBlocksAllowed`) are read from a central configuration (`EntitlementsConfig` on backend + exposed via API/store on frontend), never scattered as magic numbers.
- Default configuration:
  - `FREE`: 25 blocks, 50 edges, packs `standard`, `shop`, `tech`, `business`
  - `PRO`: 100 blocks, 250 edges, all packs + `my-blocks`
  - `BUSINESS` / `ENTERPRISE`: 500 blocks, 1,200 edges, all packs + `my-blocks` + org templates
- Enforced non-blockingly as a Validation Error while editing and enforced strictly on **Publish** (`POST /api/v1/projects/{id}/diagram/publish`) with an upgrade modal trigger.

---

## 5. Schema v2 Evolution & Draft/Publish Persistence

### 5.1 Backward-Compatible `DiagramGraph` (Schema v2)
Existing `schema: 1` diagrams open seamlessly and auto-migrate in memory to `schema: 2`:
- `DiagramNode` adds optional `props`:
  - `role`: `'normal' | 'start' | 'end' | 'decision' | 'success' | 'failure' | 'abandon'`
  - `tint`: token color key or hex from token palette
  - `size`: `'S' | 'M' | 'L'`
  - `shape`: `'card' | 'pill' | 'diamond'`
  - `labelPosition`: `'inside' | 'bottom'`
  - `showCounter`: `boolean`
  - `description`: `string`
  - `idleAbandonMinutes`: `number`
  - `maxIn`: `number | 'many'`, `maxOut`: `number | 'many'`
  - `holdTimeMs`: `number`
  - `groupId`: `string | null`
  - `locked`: `boolean`
  - `zIndex`: `number`
  - `aliases`: `string[]` (supports 7-day key rename alias)
- `DiagramEdge` adds optional `style` and `flow`:
  - `style`: `{ lineType: 'curved' | 'straight' | 'step', color: string, thickness: 'thin' | 'normal' | 'thick' | 'volume', dashed: boolean, arrowhead: boolean, direction: 'one-way' | 'bidirectional' }`
  - `flow`: `{ weight: number, condition: string, expectedLatencyMs: number, speedMultiplier: number, tokenStyle: 'auto' | 'dot' | 'entity', terminalPath: boolean }`
- `DiagramGraph` adds optional `groups: DiagramGroup[]`:
  - `{ id, name, color, x, y, width, height, collapsed, locked }`

### 5.2 Database Migration (`V7__diagram_drafts_and_custom_blocks.sql`)
- Adds draft storage and version metadata:
  - `project_diagram_drafts(project_id PK, draft_version INT, graph TEXT, updated_by VARCHAR(255), updated_at TIMESTAMP WITH TIME ZONE)`
  - Adds `author_email` and `change_summary` columns to `diagrams` table for rich version history.
  - `org_custom_blocks(id UUID PK, organization_id UUID, name VARCHAR(128), category VARCHAR(64), node_type VARCHAR(32), icon VARCHAR(128), tint VARCHAR(32), default_props TEXT, created_at TIMESTAMP WITH TIME ZONE)` for org-level **"My blocks"** (Section 5.4).

---

## 6. Consequences

- **Positive:** Live traffic on `/projects/:id` (or `/`) is completely insulated from draft edits in `/projects/:id/editor` until the user clicks **Publish**.
- **Positive:** Preview mode (`⌘/Ctrl+Enter`) and dry-run test events reuse 100% of `AnimationEngine` and Shop scenario personas without duplicating animation code.
- **Positive:** Every catalog pack is pure JSON validated against `catalog.schema.json`, making future vendor icon swaps (post H-18) zero-code updates.

# FlowTrace — Visual Design Spec (DESIGN.md)

> **Purpose:** remove guesswork from the UI. Concrete tokens, component specs, motion, screen wireframes and ready-to-paste Google Stitch prompts.
> **Companion to:** `spec.md` (section 10 = behaviour), `TASKS.md` / `TASKS_v2.md` (work items). Where numbers differ, **this file wins for visuals**, `spec.md` wins for behaviour.
> **Status:** v1.0 · values are a starting point; tune after seeing the first screens, but change tokens, never hard-code.

---

## 0. Design principles

1. **Calm and alive.** A dark, quiet canvas where motion is the only loud thing. When nothing happens, the screen still breathes (very slow ambient motion).
2. **Motion carries meaning.** Every animation answers a question: *where did it go? did it succeed? how many?* No decorative-only motion.
3. **One accent.** A single cyan → violet gradient identifies "the thing that is moving". Status colours (green / amber / red) are used only for status.
4. **Premium, not busy.** Few borders, soft depth, generous spacing, large touch targets. Think n8n / Linear, not a monitoring dashboard.
5. **Readable first.** Text always passes WCAG AA. Colour is never the only signal (icon or shape too).
6. **Themable by tokens.** Business templates (shop, restaurant…) change the look through token overrides, never through different components.

## 1. Design tokens

All visuals read CSS variables from one file: `frontend/src/styles/tokens.css`. TypeScript mirrors only what the canvas renderer needs (`tokens.ts`, generated from the same source).

### 1.1 Colour — dark theme (default)

```css
:root, [data-theme="dark"] {
  /* surfaces */
  --bg-0: #0B0D12;   /* app background / canvas */
  --bg-1: #11141B;   /* panels, top bar */
  --bg-2: #171B24;   /* cards, nodes */
  --bg-3: #1E2330;   /* hover, inputs */
  --border: #262C3A;
  --border-strong: #343C4F;

  /* text */
  --text-1: #E8ECF4;  /* primary */
  --text-2: #A3ACBF;  /* secondary */
  --text-3: #7C869C;  /* tertiary, still AA on bg-1 (≈5:1) */

  /* brand / motion */
  --accent-a: #22D3EE;  /* cyan */
  --accent-b: #8B5CF6;  /* violet */
  --accent-grad: linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%);

  /* status */
  --ok: #34D399;
  --warn: #F59E0B;
  --error: #F43F5E;
  --info: #60A5FA;
  --discovered: #F59E0B;     /* auto-discovered / unmapped */

  /* node type tints */
  --t-source: #60A5FA;  --t-service: #8B5CF6;  --t-decision: #F59E0B;
  --t-datastore: #34D399; --t-queue: #22D3EE;  --t-external: #94A3B8; --t-end: #F472B6;

  /* depth */
  --shadow-node: 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.35);
  --shadow-pop: 0 12px 40px rgba(0,0,0,.5);
  --glow-accent: 0 0 0 1px rgba(34,211,238,.35), 0 0 24px rgba(139,92,246,.25);
  --grid-dot: rgba(255,255,255,.06);
  --focus-ring: 0 0 0 2px var(--bg-0), 0 0 0 4px #22D3EE;
}
```

### 1.2 Colour — light theme

```css
[data-theme="light"] {
  --bg-0: #F6F7FA; --bg-1: #FFFFFF; --bg-2: #FFFFFF; --bg-3: #F0F2F7;
  --border: #E1E5EE; --border-strong: #CBD2E0;
  --text-1: #0F1420; --text-2: #4A5368; --text-3: #6B7489;
  --accent-a: #0891B2; --accent-b: #7C3AED;
  --accent-grad: linear-gradient(135deg, #0891B2 0%, #7C3AED 100%);
  --ok: #059669; --warn: #D97706; --error: #E11D48; --info: #2563EB; --discovered: #D97706;
  --shadow-node: 0 1px 2px rgba(15,20,32,.06), 0 6px 20px rgba(15,20,32,.08);
  --shadow-pop: 0 12px 40px rgba(15,20,32,.18);
  --glow-accent: 0 0 0 1px rgba(8,145,178,.35), 0 0 20px rgba(124,58,237,.18);
  --grid-dot: rgba(15,20,32,.08);
  --focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px #0891B2;
}
```
Both themes honour `prefers-color-scheme`; the user can override in the top bar.

### 1.3 Spacing, radius, layout

| Token | Value |
|---|---|
| Spacing scale (4 px base) | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 |
| Radius | `--r-sm` 6 · `--r-md` 10 · `--r-lg` 14 (nodes) · `--r-xl` 20 (modals) · `--r-full` 999 |
| Top bar | 56 px |
| Left palette (editor) | 280 px |
| Right inspector drawer | 360 px (full-screen sheet on mobile) |
| Canvas grid | dots every 24 px, 1 px |
| Breakpoints | 640 · 1024 · 1440 |
| Z-index | canvas 0 · edges 1 · nodes 2 · tokens 3 · overlays 10 · drawer 20 · modal 30 · toast 40 |

### 1.4 Typography

- **UI:** Inter (variable), fallback `system-ui, -apple-system, "Segoe UI", sans-serif`. Weights 400 / 500 / 600.
- **Code / node keys:** JetBrains Mono, fallback `ui-monospace, Menlo, monospace`.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 48 / 52 | 600 | landing hero |
| H1 | 32 / 40 | 600 | page titles |
| H2 | 24 / 32 | 600 | sections |
| H3 | 20 / 28 | 600 | drawer titles |
| Body | 14 / 20 | 400 | default |
| Body-L | 16 / 24 | 400 | landing copy |
| Label | 13 / 18 | 500 | buttons, tabs |
| Caption | 12 / 16 | 400 | hints, counters |
| Mono | 12 / 16 | 500 | node keys, snippets |

Numbers that change live (counters) use `font-variant-numeric: tabular-nums` so they do not jitter.

### 1.5 Motion tokens

```css
:root {
  --dur-instant: 100ms; --dur-fast: 160ms; --dur-base: 240ms; --dur-slow: 400ms;
  --ease-standard: cubic-bezier(.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(.3, 0, 0, 1);
  --ease-travel: cubic-bezier(.45, 0, .55, 1);   /* token travel (ease-in-out) */
}
@media (prefers-reduced-motion: reduce) { :root { --dur-base: 0ms; --dur-slow: 0ms; } }
```

## 2. Components

### 2.1 Node card
- **Size:** 208 × 72 (min). Padding 12 × 14. Radius `--r-lg`. Background `--bg-2`, border 1 px `--border`, shadow `--shadow-node`.
- **Content:** icon tile 40 × 40 (radius 10, background = node type tint at 14 % alpha, icon in the tint colour) · label 14/600 `--text-1` · node key in Mono 12 `--text-3` (click-to-copy) · counter pill top-right (height 20, radius full, Caption, `--bg-3`).
- **Ports:** 8 px circles at top and bottom centre; visible on hover and always in editor mode; fill `--bg-0`, border `--border-strong`; hovered port grows to 12 px and takes the accent colour.
- **States:**

| State | Look |
|---|---|
| Idle | as above |
| Hover | border `--border-strong`, lift 1 px (`translateY(-1px)`), 160 ms |
| Selected | `--glow-accent` + 1.5 px accent-gradient border |
| Active (token just arrived) | pulse ring: scale 1 → 1.05 → 1 over 300 ms and a 24 px accent halo that fades out |
| Error | border `--error`, soft red halo, shake ±3 px × 2 over 200 ms |
| Unmapped / discovered | dashed border `--discovered` + small "new" chip |
| Disabled / stale | opacity .5 |

- **Decision node:** same card, left edge accent bar 3 px in `--t-decision`, diamond glyph in the icon tile, caption "decision".
- **Zones / lanes (v2):** rounded rectangles behind nodes, fill `--bg-1` at 60 %, label in Caption uppercase letter-spacing .08em `--text-3`.

### 2.2 Edge (line)
- Path: smooth cubic Bézier, vertical flow by default. Stroke 2 px, colour `--border-strong`, round caps. Arrowhead 8 px.
- **Heat:** stroke colour interpolates `--border-strong` → `--accent-a`; width 2 → 4 px as recent rate rises (clamped; update at most once per second).
- **Trail** of a passing token: a 28 px long segment with the accent gradient fading to 0 over 600 ms.
- **Label chip** at the midpoint: Caption 11, padding 2 × 8, radius full, `--bg-2`, 1 px `--border`.
- Hover: width 3 px and show conversion/latency tooltip. Selected: accent gradient stroke.
- Discovered edge: dashed (6 4) in `--discovered`. Abandon path (v2): dashed in `--text-3`.

### 2.3 Token (dot) — classic mode
- Core circle r = 6, fill = accent gradient; outer ring r = 12 at 25 % alpha; glow via SVG filter `feGaussianBlur stdDeviation=3`.
- Status colours: ok = gradient, error = `--error`, discovered/unmapped = `--discovered`.
- Several tokens on one edge get a small stagger (±3 px lateral offset) so they never overlap exactly.

### 2.4 Entity token (v2 business mode)
- Circle 40 px, background `--bg-3`, 2 px ring in the accent gradient; avatar glyph inside (animal/shape generated from a seed).
- **Carry badge:** bottom-right, 18 px pill, count in Caption 12/600.
- **Item icons:** up to 3 mini icons, 20 px, follow the token with 60 ms stagger, offset −8 px behind; if more than 3 items, show "+N" chip.
- **Total chip** (when `carry.total` exists): below the token, Caption, `--bg-2`, radius full.
- On terminal nodes: items are "absorbed" (scale to 0 along a curve into the node, 300 ms) and the node total counter ticks up.

### 2.5 Other components
| Component | Spec |
|---|---|
| Buttons | Height 36 (default) / 44 (primary CTA). Primary = accent gradient fill, text `#0B0D12` weight 600; Secondary = `--bg-3` fill + `--border`; Ghost = transparent. Radius `--r-md`. Focus = `--focus-ring`. |
| Inputs | Height 36, `--bg-3`, 1 px `--border`, radius `--r-md`; focus = ring. Error: border `--error` + message in Caption `--error`. |
| Chips / badges | Height 20–24, radius full, Caption. Variants: neutral, ok, warn, error, accent. |
| Tabs | Underline 2 px accent gradient, Label type, 160 ms slide. |
| Toolbar (floating) | Pill 44 px high, `--bg-1` at 85 % + backdrop blur 12 px, border `--border`, shadow `--shadow-pop`; bottom-centre on desktop. Controls: Live/Pause, speed (0.25×–4×), Realtime/Smooth, labels, counters, fit, editor toggle. |
| Inspector drawer | 360 px, `--bg-1`, left border `--border`; slides in 240 ms `--ease-emphasized`. |
| Toast | Bottom-right, 320 px, radius `--r-md`, auto-dismiss 4 s. |
| Empty state | 120 px illustration (line art, accent strokes), H3, Body, one primary action. |
| Skeleton | `--bg-3` shimmer, 1.2 s linear loop. |
| Code block | `--bg-0`, 1 px `--border`, Mono 13, copy button top-right, language tabs above. |

## 3. Motion spec (visual detail for `spec.md` 10.3)

| Event | Visual | Duration / easing |
|---|---|---|
| Token travel | along edge path | `clamp(600ms / speed, 250ms, 1500ms)`, `--ease-travel` |
| Arrival | node pulse ring + counter tick | 300 ms, `--ease-standard` |
| Spawn | token scale 0 → 1 + fade, node soft pulse | 200 ms |
| End | token scale 1 → 0 + fade | 300 ms |
| Error | red token, node shake | 200 ms |
| Edge discovered | stroke-dashoffset draw-in | 400 ms |
| Drawer / modal | translate + fade | 240 ms `--ease-emphasized` |
| Ambient idle | very slow drift of grid dots (≤ 4 px / 20 s) and a faint pulse on source nodes | pause when tab hidden |
| Paid (v2) | coin burst: 8–12 particles, 600 ms, gravity-like ease-out | off under reduced-motion |
| Payment failed (v2) | node shake + red flash | 200 ms |
| Abandon (v2) | token fades with a small wave, drifts out of the edge | 500 ms |

Rules: animate only `transform` and `opacity` (plus SVG stroke properties); one `requestAnimationFrame` loop for all tokens; never animate layout. Under `prefers-reduced-motion`, replace travel with an instant edge highlight and a short opacity pulse.

## 4. Screens (wireframes)

### 4.1 Live view (desktop ≥ 1024)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ ◉ logo   Project ▾    ● Live          search trace…   [☾] [Share] [⚙] [👤] │  56px
├───────────────────────────────────────────────────────────────┬───────────┤
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │ INSPECTOR │
│ · · · ┌──────────┐ · · · · · · · · · · · · · · · · · · · · · │ (opens on │
│ · · · │ Website  │ · · · · · · · · · · · · · · · · · · · · · │  select)  │
│ · · · └────┬─────┘ · · · · · · · · · · · · · · · · · · · · · │           │
│ · · · · · ●│ · · · · · · · · · · · · · · · · · · · · · · · · │ node key  │
│ · · · ┌────▼─────┐ · · · · · · · · · · · · · · · · · · · · · │ in / out  │
│ · · · │ Gateway  │ · · · · · · · · · · · · · · · · · · · · · │ last 20   │
│ · · · └──┬────┬──┘ · · · · · · · · · · · · · · · · · · · · · │ traces    │
│ · · ┌────▼┐  ┌▼────┐ · · · · · · · · · · · · · · ┌─────────┐ │           │
│ · · │ A   │  │ B   │ · · · · · · · · · · · · · · │ minimap │ │           │
│ · · └─────┘  └─────┘ · · · · · · · · · · · · · · └─────────┘ │           │
│         ┌──────────────────────────────────────────┐          │           │
│         │ ▶ Live  0.25×─●──4×  Realtime  Labels  ⤢ │ ←toolbar │           │
│         └──────────────────────────────────────────┘          │           │
└───────────────────────────────────────────────────────────────┴───────────┘
```

### 4.2 Editor mode
```
┌──────────────────────────────────────────────────────────────────────────┐
│ top bar: project · Saved ✓ · undo/redo · auto-layout · import/export     │
├───────────┬──────────────────────────────────────────────────────────────┤
│ PALETTE   │ canvas (ports always visible, drag from port to connect)     │
│ ▸ Source  │                                                              │
│ ▸ Service │                    properties popover near selected node:    │
│ ▸ Decision│                    [Label ______] [Key: gateway ⧉]           │
│ ▸ Datastore│                   [Type ▾] [Icon ▾]   ⚠ key change breaks   │
│ ▸ Queue   │                               existing checkpoints           │
│ ▸ Template│                                                              │
└───────────┴──────────────────────────────────────────────────────────────┘
```

### 4.3 Traces / replay
```
┌──────────────────────────────────────────────────────────────────────────┐
│ filters: time ▾ status ▾ node ▾ attr ▾                       [search id] │
├───────────────────────┬──────────────────────────────────────────────────┤
│ trace list            │ canvas replaying the selected trace              │
│ ● 0194f… 120ms ok     │                                                  │
│ ● 0194e… 380ms error  │  ─────────────●──────── timeline scrubber ───── │
│ …                     │  ⏮  ▶  1×   00:01.2 / 00:02.8   loop            │
└───────────────────────┴──────────────────────────────────────────────────┘
```

### 4.4 Project settings → Connect
Tabs: **Keys · Endpoints · Snippets · Auto-discovery · Retention**. Snippets tab: language tabs (curl · Java · Node · Python · netcat/UDP), code block pre-filled with the project key (masked, reveal on click), "Waiting for first event…" status strip that turns green on first event with a short celebration.

### 4.5 Onboarding wizard (3 steps, modal-less full page)
1. **Pick a template** (cards 2 × 3: Web app, Microservices, Queue worker, AI agent, Online shop, Blank).
2. **Connect:** snippet for chosen language + connector options (v2).
3. **Waiting for your first event…** large canvas preview with the sample traffic playing, progress dots, success state.

### 4.6 Landing page (marketing site)
Sections in order: **Nav** (logo · Product · Templates · Docs · Pricing · Log in · Start free) → **Hero** (headline + subheadline + live demo canvas 16:9 with a soft gradient glow; primary CTA + "See live demo") → **How it works** (3 steps with mini animations) → **Use cases** (tabs: Online shop · Microservices · AI agent · Docs & demos; each tab swaps the demo template) → **Embed showcase** ("Put it on your docs page" with code + live embed) → **Pricing teaser** (3 cards) → **FAQ** → **Footer** (docs, status, privacy, terms, security).
Headline options (simple English, B1): "Watch every request travel through your system. Live." · for the shop variant: "Watch customers move through your shop, live."

### 4.7 Shop demo & TV mode (v2)
```
┌───────────────────────────────────────────────────────────────────────────┐
│  visitors now 12   carts now 3   sales today 18   revenue €412   conv 4.1% │ counters strip
│                                                                            │
│  [Store zone]            [Checkout zone]                                   │
│  Visit ─▶ Browse ─▶ Product ─▶ Cart ─▶ Checkout ─▶ Payment ─▶ Paid ✓       │
│    🦊───────────────────────────🕯️🦊──────────────────────🕯️🦊→ 💰          │
│                                    └──▶ Abandoned        └──▶ Failed ✕     │
│                                                       ticker: last sale…   │
│  DEMO DATA                                                       [⛶ TV]   │
└───────────────────────────────────────────────────────────────────────────┘
```
TV mode: chrome hidden, counters 2× larger, slow 1 px/min drift to avoid burn-in, cursor hides after 3 s.

### 4.8 Mobile live view (≤ 640)
Top bar 48 px; canvas fills the screen with pinch-zoom; counters as a horizontal scroll strip under the bar; inspector as a bottom sheet (snap 30 % / 70 %); toolbar collapses to Live/Pause + overflow menu. Editor is view-only on phones.

## 5. Iconography & illustration
- **UI icons:** Lucide (24 px grid, 1.75 px stroke, rounded caps/joins). Node icon tile glyph 22 px.
- **Item icons (v2):** `emoji:` for quick use; curated SVG library (≥ 80) in a single flat style: 24 px grid, 1.75 px stroke, one accent fill at 20 %. Verify licenses (DEC-12).
- **Avatars:** generated from a seed: animal or shape on a pastel disc (12 palettes); no faces of real people.
- **Illustrations:** line art with accent strokes only; no stock photos.

## 6. Template themes (token overrides, v2)

| Theme | When | Changes |
|---|---|---|
| **Dark Neon** (default) | tech, microservices, AI agent | tokens as in 1.1 |
| **Cozy Light** | online shop, restaurant, booking | light base; `--bg-0 #FBF7F2`, `--bg-2 #FFFFFF`, `--border #EADFD3`; accent `#F97316 → #EC4899`; radius +2; softer shadows; warm node tints |
| **Pastel** | education, support | light base `#F5F7FF`; accent `#60A5FA → #A78BFA`; larger radius |

Paid plans may set brand colours and a logo: only `--accent-a`, `--accent-b` and the logo slot are overridable (contrast is validated automatically; reject combinations below AA).

## 7. Brand placeholders
- **Wordmark:** product name in Inter 600, lowercase, tight tracking −0.02em. Name is a placeholder (see DEC-01); logo and strings must read from `branding` config.
- **Logo mark:** a rounded square (radius 8) containing a smooth S-curve with a glowing gradient dot at one end.
- **Favicon:** the gradient dot on `#0B0D12`, 32 × 32 and 180 × 180.
- **OG image:** 1200 × 630, dark canvas with a screenshot of the live diagram and the headline.
- **Voice:** short, plain, friendly; no jargon in the UI ("event" is fine; avoid "telemetry", "observability" in the first screens).

## 8. Accessibility
- Text contrast ≥ 4.5 : 1; UI components ≥ 3 : 1. Token tints must be checked per theme.
- Never rely on colour alone: errors also get an icon and a shake; discovered edges are dashed; statuses have text labels.
- Full keyboard path: Tab through nodes in reading order, Enter opens the inspector, arrow keys pan, `+/-` zoom, `Space` pause/resume.
- Visible focus ring everywhere (`--focus-ring`). Minimum target 36 px (44 px on touch).
- Screen readers: the canvas has an `aria-live="polite"` summary region ("Trace 0194… moved from Gateway to Service A"), throttled to 1 message per second.
- Reduced motion supported (section 3).

## 9. Implementation notes (Angular)
- Tokens live in `tokens.css`; component styles use only variables. No raw hex values in components (lint rule).
- Headless primitives from Angular CDK (overlay, a11y, drag-drop); components are custom. Record in an ADR if a UI library is added.
- Fonts self-hosted (Inter, JetBrains Mono) with `font-display: swap`.
- Canvas: SVG for nodes/edges, tokens in the same SVG layer (switch to a Canvas 2D overlay above ~300 tokens, per `spec.md`).
- Storybook for every component and state in section 2 (see E19-06); visual-regression baselines per theme.
- Test hooks: `data-node-key`, `data-edge-id`, `data-token-id`, `data-trace-id`.

## 10. Google Stitch prompts (copy-paste)

Use the **shared preamble** at the start of every prompt.

**Shared preamble**
> Design system: premium dark UI for a developer/business tool, inspired by n8n and Linear. Background #0B0D12, panels #11141B, cards #171B24, borders #262C3A. Text #E8ECF4 / #A3ACBF. Accent gradient cyan #22D3EE to violet #8B5CF6 used only for moving elements and primary buttons. Status colours: green #34D399, amber #F59E0B, red #F43F5E. Font Inter; node keys in JetBrains Mono. Radius 14 for node cards, 10 for buttons and inputs. Dotted canvas grid, soft shadows, subtle glow on selected items. Calm, spacious, high contrast. Icons: Lucide, 1.75 px stroke.

**Prompt 1 — Live view**
> [preamble] Design the main "Live view" screen of a request-flow visualizer. Full-screen canvas with a dotted background showing a top-to-bottom diagram: Website → Load Balancer → decision "Premium?" → Service A / Service B → Database. Node cards 208×72 with a tinted icon tile, label, monospace key and a small counter pill. Curved connector lines with arrowheads. Show 3 small glowing gradient dots travelling along different lines, one red dot on an error line. Top bar 56 px with project switcher, a green "Live" indicator, search field, theme toggle, Share button. Floating pill toolbar at the bottom centre (Live/Pause, speed slider, Realtime/Smooth, labels toggle, fit-to-screen, Edit). Minimap bottom-right. Right-hand inspector drawer open for the selected node showing its key with a copy button, in/out counters and a list of the last 20 traces.

**Prompt 2 — Editor mode**
> [preamble] Design the diagram editor state of the same screen. Left palette 280 px with grouped node types (Source, Service, Decision, Datastore, Queue, Templates). Canvas with visible connection ports on nodes, one connection being dragged. A properties popover next to the selected node with Label, Key (monospace, copy button, warning that renaming breaks existing checkpoints), Type and Icon dropdowns. Top bar shows "Saved ✓", undo/redo, auto-layout, import/export.

**Prompt 3 — Onboarding wizard**
> [preamble] Design a 3-step onboarding. Step 1: grid of 6 template cards (Web app, Microservices, Queue worker, AI agent, Online shop, Blank) with small animated-looking previews. Step 2: language tabs (curl, Java, Node, Python, netcat) with a code block pre-filled with an API key and a copy button. Step 3: "Waiting for your first event…" with a large live canvas preview, pulsing status strip, and a success state with a subtle celebration when the first event arrives. Friendly, plain-English microcopy.

**Prompt 4 — Landing page**
> [preamble] Design a marketing landing page. Nav: logo, Product, Templates, Docs, Pricing, Log in, "Start free" gradient button. Hero: headline "Watch every request travel through your system. Live.", short subheadline, two buttons ("Start free", "See live demo") and a large 16:9 live diagram demo with a soft cyan-violet glow. Then a 3-step "How it works", a tabbed use-case section (Online shop, Microservices, AI agent, Docs & demos), an "Embed it anywhere" section with a code snippet next to a live embed, a 3-card pricing teaser (Free, Pro, Team), FAQ accordion, footer. Dark, premium, lots of breathing room.

**Prompt 5 — Shop demo + TV mode**
> [preamble, but use a warm light theme "Cozy Light": background #FBF7F2, white cards, borders #EADFD3, accent gradient orange #F97316 to pink #EC4899.] Design a live online-shop flow screen. A counters strip on top (Visitors now, Carts now, Sales today, Revenue today, Conversion). Left-to-right flow in two zones, "Store" and "Checkout": Visit → Browse → Product → Cart → Checkout → Payment → Paid, with branches to "Abandoned" and "Payment failed". Customers are 40 px round fox/panda/cat avatars with a count badge, carrying up to three small item icons (candle, mug, tote bag) behind them. A coin-burst effect on "Paid". A "DEMO DATA" label bottom-left and a fullscreen TV-mode button bottom-right. Also design the TV-mode variant with larger counters and no chrome.

**Prompt 6 — Traces & replay**
> [preamble] Design the Traces/Replay screen: filter bar (time range, status, node, attribute, search by trace ID), a trace list on the left with status dots and durations, the diagram canvas on the right replaying the selected trace with a highlighted path, and a bottom timeline scrubber with play/pause, speed and loop. Trace detail drawer showing a timestamped list of hops with labels and attributes.

**Prompt 7 — Project settings → Connect**
> [preamble] Design the project settings "Connect" page with tabs: Keys, Endpoints, Snippets, Auto-discovery, Retention. Show the Snippets tab: ingest endpoints table (HTTP, UDP, TCP with host:port and copy buttons), masked API key with reveal button, language tabs with code blocks, and a status strip "Waiting for first event…" that has a green connected variant.

## 11. Design QA checklist (agent self-check before marking a UI task done)
- [ ] Only tokens used; no raw hex or px values outside `tokens.css`.
- [ ] Dark and light themes both checked; contrast verified.
- [ ] All states from section 2 exist (hover, focus, selected, error, empty, loading).
- [ ] Animations use only `transform` / `opacity`; reduced-motion path works.
- [ ] 100 tokens animate at 60 fps on a mid laptop; tab-hidden pause verified.
- [ ] Keyboard path and focus ring work; `aria-live` summary active.
- [ ] Screenshots of every changed screen attached (desktop 1440, tablet 1024, mobile 390).
- [ ] Storybook story and visual-regression baseline updated.

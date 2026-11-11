---
name: Calm Telemetry
colors:
  surface: '#111318'
  surface-dim: '#111318'
  surface-bright: '#37393f'
  surface-container-lowest: '#0c0e13'
  surface-container-low: '#1a1b21'
  surface-container: '#1e1f25'
  surface-container-high: '#282a2f'
  surface-container-highest: '#33353a'
  on-surface: '#e2e2e9'
  on-surface-variant: '#bbc9cd'
  inverse-surface: '#e2e2e9'
  inverse-on-surface: '#2e3036'
  outline: '#859397'
  outline-variant: '#3c494c'
  surface-tint: '#2fd9f4'
  primary: '#8aebff'
  on-primary: '#00363e'
  primary-container: '#22d3ee'
  on-primary-container: '#005763'
  inverse-primary: '#006877'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#ffd6a3'
  on-tertiary: '#462b00'
  tertiary-container: '#ffb13b'
  on-tertiary-container: '#6e4600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a2eeff'
  primary-fixed-dim: '#2fd9f4'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb957'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#111318'
  on-background: '#e2e2e9'
  surface-variant: '#33353a'
  bg-0: '#0B0D12'
  bg-1: '#11141B'
  bg-2: '#171B24'
  bg-3: '#1E2330'
  border-structural: '#262C3A'
  border-strong: '#343C4F'
  text-1: '#E8ECF4'
  text-2: '#A3ACBF'
  text-3: '#7C869C'
  status-ok: '#34D399'
  status-warn: '#F59E0B'
  status-error: '#F43F5E'
  status-info: '#60A5FA'
  status-discovered: '#F59E0B'
  node-source: '#60A5FA'
  node-service: '#8B5CF6'
  node-decision: '#F59E0B'
  node-datastore: '#34D399'
  node-queue: '#22D3EE'
  node-external: '#94A3B8'
  node-end: '#F472B6'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 42px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-node-label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-uppercase:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  chip-metric:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is engineered for high-density developer and technical operations workflows, drawing inspiration from modern precision software like Linear and n8n. The visual tone is technical, disciplined, calm, and alive: an obsidian substrate where dynamic graph topologies and live telemetry take visual precedence.

### Aesthetic Foundation
- **Modern Technical Precision**: Built on deep obsidian and slate tones layered with crisp structural micro-borders, low-profile inputs, and high-legibility typographic hierarchies.
- **Selective Vibrant Kinetic Accents**: Visual excitement is concentrated strictly in data flow, execution trails, and focus targets through an electric cyan-to-violet spectrum (`#22D3EE` to `#8B5CF6`).
- **Functional Semantics**: Colors directly map to architecture topology (services, queues, datastores) and operational health (ok, warn, error). Functional nodes never compete with interactive primary controls.

## Colors

The palette operates in strict surface tiers. Pure black is avoided in favor of neutral slate-tinted dark values to reduce eye fatigue across multi-monitor setups.

### Layering Rules
- **Canvas Base (`--bg-0` / `#0B0D12`)**: Root viewport, node graph canvas, code preview backgrounds, and outer port fill.
- **Structural Chrome (`--bg-1` / `#11141B`)**: Navigation bars, side drawers, docked toolbars, and background lanes.
- **Elevated Components (`--bg-2` / `#171B24`)**: Node cards, contextual popovers, edge metrics badges.
- **Interactive Inputs (`--bg-3` / `#1E2330`)**: Input element backgrounds, hovered rows, and secondary action fills.

### Text Contrast
- Primary copy (`--text-1` / `#E8ECF4`) is used for headlines and critical node labels.
- Secondary copy (`--text-2` / `#A3ACBF`) is applied to supportive body and metadata descriptions.
- Tertiary copy (`--text-3` / `#7C869C`) is reserved for uppercase lane titles, monospaced node keys, and deactivated paths.

### Kinetic Gradient
The primary gradient spans from cyan (`#22D3EE`) to violet (`#8B5CF6`) at 135 degrees. It is strictly reserved for:
1. Primary call-to-action buttons (with `#0B0D12` text).
2. Canvas entity packet transitions and selected graph edges.
3. Node selection indicator rings (1.5px) and navigation tab active indicators.

## Typography

The typography pairings maintain clear separation between descriptive content and technical data.

- **Primary Interface**: Rendered with **Inter** using variable weights. Font feature settings must activate `cv02`, `cv03`, and `cv04` for technical legibility.
- **Numbers & Metrics**: Live metrics, counters, and edge chip data must declare `font-variant-numeric: tabular-nums` to prevent visual jitter during streaming updates.
- **Code, Node Keys, and Paths**: Set in **JetBrains Mono**. Node ID tags use the compact `code-sm` token to enable rapid reading in inspection sidebars.

## Layout & Spacing

The layout model is split into an infinite 2D canvas region and surrounding fixed/docked application chrome. All spacing aligns strictly with a 4px base increment.

### Structural Layout Chrome
- **Top Bar**: Fixed 56px height on desktop, shrinking to 48px on mobile (`<= 640px`).
- **Sidebar Palette**: 280px fixed width docked left on viewports `>= 1024px`.
- **Inspector Drawer**: 360px fixed width on desktop; converts to an anchored bottom sheet snapping to 30% and 70% viewport height on screens below 640px.
- **Canvas Dot Grid**: Infinite coordinate space using 1px dots spaced precisely every 24px in `--bg-0` via `rgba(255, 255, 255, 0.06)`.

### Grid & Responsive Breakpoints
- **Mobile (`<= 640px`)**: Single-column vertical stream. Palette and inspector collapse into bottom sheets or drawer overlays. Minimal 16px margins.
- **Tablet (`641px - 1023px`)**: Collapsible panel model. Canvas claims central real estate with floating drawer panels.
- **Desktop (`>= 1024px`)**: Static 3-pane workflow (Left node tool palette, central graph canvas, right-hand parameter inspector).

## Elevation & Depth

Depth is established primarily through tonal surfaces layered with low-opacity structural borders, rather than dramatic drop shadows.

### Elevation Hierarchy
1. **Level 0 (Canvas Base)**: Pure flat `#0B0D12` base. No shadow.
2. **Level 1 (Docked Shell)**: `#11141B` background framed with a 1px border of `#262C3A`.
3. **Level 2 (Nodes & Cards)**: Surface `#171B24` with an inner top-edge highlight:
   `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.35);`
   Border: `1px solid #262C3A`.
4. **Level 3 (Floating Bars & Popovers)**: `#11141B` with 85% opacity and `backdrop-filter: blur(12px)`.
   Shadow: `0 12px 40px rgba(0, 0, 0, 0.5)`.
5. **Level 4 (Modals & Alerts)**: Highest z-index (30-40) with sharp background dimming and high-radius ambient shadows.

### Focus & Selection Halos
- **Active Node Selection**: Replaces the structural border with a 1.5px border of `--accent-grad`, coupled with a soft perimeter halo:
  `box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35), 0 0 24px rgba(139, 92, 246, 0.25);`
- **Interactive Focus Ring**: Dual-layer ring using `0 0 0 2px #0B0D12, 0 0 0 4px #22D3EE`.

## Shapes

The geometric framework balances technical rigor with modern tactile feel.

- **Inputs & Action Buttons**: 10px corner radius (`roundedness: 2`), standardizing compact interaction targets.
- **Node Cards**: 14px outer corner radius, creating clear visual containment for node header glyphs and metric pills.
- **Chips, Ports & Telemetry Tokens**: Full pill shape (`9999px`), distinguishing live data elements and connecting endpoints from static structural panels.
- **Modals & Overlays**: 20px radius to soften focal interruptions.

## Components

### Buttons
- **Primary CTA**: Background is the cyan-to-violet gradient (`linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)`). Text color is strictly set to obsidian `#0B0D12` with 600 weight. Height is 36px (default) or 44px (hero CTA). Padding is 0 16px. Border radius is 10px. Hover introduces a subtle scale pulse and brightness boost.
- **Secondary Action**: Background is `#1E2330` with a 1px border of `#262C3A`. Text is `#E8ECF4`. On hover, border shifts to `#343C4F` and background lightens.
- **Ghost/Tertiary**: No background or border. Text is `#A3ACBF`, shifting to `#E8ECF4` on hover.

### Node Cards
- Dimensions: Minimum 208px width by 72px height.
- Structure: Surface `#171B24`, border 1px `#262C3A`, radius 14px. Inner padding is 12px 14px.
- Left Icon Tile: 40×40px square with a 10px corner radius. Background uses 14% opacity of the semantic node tint; icon glyph centered at 22px size.
- Decision Nodes: Add a persistent 3px solid vertical bar along the left edge using `#F59E0B`.
- Discovered/Unmapped Nodes: 1px dashed border using `#F59E0B`.

### Graph Ports & Connecting Edges
- **Ports**: 8px circular anchor on node boundaries, expanding to 12px on hover with an outer stroke of 2px `#343C4F`. Fill matches canvas `#0B0D12`.
- **Standard Edges**: 2px stroke using `#343C4F`. Curves utilize cubic Bézier smoothing.
- **Selected/Active Edges**: Dynamic width expansion to 3px using the gradient `#22D3EE` to `#8B5CF6`.
- **Discovered Edges**: Dashed pattern `6 4` in `#F59E0B`.

### Chips & Badges
- **Edge Latency / Rate Chips**: Height 20px, radius 9999px, padding 2px 8px. Background `#171B24` with border `#262C3A`. Text uses 11px Inter tabular-nums.
- **Status Badges**: Dot indicator (6px circle) paired with text. Success: `#34D399`; Warning: `#F59E0B`; Error: `#F43F5E`.

### Form Fields & Inputs
- Base height: 36px. Surface fill `#1E2330` with border 1px `#262C3A` and corner radius 10px.
- Text: `#E8ECF4` with placeholder text in `#7C869C`.
- Focus State: Border transitions to `#22D3EE` with a 2px outer gap glow.
- Error State: Border transitions to `#F43F5E` with accompanying caption text.

### Code Blocks & Monospace Snippets
- Base container: `#0B0D12` background, 1px border `#262C3A`, radius 10px, padding 12px 16px.
- Inline Node Keys: Mono 12px (`code-sm`) on `#1E2330` background with 4px radius and click-to-copy tooltip support.
# FlowTrace — Google Stitch prompts (all screens)

> Companion to `DESIGN.md`. Every prompt below is **self-contained**: copy one block, paste into Stitch, generate. Prompts are in English on purpose (better results).
> Two style presets are used: **[D] Dark Neon** (developer-facing product) and **[L] Cozy Light** (shop / small-business surfaces and the shop landing). The preset text is already inside each prompt.

---

## 0. How to use

1. **One screen per prompt.** Do not ask for the whole product at once.
2. **Order matters.** Start with prompt **0** (style board) to lock the look, then **1**, then **22**. If these three look right, everything else follows.
3. Generate **2–3 variants** per screen if Stitch offers it; pick one and refine with the follow-up prompts in section 5.
4. **Save the chosen screens** as PNG into `docs/design/` with the number in the file name, e.g. `01-live-view.png`, `22-shop-demo.png`. Tell the coding agent: *"mockups in `docs/design/` are the visual reference; `DESIGN.md` tokens are the source of truth; ask on conflict."*
5. If a result drifts from the palette, paste the preset again and add: *"Keep the exact colours and radii from the design system."*
6. Static mockups cannot show **motion**. The animation (travelling dots, pulses, coin burst) must be checked in a live prototype (task E19-06 / the design sandbox).

### Priority

| Tier | Prompts | Needed for |
|---|---|---|
| **Must** (start here) | 0, 1, 5, 7, 8, 9, 18, 22, 23 | Gate G1 / G1-S (private beta + public shop demo) |
| **Should** | 2, 3, 4, 6, 10, 11, 14, 16, 19, 20, 24, 25, 29 | Gate G2 |
| **Later** | 12, 13, 15, 17, 21, 26, 27, 28, 30 | After validation |

---

## 1. Style presets (used inside every prompt)

**[D] Dark Neon**
> Premium dark UI for a developer tool, inspired by n8n and Linear. Colours: background #0B0D12, panels #11141B, cards #171B24, borders #262C3A, text #E8ECF4 and #A3ACBF. Accent gradient cyan #22D3EE to violet #8B5CF6 used only for moving elements and primary buttons. Status colours: green #34D399, amber #F59E0B, red #F43F5E. Font Inter; monospace JetBrains Mono for keys and code. Radius 14 on node cards, 10 on buttons and inputs. Dotted canvas grid, soft shadows, subtle glow on selected items. Calm, spacious, high contrast. Lucide icons with 1.75 px stroke.

**[L] Cozy Light**
> Warm, friendly light UI for small business owners. Colours: background #FBF7F2, white cards, borders #EADFD3, text #1F1A17 and #6B5F57. Accent gradient orange #F97316 to pink #EC4899 used for moving elements and primary buttons. Status colours: green #059669, amber #D97706, red #E11D48. Font Inter. Radius 14 on cards, 10 on buttons and inputs. Soft warm shadows, rounded, playful but clean and uncluttered. Lucide icons with 1.75 px stroke.

---

## 2. Core product screens (desktop 1440×900, [D] unless noted)

### 0 — Style board (do this first)
> Premium dark UI for a developer tool, inspired by n8n and Linear. Colours: background #0B0D12, panels #11141B, cards #171B24, borders #262C3A, text #E8ECF4 and #A3ACBF. Accent gradient cyan #22D3EE to violet #8B5CF6 for moving elements and primary buttons. Status colours: green #34D399, amber #F59E0B, red #F43F5E. Font Inter, JetBrains Mono for code. Design a single "design system board" screen, desktop 1440×900. Show: colour swatches with hex codes; typography scale (Display, H1, H2, Body, Caption, Mono); buttons (primary gradient, secondary, ghost, disabled); inputs (default, focus, error); chips and badges (neutral, ok, warn, error, accent); a workflow node card 208×72 in six states (idle, hover, selected with glow, active pulse, error red, dashed "discovered"); a connector line with arrowhead and a label chip; a small glowing gradient dot token with a trail, and a red error token; a toast; a tab bar; a code block with copy button. Clean grid layout, generous spacing.

### 1 — Live view
> [D] Desktop 1440×900. Design the main "Live view" of a request-flow visualizer. Full-screen canvas with a dotted background showing a top-to-bottom diagram: Website → Load Balancer → decision "Premium?" → Service A and Service B → Database. Node cards 208×72 with a tinted icon tile, bold label, monospace key in grey and a small counter pill top-right. Smooth curved connector lines with arrowheads and small label chips ("yes", "no"). Show three small glowing gradient dots travelling along different lines with short fading trails, and one red dot on an error line; the Service B card has a soft red error halo. Top bar 56 px: logo mark, project switcher, a green "Live" indicator, search field "search trace id…", theme toggle, Share button, avatar. Floating pill toolbar bottom-centre: Live/Pause, speed slider 0.25×–4×, Realtime/Smooth toggle, labels toggle, fit-to-screen, Edit button. Small minimap bottom-right. Right-hand inspector drawer (360 px) open for the selected node: key with copy button, in/out counters, mini sparkline, list of the last 20 traces with status dots.

### 2 — Editor mode
> [D] Desktop 1440×900. Design the diagram editor state of the live view. Left palette 280 px with collapsible groups: Source, Service, Decision, Datastore, Queue, External, Templates, each item an icon tile with a name. Canvas with visible connection ports on every node, one connection line being dragged from a port with a glowing end. A small properties popover attached to the selected node: Label field, Key field in monospace with a copy button and an amber warning "Changing the key breaks existing checkpoints", Type dropdown, Icon dropdown. Top bar: project name, "Saved ✓" indicator, undo/redo, auto-layout, import/export, Done button. A dashed amber "discovered" edge with Accept / Reject buttons.

### 3 — Traces and replay
> [D] Desktop 1440×900. Design the Traces / Replay screen. Top filter bar: time range, status, node, attribute filter, search by trace ID. Left column: list of traces with status dots, short IDs in monospace, durations, timestamps. Right: the diagram canvas replaying the selected trace with its path highlighted in the accent gradient and one token mid-travel. Bottom: timeline scrubber with hop markers, play/pause, speed 1×, loop toggle, time "00:01.2 / 00:02.8". A trace detail drawer on the right with a vertical timeline of hops (node name, timestamp, label, attributes as key-value chips).

### 4 — Node inspector, deep dive
> [D] Desktop 1440×900. Design a full-height right drawer "Node details" over a dimmed diagram. Header with node icon, label, monospace key and copy button. Tabs: Overview, Traces, Settings. Overview: in/out counters, error rate, average hop latency, a small line chart of the last 15 minutes, top 5 incoming and outgoing edges with percentages. Traces tab: table of recent traces through this node with status, duration, attributes. Settings tab: rename, change type, icon, delete with confirmation.

### 5 — Project settings: Connect (endpoints and snippets)
> [D] Desktop 1440×900. Design a project settings page with a left tab list: Keys, Endpoints, Snippets, Auto-discovery, Retention. Show the Snippets tab: an endpoints card listing HTTP, UDP and TCP rows with host:port in monospace and copy buttons; a masked API key row with Reveal and Copy; language tabs (curl, Java, Node, Python, netcat/UDP) above a dark code block with syntax colours and a copy button; a status strip at the bottom "Waiting for first event…" with a pulsing dot, and a second variant of the strip in green "Connected — last event 2 s ago".

### 6 — API keys management
> [D] Desktop 1440×900. Design an "API keys" page. Table columns: Name, Key prefix (monospace, e.g. ft_live_a1b2…), Scopes (chips: ingest, read), Last used (relative time), Rate limit, Status, row menu (Rotate, Revoke). "Create key" primary button. Show an open modal "New key": name field, scope checkboxes, rate-limit select, then a success state showing the full key once in a code block with a Copy button and an amber note "You won't see this key again."

### 7 — Onboarding, step 1: choose a template
> [D] Desktop 1440×900. Design step 1 of a 3-step onboarding wizard with a slim progress bar at the top (1 Template, 2 Connect, 3 First event). Headline "What do you want to watch?" and a grid of 6 template cards (2 rows × 3): Web app, Microservices, Queue worker, AI agent, Online shop, Blank canvas. Each card has a mini diagram preview with a tiny glowing dot, a title and a one-line description. One card selected with accent glow. Primary button "Continue" bottom-right, "Skip" ghost link.

### 8 — Onboarding, step 2: connect
> [D] Desktop 1440×900. Design step 2 of the onboarding: "Send your first event". Left: language tabs (Java, Node, Python, curl, UDP) and a code block pre-filled with a masked API key and a three-line checkpoint example, with Copy button. Right: a small live preview of the chosen template with muted nodes and a pulsing "Waiting" ring on the first node. Bottom: Back and Continue buttons, a link "I'll do this later — show me the demo traffic".

### 9 — Onboarding, step 3: waiting and success
> [D] Desktop 1440×900. Design step 3 in two states side by side. State A "Waiting for your first event…": large calm canvas with the template diagram, a pulsing ring on the source node, a status pill with spinner, helper text and a "Send a test event" button. State B "It's alive!": the same canvas now animated, three glowing dots travelling, a green check, a subtle confetti of small gradient particles, counters showing 1 event, and a primary button "Open live view".

### 10 — Projects home
> [D] Desktop 1440×900. Design the logged-in home: top bar plus a sidebar (Projects, Templates, Alerts, Billing, Team, Docs). Main area: "Projects" heading, "New project" gradient button, and a grid of project cards, each with a mini live diagram thumbnail showing two moving dots, project name, events today, a green/amber status dot and last event time. A usage card on the right: "Events this month 62k / 100k" progress bar in accent gradient and an "Upgrade" secondary button.

### 11 — Template gallery
> [D] Desktop 1440×900. Design the template gallery. Left filter list: All, Developer, Commerce, Service, AI. Main: search field and a grid of 9 template cards with animated-looking mini diagrams, name, short description and a "Use template" button on hover. Categories shown as chips. A featured banner at the top for "Online shop — watch customers fill their carts, live".

### 12 — Alerts and webhooks
> [D] Desktop 1440×900. Design an "Alerts" page with tabs Rules, Channels, History. Rules tab: list of rules as cards, e.g. "Error rate on Gateway → Service A above 5 % for 5 min", "No events for 10 min", each with an on/off switch, channel chips (Email, Slack, Webhook) and last-fired time. A "New rule" side panel open: metric select, node/edge select, threshold, window, channels, "Test fire" button. Channels tab hints at webhook delivery log with status codes.

### 13 — Billing and usage
> [D] Desktop 1440×900. Design a "Billing" page. Current plan card (Pro, €19/month, renews date) with Manage and Change plan buttons. Usage section: three horizontal meters (Events 1.2M / 2M, Projects 3 / 5, Retention 7 days) in accent gradient with an amber state when above 80 %. Plans comparison row of Free, Pro, Team, Business with the current plan highlighted. Invoices table with date, amount, status chip and Download link. Payment method card.

### 14 — Share and embed
> [D] Desktop 1440×900. Design a "Share" modal over the live view with two tabs: Public link and Embed. Public link: toggle, read-only URL with copy, expiry select, "Revoke" button, a "Privacy mode — anonymous icons only" toggle (on by default), a note about the watermark on the Free plan. Embed tab: code block with an iframe snippet, options (theme, speed, hide controls), allowed domains field, and a live preview of the embed on the right.

### 15 — Team and members
> [D] Desktop 1440×900. Design a "Team" page: members table with avatar, name, email, role select (Owner, Admin, Member, Viewer), last active, row menu; pending invitations list with Resend and Revoke; an "Invite" modal with email field and role select; a small permissions matrix card explaining roles.

### 16 — Login and sign-up
> [D] Desktop 1440×900. Design a split-screen auth page. Left 45 %: logo, headline "Watch your requests move.", form with "Continue with Google", "Continue with GitHub", divider, email and password fields, primary "Create account" button, link "Already have an account? Log in", small legal text. Right 55 %: a large decorative animated-looking diagram with glowing dots on a dark gradient background.

### 17 — Quota reached and upgrade
> [D] Desktop 1440×900. Design the live view with a top banner "You've used 100 % of this month's events. New events are paused." with an amber icon and an "Upgrade" gradient button, plus an upgrade modal comparing Free vs Pro in two columns with checkmarks and a clear price, and a secondary "Maybe later".

---

## 3. Marketing site and docs

### 18 — Landing page, developer variant (desktop, [D])
> [D] Desktop 1440 wide, full-page scroll. Navigation: logo, Product, Templates, Docs, Pricing, Log in, "Start free" gradient button. Hero: headline "Watch every request travel through your system. Live." (Display 48, white), subheadline in grey, two buttons ("Start free", "See live demo"), and below it a large 16:9 live diagram demo in a rounded frame with a soft cyan-violet glow and travelling dots. Section "How it works": three numbered steps with mini illustrations (Add a checkpoint, Send an event, Watch it move). Tabbed use-case section (Online shop, Microservices, AI agent, Docs and demos) with the demo changing per tab. Section "Embed it anywhere": a code snippet beside a live embed. Pricing teaser with three cards. FAQ accordion. Footer with Docs, Status, Privacy, Terms, Security. Dark, premium, lots of breathing room.

### 19 — Landing page, "Live shop" variant (desktop, [L])
> [L] Desktop 1440 wide, full-page scroll. Navigation: logo, How it works, Templates, Pricing, Log in, "Try the live demo" gradient button. Hero: headline "Watch customers move through your shop, live." subheadline "See who visits, what they put in the cart, and where they pay — as it happens.", two buttons ("Try the live demo", "See how it works") and a large rounded demo frame showing a left-to-right shop flow with round fox, panda and cat avatars carrying small item icons (candle, mug, tote bag). Below: three benefit cards (See your sales live, Spot where people leave, Works with your shop), a section with logos placeholders for platforms, a "Screen for your shop wall" section showing a TV-mode screenshot, a pricing teaser and FAQ. Friendly, warm, plain English.

### 20 — Pricing page ([D])
> [D] Desktop 1440 wide. Headline "Simple, predictable pricing", monthly/annual toggle ("2 months free" badge). Four plan cards: Free €0, Pro €19, Team €79, Business "from €249", the Pro card highlighted with an accent border and "Most popular" chip. Each card lists projects, events per month, retention, members and key features with checkmarks. Below: a comparison table, a note "Hard limits — no surprise bills", and an FAQ accordion.

### 21 — Docs home and quickstart ([D])
> [D] Desktop 1440×900. Design a documentation site. Left sidebar navigation (Getting started, Concepts, Protocol, SDKs, Connectors, API reference, Guides). Top bar with search (⌘K) and version select. Main content: "Quickstart" page with language tabs, numbered steps, code blocks with copy buttons, an info callout, and an "On this page" outline on the right. Clean typographic hierarchy, generous line length.

---

## 4. Business / shop screens

### 22 — Shop demo ([L])
> [L] Desktop 1440×900. Design a live online-shop flow screen. A counters strip at the top: Visitors now, Carts now, Sales today, Revenue today (€), Conversion. Below, a left-to-right flow in two soft zones labelled "Store" and "Checkout": Visit → Browse → Product → Cart → Checkout → Payment → Paid, with branches down to "Abandoned" and "Payment failed". Customers are 40 px round avatars (fox, panda, cat) with a count badge; some carry up to three small item icons trailing behind (candle, mug, tote bag) and a small total chip like "€37.50". A coin-burst effect at the "Paid" node, a node total counter, a "last sale" ticker at the bottom. A small "DEMO DATA" label bottom-left and a fullscreen "TV mode" button bottom-right.

### 23 — TV mode ([L] and [D] variants)
> [L] Desktop 1920×1080, fullscreen TV mode for a shop wall screen. No browser chrome. Counters strip twice as large across the top. The shop flow fills the screen with large avatars carrying item icons, a "Sale!" toast with coin burst, and a bottom ticker "Lavender candle + Mug sold · €24.00". Very legible from three metres. Generate a second version in the dark neon palette (background #0B0D12, accent cyan to violet).

### 24 — Owner mobile view (PWA, [L], 390×844)
> [L] Mobile 390×844. Design the shop owner's phone view. Top: shop name and a green "Live" dot. A horizontally scrollable counters strip (Visitors now, Carts now, Sales today, Revenue). A compact diagram of the shop flow with a few avatars moving, pinch-zoomable. A "Latest sales" ticker list with item icons, totals and relative times. Bottom sheet handle for details. Bottom tab bar: Live, Sales, Alerts, Settings.

### 25 — Connector setup wizard ([L])
> [L] Desktop 1440×900. Design a "Connect your shop" wizard, step 1 of 3 (Platform, Connect, Check). A grid of platform cards: Website snippet, Google Tag Manager, Stripe, Shopify, WooCommerce, Zapier / Make / n8n, Custom webhook — each with a logo placeholder, a one-line description and a "Recommended" or "Coming soon" chip. Selected card shows a right panel with three plain-English setup steps and a "Test connection" button with states Waiting, Connected, Error.

### 26 — Webhook field mapping ([L])
> [L] Desktop 1440×900. Design a "Map your data" screen. Left: pasted sample JSON in a code block with clickable fields. Right: mapping rows "This field → means": Step (select a node), Customer, Item name, Item price, Quantity, Result (success / failed). Each row shows the picked JSON path in monospace and a live preview chip. Bottom: a mini flow preview showing how a test event would appear, and a "Send test event" button.

### 27 — Business insights ([L])
> [L] Desktop 1440×900. Design a "Insights" page for a shop: KPI cards (Sales today, Revenue, Conversion, Average cart), a funnel of the flow steps with percentages and drop-off highlighted in amber, a "Top abandoned items" list with item icons and values (aggregated, no personal data), and a comparison toggle "Today vs yesterday vs last week".

### 28 — Daily digest email ([L], 600 px wide)
> [L] Email template, 600 px wide, warm light style. Header with logo and date. Big numbers: sales, revenue, conversion. A small funnel graphic, "Top abandoned items" with icons, "Best hour" highlight, a primary "Open live view" button and a quiet footer with unsubscribe. Friendly, short sentences.

---

## 5. Mobile and admin

### 29 — Mobile live view ([D], 390×844)
> [D] Mobile 390×844. Design the developer live view on a phone: 48 px top bar (logo, project name, Live dot), canvas filling the screen with a small diagram and glowing dots, a horizontally scrolling counters strip under the bar, a collapsed pill toolbar (Live/Pause and a "…" menu) at the bottom, and an inspector bottom sheet half-open for a selected node with key, counters and recent traces.

### 30 — Admin console ([D], internal)
> [D] Desktop 1440×900. Design an internal admin console. Search bar for organizations and users. Result detail view: organization header (plan, status chip, created date), usage meters, members list, recent events graph, and an action bar (Suspend, Unsuspend, Resend email, View as user). A red-bordered audit log table at the bottom. Dense but readable, utilitarian version of the same dark style.

---

## 6. Follow-up prompts (iterate on a generated screen)

- **Palette fix:** "Keep the exact colours, radii and fonts from the design system. Remove any colours that are not in the palette."
- **More air:** "Increase spacing between elements by about 25 % and reduce the number of borders; use shadow depth instead."
- **Bigger nodes:** "Make the node cards slightly larger and the labels more legible; keep monospace keys small and grey."
- **Light theme:** "Create the same screen in a light theme: background #F6F7FA, white cards, borders #E1E5EE, accent cyan #0891B2 to violet #7C3AED."
- **Mobile version:** "Create a 390×844 mobile version of this screen with a bottom sheet instead of the side drawer."
- **Tablet version:** "Create a 1024×768 tablet version; the inspector becomes a slide-over."
- **Error state:** "Show the same screen with an error state: one red token, a red halo on the failing node and an error toast."
- **Empty state:** "Show the empty state with a friendly line-art illustration, one sentence and one primary action."
- **Loading state:** "Show skeleton loading placeholders for cards, table rows and the canvas."
- **Accessibility:** "Increase text contrast to at least 4.5:1 and add visible focus rings; do not rely on colour alone for status."
- **Make the dots glow:** "Make the travelling dots clearly visible: radius 6, accent gradient, soft glow and a short fading trail."

## 7. Hand-off checklist
- [ ] Prompts 0, 1 and 22 generated, one variant chosen each, saved to `docs/design/`.
- [ ] Colours and radii checked against `DESIGN.md` tokens; token file updated if you prefer the generated values.
- [ ] Remaining "Must" prompts generated (5, 7, 8, 9, 18, 23).
- [ ] Screens exported (PNG, plus Figma or code export if Stitch offers it) and committed.
- [ ] Coding agent told: mockups = visual reference, tokens = source of truth, ask on conflict.
- [ ] Animation reviewed on a live prototype, not on static images.

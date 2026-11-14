# Build Your First Diagram (Advanced Diagram Editor Guide)

The FlowTrace Advanced Diagram Editor (`/projects/:projectId/editor`) lets you design, customize, preview, and publish request-flow topologies from a blank canvas or remix any existing template.

---

## 1. Opening the Editor

You can open the Advanced Diagram Editor from three places:

1. **Onboarding Wizard**: Select **Blank canvas** (or click *Skip template and start blank*) to open the editor on a fresh draft.
2. **Live View Toolbar**: Click **Edit Diagram** in the bottom floating toolbar.
3. **Projects Home**: Click the **Draw / Edit Diagram** icon on any project card.

All edits are made on an isolated **Draft** (`PUT /api/v1/projects/{id}/diagram/draft`) and autosaved every 1.5 seconds. Live traffic continues animating against the last **Published** diagram version until you click **Publish**.

---

## 2. Placing Blocks from the Block Library

The left **Block Library** (`280px`) organizes blocks into data-driven packs:

- **Standard**: `Start / Client`, `Service`, `Decision (if)`, `Parallel Split`, `Join / Merge`, `Datastore`, `Queue`, `Cache`, `External API`, `End`, `Note`, and `Group / Zone`.
- **Shop**: `Visit`, `Browse`, `Product`, `Cart`, `Checkout`, `Payment`, `Paid`, `Payment Failed`, `Abandoned`, `Shipping`, and `Refund` (pre-configured with carry and outcome roles).
- **AWS / Google Cloud / Tech**: Compute, storage, database, networking, and messaging blocks with neutral icons and customizable vendor labels.
- **AI Agent**: `LLM Call`, `Tool Call`, `Vector Memory`, `Agent Orchestrator`, and `Human Approval`.
- **Business**: Restaurant, Delivery, Booking, SaaS, and Support lifecycle checkpoints.
- **My Blocks**: Save any customized block on your canvas as a reusable organization block.

### Ways to Add a Block
- **Click** a block in the library to place it at the center of the current viewport.
- **Drag and drop** a block from the library onto any canvas coordinate.
- **Double-click** empty canvas space to open the Quick-Add menu at the cursor.
- **Press `Ctrl+K` (`Cmd+K`)** to open the keyboard Command Palette.
- **Drag from an output port into empty space** and release to pick a compatible target block and auto-connect it in one step.

---

## 3. Connecting Blocks and Defining Request Flow Rules

Drag from a block's **output port** to another block's **input port** (or use **Connect to block...** in the Inspector for keyboard-only navigation). Self-loops on the same block are supported for modeling retries.

Select any connection to configure its **Flow Rules** in the right-hand Inspector:

| Property | Purpose |
|---|---|
| **Label / Condition** | Shown on the canvas pill (`paid`, `declined`, `retry`, `cache miss`). Matched against incoming event `outcome`, `branch`, or `status` fields. |
| **Split Weight (%)** | Used on outgoing branches of a `Decision` block so Preview Flow routes synthetic requests according to your probability split. |
| **Expected Latency (ms)** | Controls token travel duration in Preview Mode and sets the latency warning threshold in Live View. |
| **Animation Speed Multiplier** | Scales token speed along this specific connection (`0.5x` to `2.0x`). |
| **Token Style Override** | Forces tokens on this edge to render as `Success (emerald)`, `Warning (amber)`, or `Error (rose)`. |
| **Ends the Request** | Marks the connection as terminal so tokens complete and fade out upon arrival. |

---

## 4. Configuring Block Checkpoints & Sending Test Events

Click any block to open the 5-tab Inspector:

1. **General**: Edit the human-readable `Label`, the technical `Key` (`[a-z0-9-_.]{1,64}`), `Block Type`, and `Description`. Renaming a key that received events in the last 24 hours offers a **Keep old key as alias for 7 days** toggle so existing services keep resolving cleanly.
2. **Appearance**: Customize the 10-color `Tint`, `Shape` (`card`, `pill`, `diamond`), `Size` (`S`, `M`, `L`), `Library Icon`, or `Custom Image URL` (proxied safely through `/api/v1/image-proxy`).
3. **Behaviour**: Set the block's **Flow Role** (`normal`, `start`, `end`, `decision`, `success`, `failure`, `abandon`), port limits, `Expected Dwell (ms)`, `Idle Abandon (minutes)`, and Shop **Carry Action** (`add`, `remove`, `clear`).
4. **Integration**: Copy a ready-to-run snippet (`cURL`, `Node.js`, `Python`, `Java`, `Go`, or `UDP`) pre-filled with the block's `key`, click **Send test event**, and inspect the last 5 real events received for that key.
5. **Advanced**: View raw read-only JSON for the block or save it to **My Blocks**.

---

## 5. Previewing Request Flow (`Ctrl+Enter`)

Click **Preview** in the top bar (or press `Ctrl+Enter`) to run a client-side synthetic request across your draft diagram:

- Uses the same `AnimationEngine` as the Live View, including Shop entity avatars and carried items (`Cart` -> `Checkout` -> `Paid`).
- Evaluates `Decision` branch weights and highlights the active path.
- Displays a **Preview Summary Card** with the hop sequence, cumulative latency (`ms`), terminal outcome (`success`, `failure`, or `abandon`), and any unreachable blocks.
- Select any **two blocks** (`Shift+Click`) to highlight all directed paths between them.

---

## 6. Validation and Publishing

The **Validation** badge in the top bar and drawer at the bottom of the Inspector check your diagram continuously:

- **Errors (block Publish)**: Duplicate or invalid block keys, dangling edges, or exceeding plan limits.
- **Warnings (Publish allowed)**: No `Start` block, no `End`/outcome block, unreachable blocks, `Decision` blocks with fewer than 2 outgoing branches, or directed cycles without a `retry` label.

Click **Publish** (`POST /api/v1/projects/{id}/diagram/publish`) to create a new immutable diagram version and atomically update the live topology cache. You can restore any prior published version into your draft from the **History** modal.

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Open Add Block command palette |
| `Ctrl+Enter` / `Cmd+Enter` | Run Preview Flow |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo (up to 120 steps, persisted across reloads) |
| `Ctrl+S` / `Cmd+S` | Save draft immediately |
| `Ctrl+D` / `Cmd+D` | Duplicate selected blocks |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste selected blocks |
| `Ctrl+G` / `Cmd+G` | Group selected blocks into a collapsible Zone |
| `Delete` / `Backspace` | Delete selected elements |
| `Arrow keys` / `Shift+Arrows` | Nudge selected blocks by `1 px` / `10 px` |
| `0` / `F` | Fit entire diagram / Fit selection to screen |
| `Space + Drag` | Pan canvas |
| `?` | Open keyboard shortcuts help |

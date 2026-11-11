# AGENTS.md — FlowTrace Coding Agent Instructions

> **Source of truth:** `spec.md` (and `docs/PROTOCOL.md` for sections 5–6).

## Golden Rules

1. **Work one milestone at a time (M0 → M8)**; do not start the next before the current Definition of Done (DoD) passes. Tick items in `docs/PROGRESS.md`.
2. **Write/refresh ADRs before coding each milestone** in `docs/adr/NNNN-*.md` (short Context / Decision / Consequences). Prefer the defaults in `spec.md`; deviate only with a recorded reason.
3. **Pinned versions (verified at implementation time):**
   - Java: `21` (Temurin 21.0.13 LTS; `/home/antigravity/.local/jdk21` in VM)
   - Quarkus BOM: `3.20.4` (LTS)
   - Angular: `22.2.x` (standalone components, signals, `@if`/`@for` control flow, strict TypeScript)
   - Layout engine: `elkjs` `0.12.1` + custom deterministic hierarchical layout
   - AWS CDK (`aws-cdk-lib`): `2.275.0`
   - PostgreSQL: `16` in Docker / RDS (`15+` compatible for local native dev)
4. **Hexagonal / Clean Architecture:**
   - `dev.flowtrace.domain` stays 100% framework-free (pure Java 21 records/classes, no Quarkus/Jakarta/Vert.x/Jackson imports).
   - `dev.flowtrace.application` orchestrates use cases (`IngestEventUseCase`, `ResolveHopUseCase`, `ManageProjectUseCase`, `DemoSimulatorService`, `ReplayTraceUseCase`) via port interfaces.
   - Inbound adapters (`adapter.in.http`, `adapter.in.udp`, `adapter.in.tcp`, `adapter.in.ws`) and outbound adapters (`adapter.out.pg`, `adapter.out.fanout`) depend inward only.
5. **Non-blocking Live Path:**
   - Never block ingest threads (HTTP/UDP/TCP).
   - Never let database writes or a slow WebSocket UI client affect the live ingest or fanout path.
   - Bounded queues everywhere; on overflow, drop and increment Micrometer metrics (`ingest_dropped_total`, `ws_dropped_total`).
6. **Testing:**
   - Every public behaviour in sections 5 (protocols), 6.1 (hop resolution), and 10.3 (animation/scheduler) must have automated unit/integration tests.
7. **Commits:**
   - Keep commits small and conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
8. **Scope discipline:**
   - Do not add features listed under "Out of scope / later" (section 21).
9. **Cloud ↔ Local Agent Handoff & Traceability (`docs/WORKLOG.md`):**
   - This repository is worked on by both **Cloud agents** (remote VM) and **Local agents** (developer's machine).
   - **Before starting any task:** run `git status` / `git pull --rebase` and read `docs/WORKLOG.md` and `docs/PROGRESS.md` to understand the latest session context, recent changes, and next steps.
   - **After completing any task or session:** prepend a new structured entry under `## История сессий (Trace Log)` in `docs/WORKLOG.md` (recording date, environment `cloud-vm` or `local`, goal, exact files changed, tests run, and next steps), update `docs/PROGRESS.md` if milestone items changed, commit, and `git push`.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

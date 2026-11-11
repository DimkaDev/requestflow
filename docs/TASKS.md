# FlowTrace — SaaS Productization Backlog (TASKS.md)

> **For:** Google Antigravity (Agent Manager). **Companion to:** `spec.md` v0.1 (product + architecture).
> **Goal:** turn the working v1 into a real SaaS: accounts, teams, billing, quotas, onboarding, website, docs, security, operations.
> **Baseline assumption:** milestones M0–M8 from `spec.md` exist in some form. Epic **E0 verifies this first**. Do not trust it blindly.
> **Status:** v1.0 · Put this file at `docs/TASKS.md`. Keep `docs/PROGRESS.md` as the live status.

---

## 0. How to run this in Antigravity

1. **One epic = one agent task** in Agent Manager. Run independent epics in parallel, each on its own branch/worktree. Independent after E1: E3 (billing), E8 (website), E10 (observability), E12 (infra).
2. **Plan first.** For every task marked ⚠ (auth, billing, data migration, infra, security) the agent must produce an *Implementation Plan* artifact and wait for human approval before writing code.
3. **Small commits**, conventional messages (`feat:`, `fix:`, `chore:`), one PR per task or per small group of tasks.
4. **Evidence.** UI tasks: attach screenshots or a short browser recording. Backend tasks: attach test output. Infra tasks: attach `cdk diff`.
5. **Tick the box** here and add one line to `docs/PROGRESS.md` when a task is done.
6. **Versions:** verify current stable versions of every dependency at implementation time and pin them. Do not rely on remembered versions.
7. **No secrets in the repo.** Use `.env.example` + AWS Secrets Manager / SSM.
8. **Scope discipline:** do not build anything that is not in this file. If something is missing, add a task here and flag it; do not silently expand scope.

## 1. Conventions

- **ID:** `<EPIC>-<NN>` (e.g. `E3-03`). Human-only tasks: `H-NN`. Decisions: `DEC-NN`.
- **Priority:** `P0` = required for the gate it belongs to · `P1` = should have · `P2` = later.
- **Size (agent effort):** `S` ≤ ½ day · `M` ≈ 1–2 days · `L` ≈ 3–5 days.
- **Format:** `- [ ] **ID** (Priority, Size) Title — acceptance criteria. Deps: …`

### Global Definition of Done (applies to every task)
- Unit + integration tests added and green; CI green; lint clean.
- DB migrations are forward-safe (expand/contract) and tested on a copy of realistic data.
- OpenAPI and docs updated when behaviour changes.
- Logs + metrics added for new behaviour; no PII in logs.
- User-visible features sit behind a feature flag until the gate opens.
- Tenant isolation test added when the task touches data access.

## 2. Release gates

| Gate | Name | Scope | Exit criteria |
|---|---|---|---|
| **G0** | Baseline verified | E0 | Audit report done; build/tests/load baseline recorded; blockers fixed |
| **G1** | Private beta (invite-only, free) | all **P0** in E1, E2, E4, E5, E8 (landing + demo + waitlist), E10, E11, E12, E14 (basic) | A stranger can sign up, create a project, send the first event and see it animate in < 5 min; isolation tests pass; alarms work |
| **G2** | Public launch + paid plans | E3, E6 (share/embed), E7-01, E9, E15, remaining P0/P1 | A stranger can pay, hit a quota, upgrade, cancel; docs complete; status page live |
| **G3** | Scale & trust | E6-09/10/11/12, E7 rest, E11 rest, E13 rest, SSO | Only start when metrics in the analysis doc justify it |

> **Rule:** do not start G3 work before G1 exit metrics (activation, external integrations) are reviewed by the human. This is a validation-first plan.

## 3. Decisions needed from the human (agent must not decide these)

| ID | Decision | Default if no answer (agent may proceed with this, flagged) |
|---|---|---|
| DEC-01 | Final product name (**"FlowTrace" is already used by other projects**, see analysis) | Keep name in a single constant/config; do not hard-code anywhere (E0-06) |
| DEC-02 | Billing provider: Stripe Billing vs a Merchant of Record (Paddle / Lemon Squeezy) | Spike E3-01, then wait |
| DEC-03 | Plans and prices | Use the hypothesis table in section 4, config-driven |
| DEC-04 | Open-core / self-host edition? | Closed source, cloud only |
| DEC-05 | Keep Amazon Cognito for auth? | Yes |
| DEC-06 | Marketing site stack | Astro (static) |
| DEC-07 | Product analytics tool | PostHog (EU cloud), cookieless mode |
| DEC-08 | Transactional email provider | Amazon SES |
| DEC-09 | Legal entity / VAT setup | Human-only (H-02) |
| DEC-10 | Data residency | EU only (`eu-west-1`) |

## 4. Plans & entitlements (HYPOTHESIS — must be config, not code)

Store plans in a config table/YAML read by one `Entitlements` service. Changing a limit must not need a deploy.

| Limit | Free | Pro (€19/mo) | Team (€79/mo) | Business (from €249/mo) |
|---|---|---|---|---|
| Projects | 1 | 5 | 20 | custom |
| Events / month | 100k | 2M | 20M | custom |
| Trace retention | 24 h | 7 d | 30 d | 90 d |
| Members | 1 | 3 | 10 | custom |
| Share links / embeds | yes, **watermark** | yes | yes | yes + branding |
| Alerts / webhooks | – | – | yes | yes |
| HMAC-signed UDP, audit log, SSO | – | – | – | yes |
| Over-quota behaviour | **hard stop** | soft cap + email | soft cap + email | contract |

Principle: **predictable bills, no surprise overage** (hard caps; overage billing is a flagged P2 option, default OFF).

## 5. Domain model additions (sketch — refine in ADR)

```
organizations(id, name, slug, plan_id, billing_customer_id, created_at, deleted_at)
memberships(org_id, user_id, role)                 -- owner|admin|member|viewer
invitations(id, org_id, email, role, token_hash, expires_at, accepted_at)
projects(+ org_id)                                 -- replaces owner_id
api_keys(+ org_id, scopes[], last_ip_hash)
plans(id, config jsonb)                            -- entitlements
subscriptions(org_id, provider, provider_sub_id, status, current_period_end, cancel_at_period_end)
usage_counters(org_id, project_id, period /*YYYY-MM*/, events, dropped)
share_links(id, project_id, token_hash, expires_at, revoked_at, embed_origins[])
webhooks(id, project_id, url, secret, events[], active) ; webhook_deliveries(...)
alert_rules(id, project_id, type, params jsonb, channels[], active)
audit_log(id, org_id, actor_id, action, target, meta jsonb, at)
feature_flags(key, default, overrides jsonb)
```

---

## 6. Epics and tasks

### E0 — Baseline audit & stabilization (Gate G0)
- [ ] **E0-01** (P0, S) Build + run all tests locally and in CI; list every failure — AC: `docs/audit/baseline.md` lists status of build, tests, lint, docker-compose boot.
- [ ] **E0-02** (P0, M) Gap analysis `spec.md` vs code — AC: table of every requirement in spec sections 5–16 → Done / Partial / Missing with file references; top 10 gaps ranked.
- [ ] **E0-03** (P0, S) Pin and audit dependencies (Maven + npm) — AC: no critical CVEs; versions pinned; report attached.
- [ ] **E0-04** (P0, M) Performance baseline with the simulator at 500 and 2,000 events/s over HTTP/UDP/TCP — AC: p95 ingest→UI and memory recorded in `docs/PERF.md`; compare with spec section 15.
- [ ] **E0-05** (P0, M) Fix blockers found in E0-01..04 — AC: tests green; ingest never blocks; UI holds 60 fps with 100 tokens.
- [ ] **E0-06** (P0, S) Centralize the brand name (backend config, frontend env, docs, package names) — AC: renaming the product = one config change + one search/replace documented in `docs/BRANDING.md`. Deps: DEC-01.

### E1 — Multi-tenancy & teams
- [ ] **E1-01** ⚠ (P0, L) Introduce organizations — AC: new tables per section 5; `projects.owner_id` migrated to `org_id`; every existing user gets a personal org; all queries scoped by `org_id`; migration tested on realistic data.
- [ ] **E1-02** (P0, M) Roles Owner/Admin/Member/Viewer with a permission matrix enforced in the **application layer** — AC: matrix documented; unit tests per role per use case.
- [ ] **E1-03** ⚠ (P0, M) Tenant-isolation safety net — AC: automated test fails the build if a repository query lacks org scope; cross-tenant access tests for every endpoint (IDOR suite); optional Postgres RLS as defense-in-depth (ADR).
- [ ] **E1-04** (P1, M) Invitations by email (token, 7-day expiry, resend/revoke) — AC: full invite → accept → role works; expired/used token rejected.
- [ ] **E1-05** (P1, S) Org settings page (name, slug, members, delete org with 30-day soft delete) — AC: owner-only deletion; data purged after 30 days by job.
- [ ] **E1-06** (P1, M) Audit log for keys, members, billing, project deletion — AC: UI list with filters; retention 1 year.

### E2 — Auth & accounts
- [ ] **E2-01** ⚠ (P0, M) Self-service signup/login with email verification and password reset (Cognito unless DEC-05 changes) — AC: new user reaches the app without manual steps; unverified accounts cannot create projects.
- [ ] **E2-02** (P0, S) Social login: Google + GitHub — AC: account linking by verified email; no duplicate accounts.
- [ ] **E2-03** (P0, M) API key management UX: create / revoke / rotate, scopes (`ingest`, `read`), per-key rate limit, last used, prefix display, shown-once secret — AC: revoked key stops working within 60 s; scopes enforced by tests.
- [ ] **E2-04** (P0, S) Session security: short-lived access token + refresh, logout, secure cookies/CSRF where applicable — AC: security checklist item signed off.
- [ ] **E2-05** (P1, S) Account deletion + personal data export (GDPR) — AC: self-service; export is a downloadable JSON/ZIP; deletion verified by test.
- [ ] **E2-06** (P1, M) Personal access tokens for the management API (CI use) — AC: scoped, revocable, audited.
- [ ] **E2-07** (P1, M) Optional TOTP MFA — AC: enroll, verify, recovery codes.
- [ ] **E2-08** ⚠ (P2, L) SSO (SAML/OIDC) for Business plan — AC: tested with one external IdP. Do not start before G3.

### E3 — Billing & plans (Gate G2)
- [ ] **E3-01** (P0, M) Spike: Stripe Billing vs Merchant of Record (Paddle / Lemon Squeezy) — AC: ADR comparing fees, EU VAT handling, invoicing, tax compliance burden for a solo founder in Belgium, API quality. **Human decides (DEC-02).**
- [ ] **E3-02** (P0, M) Entitlements engine — AC: plans loaded from config; `Entitlements.check(org, limit|feature)` is the only place limits are read; unit tests for every plan.
- [ ] **E3-03** ⚠ (P0, L) Checkout + subscription lifecycle — AC: customer creation, checkout, **signature-verified idempotent webhooks**, upgrade/downgrade with proration, cancel at period end, optional 14-day trial (config); tested in provider test mode.
- [ ] **E3-04** (P0, M) Billing UI — AC: current plan, usage meter, upgrade CTA, invoices, link to customer portal.
- [ ] **E3-05** (P0, S) Provider resync tool (admin) — AC: rebuild subscription state from provider if a webhook was missed.
- [ ] **E3-06** (P1, M) Dunning — AC: payment failed → emails → 7-day grace → downgrade to Free (data read-only, not deleted).
- [ ] **E3-07** (P1, M) VAT/tax + invoice details (EU B2B VAT ID, reverse charge) — AC: depends on DEC-02/DEC-09; test invoices reviewed by the human.
- [ ] **E3-08** (P1, S) Annual plans and coupon codes — AC: annual = 10 × monthly (config); coupons single-use/limited.
- [ ] **E3-09** (P2, M) Usage-based overage behind a flag (default OFF) — AC: hard cap remains the default.

### E4 — Metering, quotas, limits, abuse
- [ ] **E4-01** (P0, M) Usage counters (events per org/project/month) — AC: in-memory counters flushed to DB every ≤ 10 s; **never blocks ingest**; monthly rollover; ≤ 1 % drift documented.
- [ ] **E4-02** (P0, M) Quota enforcement per plan — AC: Free at 100 % → drop + HTTP `429` + `dropped` counter; paid plans soft cap + notification; UI banner shows state.
- [ ] **E4-03** (P0, S) Quota notifications at 80 % and 100 % (email + in-app) — AC: sent once per period per threshold.
- [ ] **E4-04** (P0, M) Retention by plan — AC: partition-drop job honours org plan; Free = 24 h; tested.
- [ ] **E4-05** (P1, M) Abuse controls — AC: per-IP and per-key rate limits, max TCP connections per key, UDP flood = drop + metric, key-leak heuristic (usage from many IPs), auto-suspend with admin override.
- [ ] **E4-06** (P1, S) Payload guard — AC: reject/redact obvious secrets in `attrs` (JWT-like strings, card-number patterns); docs warning.
- [ ] **E4-07** (P2, M) Usage API + daily history chart — AC: `GET /orgs/{id}/usage`; chart in billing page.

### E5 — Onboarding & activation (the main growth lever)
- [ ] **E5-01** (P0, M) Onboarding wizard — AC: create project → pick template (Web app, Microservices, Queue worker, AI agent) → language tabs with copy-paste snippet pre-filled with the key → **"Waiting for first event…"** screen that detects the first event live and celebrates. Metric: time-to-first-event.
- [ ] **E5-02** (P0, M) **Public demo page, no signup** — AC: read-only live animated demo of the sample diagram at `/demo`; embeddable in the landing page; rate-limited and cached.
- [ ] **E5-03** (P0, S) Sample project with always-on demo traffic for every new org — AC: user sees motion within 2 s of first login.
- [ ] **E5-04** (P1, S) Empty states + checklist (create key, send event, invite teammate, create share link) — AC: checklist persists and auto-ticks.
- [ ] **E5-05** (P1, S) Lifecycle emails (welcome, "no first event in 24 h" nudge, weekly digest, opt-out) — AC: template tests; unsubscribe works.
- [ ] **E5-06** (P2, M) Template gallery (importable diagram JSON) — AC: ≥ 6 templates incl. AI agent flow.

### E6 — Product features that sell
- [ ] **E6-01** (P0, M) Public share link (read-only live view) — AC: tokenized, revocable, optional expiry; Free plan shows watermark; no data beyond the diagram + tokens is exposed.
- [ ] **E6-02** (P0, L) Embeddable widget (`<iframe>` + web component) for docs/landing pages — AC: options (theme, speed, hide controls); `frame-ancestors` allowlist per project; loads < 1.5 s; works on a static HTML page.
- [ ] **E6-03** (P1, M) Recording export: PNG/SVG snapshot and WebM/GIF clip of the live view — AC: Free = watermark; this is the marketing flywheel (shareable clips).
- [ ] **E6-04** (P1, M) Multiple diagrams per project + `env` tag on events (dev/stage/prod) — AC: switcher in UI; events routed by `env`.
- [ ] **E6-05** (P1, M) Edge latency (avg/p95 from server timestamps), shown in tooltip and heat colour — AC: verified against simulator with known delays.
- [ ] **E6-06** (P1, L) Alerts (error rate on node/edge > X % over N min; "silence" alert when no events for N min) → email/Slack/webhook — AC: rule CRUD, test-fire button, deduplication.
- [ ] **E6-07** (P1, M) Outgoing webhooks (HMAC-signed, retries with backoff, delivery log) — AC: replay from UI.
- [ ] **E6-08** (P1, M) Trace search by indexed `attrs`, status, node; saved filters — AC: query p95 < 300 ms on 1M events.
- [ ] **E6-09** (P2, L) Redis fanout + horizontal scaling + autoscaling policy (ADR) — AC: 2+ tasks behind NLB/ALB; WS client sees events ingested on any task; load test proves it. Do not start before G3.
- [ ] **E6-10** (P2, L) OTLP/HTTP ingest adapter mapping spans → nodes/hops with mapping rules — AC: Java OTel agent sample shows live in the UI.
- [ ] **E6-11** (P2, M) Long-term retention to S3 (Parquet) for Business — AC: replay reads from S3 transparently.
- [ ] **E6-12** (P2, L) AI-agent flows: event adapters/templates for agent frameworks, token/cost attributes — AC: gated by validation result (see analysis doc); ask the human before starting.
- [ ] **E6-13** (P2, M) Replay upgrades (loop, range select, shareable replay link) — AC: deterministic playback test.

### E7 — SDKs & integrations
- [ ] **E7-01** (P0, M) Publish `client-java` to Maven Central — AC: signed artifacts, sources/javadoc, README quick start. **Needs H-08 (namespace verification).**
- [ ] **E7-02** (P1, S) Context propagation spec: header `X-FlowTrace-Id` (+ mapping from/to W3C `traceparent`) — AC: documented; helpers in Java.
- [ ] **E7-03** (P1, M) Java framework helpers: CDI/Quarkus interceptor `@FlowCheckpoint("node")`, servlet/JAX-RS filter that creates/propagates trace ID, Spring Boot starter — AC: example apps run live.
- [ ] **E7-04** (P1, M) Node/TypeScript SDK (npm; HTTP + UDP; zero deps; ESM/CJS; types) — AC: never throws into host app; contract tests pass.
- [ ] **E7-05** (P1, M) Python SDK (PyPI; HTTP + UDP; `@checkpoint` decorator; asyncio-friendly) — AC: same as above.
- [ ] **E7-06** (P1, S) Shared contract tests + JSON-schema golden vectors for all SDKs — AC: every SDK passes the same vectors.
- [ ] **E7-07** (P2, M) Go SDK · **E7-08** (P2, M) .NET SDK · **E7-09** (P2, M) CLI `flowtrace` (send test event, tail stream, validate diagram).

### E8 — Public website (separate static site)
- [ ] **E8-01** (P0, M) Marketing site in `/website` (Astro per DEC-06) on S3 + CloudFront — AC: Lighthouse ≥ 95 on mobile; deploy in CI.
- [ ] **E8-02** (P0, M) Landing page: hero with the **live embedded demo** (E5-02), 3 use cases, "how it works" in 3 steps, pricing teaser, CTA — AC: plain simple English; loads < 2 s; A/B-ready (two message variants for different audiences).
- [ ] **E8-03** (P0, S) Pricing page generated from plan config — AC: one source of truth with E3-02; honest limits and FAQ.
- [ ] **E8-04** (P0, S) Waitlist / lead capture (email + "what do you want to visualize?" multi-choice) — AC: stored, double opt-in or clear consent, welcome email; the answer drives positioning decisions.
- [ ] **E8-05** (P1, M) Docs site (Starlight/Docusaurus) — AC: quickstart per language, protocol reference, API reference from OpenAPI, troubleshooting; search.
- [ ] **E8-06** (P1, S) SEO basics: sitemap, OG images, structured data, `robots` — AC: validated.
- [ ] **E8-07** (P1, S) Changelog + public roadmap + blog scaffold — AC: RSS feed.
- [ ] **E8-08** (P1, S) Comparison pages ("vs Kiali", "vs Datadog APM service map", …) — AC: **only verifiable facts with source links and a "last checked" date**; no unverified claims.
- [ ] **E8-09** (P2, M) Gallery of community embeds / showcase — AC: submission form + moderation.

### E9 — Documentation & developer experience
- [ ] **E9-01** (P0, M) Quickstart ≤ 5 minutes per language, **examples executed in CI** — AC: pipeline fails if a doc snippet breaks.
- [ ] **E9-02** (P1, S) Public `PROTOCOL.md` + `event.schema.json`, versioning and deprecation policy — AC: linked from docs and dashboard.
- [ ] **E9-03** (P1, M) Example repos (Quarkus, Spring Boot, Express, FastAPI) with docker-compose — AC: each runs with one command and shows a live diagram.
- [ ] **E9-04** (P1, S) Machine-readable ingest error codes + catalogue — AC: every reject path has a code, doc entry and metric.
- [ ] **E9-05** (P1, S) Public status page + incident history — AC: reflects the synthetic canary (E10-03).

### E10 — Platform observability (dogfood the product)
- [ ] **E10-01** (P0, M) Structured JSON logs with correlation IDs; dashboards for ingest rate, drop rate, WS sessions, DB flush lag, hop p95, 5xx — AC: dashboards as code.
- [ ] **E10-02** (P0, M) Alarms → SNS → email/Telegram/Slack: latency, 5xx, drop rate, DB connections, disk, cert expiry, billing webhook failures — AC: each alarm has a runbook link and was test-fired.
- [ ] **E10-03** (P1, S) Synthetic canary: every minute send an event over HTTP, UDP and TCP in prod and assert arrival on a WS client — AC: failure pages the owner; the canary flow is rendered in FlowTrace itself.
- [ ] **E10-04** (P1, S) SLOs proposed and documented (ingest availability, end-to-end latency) with error budget policy — AC: numbers proposed from measured baseline (E0-04), not invented.
- [ ] **E10-05** (P1, S) AWS Budgets + cost dashboard + monthly cost report — AC: alert at 80 % of budget.
- [ ] **E10-06** (P1, M) Error tracking for backend and frontend (free-tier Sentry or self-hosted GlitchTip), source maps — AC: test error appears with stack trace.

### E11 — Security & compliance
- [ ] **E11-01** ⚠ (P0, M) Threat model (STRIDE) for ingest, WS, billing, tenant boundaries — AC: `docs/security/threat-model.md` + mitigation backlog.
- [ ] **E11-02** (P0, M) Supply-chain checks in CI (OWASP dependency-check/Trivy, `npm audit`, Renovate/Dependabot) — AC: build fails on critical findings.
- [ ] **E11-03** (P0, S) Secrets audit + rotation runbook — AC: nothing sensitive in git history; rotation tested once.
- [ ] **E11-04** (P0, M) AuthZ/IDOR test suite across all endpoints and WS — AC: runs in CI.
- [ ] **E11-05** (P1, M) AWS WAF managed rules + rate-based rules on ALB/CloudFront — AC: blocked-request metrics visible.
- [ ] **E11-06** (P1, M) CSP/security headers for app and embeds — AC: scanner grade A; embeds honour `frame-ancestors`.
- [ ] **E11-07** (P1, M) Encryption at rest/in transit; TLS listener for TCP ingest on NLB — AC: documented; TLS 1.2+ only.
- [ ] **E11-08** (P1, M) Backups + PITR + **restore drill executed** — AC: RPO/RTO stated; drill log in `docs/RUNBOOK.md`.
- [ ] **E11-09** (P1, M) GDPR pack (privacy policy, ToS, DPA template, sub-processor list, data-flow map, retention policy, deletion/export flows) — AC: drafts ready for **human/legal review** (H-04); EU region only.
- [ ] **E11-10** (P1, S) `security.txt` + vulnerability disclosure policy — AC: published.
- [ ] **E11-11** (P1, S) HMAC-signed UDP option for Team+ — AC: spoofed datagrams rejected; documented in protocol.
- [ ] **E11-12** (P2, L) External penetration test + fix cycle (human-arranged) · **E11-13** (P2, L) SOC 2-lite readiness checklist — only if enterprise demand appears.

### E12 — Infrastructure & DevOps
- [ ] **E12-01** ⚠ (P0, M) Separate `dev`, `staging`, `prod` environments (separate stacks; preferably separate AWS accounts) + promotion pipeline — AC: staging mirrors prod topology; prod deploy needs approval.
- [ ] **E12-02** ⚠ (P0, M) Prod hardening — AC: Multi-AZ RDS, deletion protection, ECS deployment circuit breaker with auto-rollback, health checks, tagged resources.
- [ ] **E12-03** (P0, M) Zero-downtime deploys for WebSockets + expand/contract migration policy — AC: UI auto-reconnects during deploy (tested); no failed ingest during rolling deploy beyond documented UDP loss.
- [ ] **E12-04** (P0, S) Transactional email domain (SES + SPF/DKIM/DMARC + bounce/complaint handling) — AC: mail-tester style check passes.
- [ ] **E12-05** (P1, M) Cost controls — AC: tagging, dev env auto-stop nights/weekends, no NAT Gateway unless justified (ADR), monthly report.
- [ ] **E12-06** (P1, S) IaC drift detection + `cdk diff` in PRs.
- [ ] **E12-07** (P1, M) Disaster-recovery runbook + game day — AC: executed once, findings fixed.
- [ ] **E12-08** (P2, M) Ephemeral preview environment per PR (auto-destroy) · **E12-09** (P2, S) Automated dependency updates.

### E13 — Quality
- [ ] **E13-01** (P0, M) E2E suite (Playwright) for critical journeys: signup → project → snippet → first event → token animates; upgrade in provider test mode; share link; embed — AC: runs on every PR to staging.
- [ ] **E13-02** (P1, M) Nightly load/soak test against staging (2k events/s for 1 h) — AC: p95 and memory assertions; trend stored.
- [ ] **E13-03** (P1, M) Visual regression of the canvas with deterministic clock — AC: baseline screenshots committed.
- [ ] **E13-04** (P1, S) Accessibility audit (axe) + keyboard navigation + reduced motion — AC: no serious violations.
- [ ] **E13-05** (P1, S) Browser smoke matrix (Chrome, Firefox, Safari, iOS Safari, Android Chrome) — AC: documented results.
- [ ] **E13-06** (P2, M) Chaos tests (kill task, DB failover, network drop) — AC: UI recovers; behaviour documented.

### E14 — Product analytics
- [ ] **E14-01** (P0, S) Event taxonomy: `visit`, `demo_viewed`, `signup_completed`, `project_created`, `snippet_copied`, `first_event_received`, `second_day_active`, `share_link_created`, `embed_viewed`, `upgrade_started`, `upgrade_completed`, `churned` — AC: documented, typed constants.
- [ ] **E14-02** (P0, M) Privacy-friendly analytics (DEC-07; cookieless where possible) + server-side events for activation and billing — AC: funnel visible end to end; no PII in event props.
- [ ] **E14-03** (P1, M) Founder dashboard + weekly email: funnel, activation rate, time-to-first-event, MRR, churn, top use cases — AC: numbers match DB on a test dataset.
- [ ] **E14-04** (P1, S) Use-case question at signup ("What do you want to visualize?" — web/microservices, AI agents, docs/demo, teaching, business process, other) — AC: stored per org; used to segment all funnels.

### E15 — Admin & support
- [ ] **E15-01** ⚠ (P1, M) Admin console (`platform_admin`): find org/user, plan, usage, suspend/unsuspend, resend emails — AC: every action audited.
- [ ] **E15-02** (P1, S) Feature flags with per-org overrides + kill switches per protocol/org — AC: toggle takes effect < 60 s.
- [ ] **E15-03** (P1, S) Support intake: `support@` alias + in-app contact form attaching org, plan, last errors — AC: arrives with context; no unnecessary PII.
- [ ] **E15-04** (P2, M) Read-only "view as" impersonation with time limit and audit.

### H — Human-only tasks (agent cannot do these)
- [ ] **H-01** Choose the final name; check trademark (EUIPO TMview), domains, npm/PyPI/Maven namespaces. Name collisions are documented in the analysis.
- [ ] **H-02** Legal form and registration in Belgium, VAT number, EU digital-services VAT approach — with an accountant.
- [ ] **H-03** Open the billing-provider account, complete KYC, connect bank.
- [ ] **H-04** Have ToS / Privacy / DPA reviewed by a lawyer or reputable templates.
- [ ] **H-05** Pricing decision (DEC-03) after real conversations, not before.
- [ ] **H-06** Recruit 10 design partners; run async-first interviews (written messages, short calls only if needed).
- [ ] **H-07** Launch plan: Show HN, Product Hunt, dev.to, relevant subreddits/communities, LinkedIn; demo video.
- [ ] **H-08** Verify Maven Central namespace; create npm/PyPI publisher accounts.
- [ ] **H-09** Write the support policy and response-time promise (be conservative).
- [ ] **H-10** Run the Gate reviews using the metrics and kill criteria in the analysis document.

---

## 7. Suggested sequence

| Sprint | Focus | Gate |
|---|---|---|
| S0 | E0 (audit, perf baseline, brand constant) | **G0** |
| S1 | E1, E2 (core), E12-01/02, E11-01/02/03 | – |
| S2 | E4, E5, E8-01..04, E10-01/02, E14-01/02/04, E11-04, E12-03/04, E13-01 | **G1** (private beta) |
| S3 | E3, E6-01/02/03, E7-01..03, E9, E15, E8-05..08 | – |
| S4 | rest of P1 (E6-04..08, E7-04..06, E11 P1, E13 P1) | **G2** (public + paid) |
| later | P2 items, only after metrics review | **G3** |

## 8. Kickoff prompts (copy-paste into Antigravity Agent Manager)

**Prompt A — baseline (G0)**
> Read `docs/spec.md` and `docs/TASKS.md`. Execute epic E0 only. First produce an Implementation Plan artifact. Then run the build, tests and load baseline, write `docs/audit/baseline.md` and `docs/PERF.md`, fix blockers, and centralize the brand name (E0-06). Do not start any other epic. Report evidence (test output) for each task.

**Prompt B — tenancy + auth (G1 foundation)**
> Execute E1-01, E1-02, E1-03 and E2-01..E2-04 from `docs/TASKS.md`. These are marked ⚠: produce an Implementation Plan including the data-migration approach and the isolation test strategy, then wait for my approval before coding. Verify current stable versions of all dependencies. Each task needs tests and an isolation test where data access is touched.

**Prompt C — activation (G1 experience)**
> Execute E5-01..E5-03 and E8-01..E8-04. UI work must follow the animation spec in `docs/spec.md` section 10. Attach screenshots or a short browser recording for each screen. The public demo page must work without signup and must be embeddable in the landing page.

**Prompt D — billing (G2)**
> Do E3-01 only: write the ADR comparing Stripe Billing vs a Merchant of Record for a solo founder in Belgium (fees, EU VAT, invoicing, ops burden, API quality) with sources. Stop and wait for my decision (DEC-02). Do not write billing code yet.

## 9. Traps (agent must avoid)
- Do **not** build SSO, SOC 2 work, autoscaling or Redis fanout before G3.
- Do **not** hard-code plan limits; always read them from the entitlements config.
- Do **not** make claims about competitors on the website without a source link and date.
- Do **not** run more than one backend task in AWS until E6-09 is done (UDP/TCP spread across tasks breaks live fanout).
- Do **not** log event `attrs` contents at INFO level; treat them as customer data.
- Do **not** change the public protocol (`PROTOCOL.md`) without a version bump and an ADR.

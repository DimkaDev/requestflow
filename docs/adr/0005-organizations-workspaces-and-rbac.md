# ADR-0005: Multi-Tenant Organizations, Workspaces & Role-Based Access Control (Epic 1)

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
In the initial MVP (M0–M8), `projects` belonged directly to a single `owner_id` (`users.id`). To evolve FlowTrace into a commercial B2B SaaS (Phase S1, Epic 1 in `docs/SAAS_ROADMAP.md`), engineering teams must collaborate within shared Organizations and Workspaces under granular Role-Based Access Control (RBAC), while preserving 100% backward compatibility with existing single-user API callers and integration tests.

## Decision
1. **Tenant Hierarchy (`Organization` → `Workspace` → `Project`):**
   - `organizations`: top-level tenant boundary holding `name`, unique `slug`, `billing_email`, and `plan_tier` (`FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`).
   - `workspaces`: logical environment grouping within an organization (e.g., `Production`, `Staging`).
   - `projects`: linked to `organization_id` and `workspace_id` while retaining `owner_id` for audit/backward compatibility.
   - **Zero-downtime Auto-Provisioning:** When any user authenticates (`ensureUser`), if they have no organization membership, a personal organization and `Default Workspace` are automatically provisioned and any unlinked legacy projects owned by that user are bound to it.
2. **Five-Role RBAC Matrix (`OrgRole` & `OrgPermission`):**
   - `OWNER`: Full control, including organization deletion, billing, and ownership transfer.
   - `ADMIN`: Manage members, invitations, workspaces, projects, and ingest API keys.
   - `MEMBER`: View and edit diagrams, run demo/simulations, and inspect traces.
   - `VIEWER`: Read-only access to live canvas, diagrams, and traces; cannot modify diagrams or manage API keys.
   - `BILLING_ADMIN`: Manage subscription plan and billing settings (`BILLING_MANAGE`, `ORG_VIEW`); restricted from reading traces, diagrams, or API keys.
3. **Invitations & Onboarding (`E1-Step-3`, `E1-Step-5`):**
   - Invitations are generated with a cryptographic token (`ft_inv_<32 chars>`) and a 7-day TTL (`expires_at`).
   - Only the SHA-256 hash (`token_hash`) and a short display prefix (`token_prefix`) are persisted in PostgreSQL; the plaintext token is returned only once on creation or `POST .../invitations/{id}/resend` and sent via `InvitationNotifier`.
4. **Organization Soft Delete (`E1-Step-6`):**
   - Deleting an organization sets `organizations.deleted_at = CURRENT_TIMESTAMP` instead of immediately dropping tenant data.
   - Soft-deleted organizations are immediately blocked from UI/API access and live event ingestion (`org_deleted` drop reason), can be restored by an Owner within 30 days, and are permanently purged by a scheduled background job after 30 days.
5. **Tenant Isolation Guard & Audit Log (`E1-Step-7`, `E1-Step-8`):**
   - Every sensitive organization, workspace, member, invitation, project, and API key action is recorded in `audit_log` (`V3__audit_log.sql`) and queryable via `GET /api/v1/organizations/{orgId}/audit-logs`.
   - Automated tenant-isolation tests verify both repository SQL scoping and cross-tenant HTTP 403 enforcement across all resource endpoints.

## Consequences
- Existing `/api/v1/projects` endpoints continue to work seamlessly for single users and automated tests while enforcing role permissions across multi-user organizations.
- `BILLING_ADMIN` and `VIEWER` restrictions, hashed invitation tokens, 30-day soft-delete lifecycle, and audit trails are enforced in the application layer and verified by unit and integration tests.

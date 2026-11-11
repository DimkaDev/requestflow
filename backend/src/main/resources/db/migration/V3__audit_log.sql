-- V3__audit_log.sql
-- Epic 1 (E1-Step-5, E1-Step-6, E1-Step-8):
-- 1. Invitation SHA-256 token_hash & token_prefix
-- 2. Organization 30-day soft delete (deleted_at)
-- 3. Multi-tenant audit_log table

ALTER TABLE invitations ALTER COLUMN token DROP NOT NULL;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_prefix VARCHAR(32);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_action ON audit_log(organization_id, action);

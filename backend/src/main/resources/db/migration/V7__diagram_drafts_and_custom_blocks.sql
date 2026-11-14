-- V7__diagram_drafts_and_custom_blocks.sql
-- Diagram editor drafts, version metadata, and org-level custom blocks (E26)

CREATE TABLE IF NOT EXISTS project_diagram_drafts (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    draft_version INT NOT NULL DEFAULT 1,
    based_on_version INT NOT NULL DEFAULT 1,
    graph TEXT NOT NULL,
    updated_by VARCHAR(255) NOT NULL DEFAULT 'dev@flowtrace.local',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS author_email VARCHAR(255) DEFAULT 'dev@flowtrace.local';
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS change_summary VARCHAR(512) DEFAULT 'Published diagram';

CREATE TABLE IF NOT EXISTS org_custom_blocks (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'Custom',
    node_type VARCHAR(32) NOT NULL DEFAULT 'service',
    role VARCHAR(32) NOT NULL DEFAULT 'normal',
    icon VARCHAR(128) NOT NULL DEFAULT 'lib:cpu',
    tint VARCHAR(32) NOT NULL DEFAULT '#8B5CF6',
    key_pattern VARCHAR(64) NOT NULL DEFAULT 'custom-block',
    default_props TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_custom_blocks_org ON org_custom_blocks(organization_id, created_at DESC);

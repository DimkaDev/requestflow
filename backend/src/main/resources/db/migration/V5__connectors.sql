-- V5__connectors.sql: E-Commerce Storefront Connectors & Webhook Mapping (Gate G1-E / E20)

CREATE TABLE IF NOT EXISTS project_connectors (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    connector_type VARCHAR(32) NOT NULL,
    token_prefix VARCHAR(16) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    mapping_json TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    last_event_at TIMESTAMP WITH TIME ZONE,
    total_events BIGINT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_connectors_project ON project_connectors(project_id);
CREATE INDEX IF NOT EXISTS idx_project_connectors_token_hash ON project_connectors(token_hash);

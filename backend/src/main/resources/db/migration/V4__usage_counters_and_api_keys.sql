-- V4: Usage counters by date/project/org & extended API key model (scopes, last_ip_hash, expires_at)

CREATE TABLE IF NOT EXISTS usage_counters (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    events_count BIGINT NOT NULL DEFAULT 0,
    bytes_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_org_date ON usage_counters(organization_id, bucket_date);

-- Extend api_keys table with scopes, GDPR-compliant hashed IP and expiration for seamless rotation
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes VARCHAR(64) NOT NULL DEFAULT 'ingest';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_ip_hash VARCHAR(64);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);

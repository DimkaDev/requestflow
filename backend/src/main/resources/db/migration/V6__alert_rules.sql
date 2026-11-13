CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    window_seconds INT NOT NULL DEFAULT 300,
    target_node VARCHAR(120),
    channel_type VARCHAR(32) NOT NULL,
    channel_target TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    muted_until TIMESTAMP WITH TIME ZONE,
    last_fired_at TIMESTAMP WITH TIME ZONE,
    fire_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_project_id ON alert_rules(project_id);

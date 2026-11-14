-- Epic E3: Subscriptions, Invoices, B2B VAT Profile, and Idempotent Billing Webhooks

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'sandbox',
    provider_customer_id VARCHAR(128),
    provider_subscription_id VARCHAR(128),
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'FREE',
    billing_interval VARCHAR(16) NOT NULL DEFAULT 'MONTHLY',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    grace_period_ends_at TIMESTAMP WITH TIME ZONE,
    company_name VARCHAR(255),
    billing_country VARCHAR(8),
    vat_id VARCHAR(64),
    promo_code VARCHAR(64),
    discount_percent INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_invoice_id VARCHAR(128) NOT NULL,
    plan_tier VARCHAR(32) NOT NULL,
    billing_interval VARCHAR(16) NOT NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL,
    invoice_pdf_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_created
    ON billing_invoices(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    event_id VARCHAR(128) PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

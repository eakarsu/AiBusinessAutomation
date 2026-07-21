BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
CREATE INDEX IF NOT EXISTS automation_users_tenant_idx ON users (tenant_id, id);
CREATE TABLE IF NOT EXISTS automation_runs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, workflow_name TEXT NOT NULL, workflow_version TEXT NOT NULL, owner_id TEXT NOT NULL,
 requester_id TEXT NOT NULL, state TEXT NOT NULL, definition JSONB NOT NULL, definition_hash CHAR(64) NOT NULL,
 requires_approval BOOLEAN NOT NULL, approval_id TEXT, data_policy JSONB NOT NULL, rerun_of TEXT REFERENCES automation_runs(id), recovery JSONB,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS automation_deliveries (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES automation_runs(id), connector TEXT NOT NULL,
 operation TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_hash CHAR(64) NOT NULL, payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','retrying','confirmed','dead_letter','compensating')),
 attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_error TEXT, receipt JSONB, compensation_receipt JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(tenant_id, connector, idempotency_key)
);
CREATE INDEX IF NOT EXISTS automation_runs_retention_idx ON automation_runs (tenant_id, expires_at);
CREATE TABLE IF NOT EXISTS automation_webhook_receipts (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, connector TEXT NOT NULL, provider_event_id TEXT NOT NULL, payload_hash CHAR(64) NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ, UNIQUE(tenant_id, connector, provider_event_id)
);
CREATE TABLE IF NOT EXISTS automation_evaluations (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, suite_version TEXT NOT NULL, fixture_version TEXT NOT NULL, metrics JSONB NOT NULL,
 limits JSONB NOT NULL, accepted BOOLEAN NOT NULL, failures JSONB NOT NULL, result_hash CHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS automation_audit (
 id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL,
 resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, before_hash CHAR(64), after_hash CHAR(64), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION automation_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'automation_audit is append-only'; END; $$;
DROP TRIGGER IF EXISTS automation_audit_no_update ON automation_audit;
CREATE TRIGGER automation_audit_no_update BEFORE UPDATE OR DELETE ON automation_audit FOR EACH ROW EXECUTE FUNCTION automation_audit_immutable();
COMMIT;

CREATE TABLE IF NOT EXISTS automation_ai_results (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  input_data JSONB NOT NULL,
  result JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_ai_results_scope_idx
  ON automation_ai_results (tenant_id, user_id, created_at DESC);

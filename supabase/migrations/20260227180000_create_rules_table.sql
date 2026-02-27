-- Create rules table
CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  condition_logic text NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_addition text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient per-account ordered queries
CREATE INDEX IF NOT EXISTS rules_account_priority_idx ON rules (account_id, priority);

-- Enable RLS
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- Users can only access their own rules
CREATE POLICY "rules_select_own" ON rules
  FOR SELECT USING (account_id = auth.uid());

CREATE POLICY "rules_insert_own" ON rules
  FOR INSERT WITH CHECK (account_id = auth.uid());

CREATE POLICY "rules_update_own" ON rules
  FOR UPDATE USING (account_id = auth.uid());

CREATE POLICY "rules_delete_own" ON rules
  FOR DELETE USING (account_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_rules_updated_at();

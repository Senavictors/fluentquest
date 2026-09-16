ALTER TABLE budget_reservations
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text;

CREATE INDEX IF NOT EXISTS budget_reservations_circuit
  ON budget_reservations(user_id, provider, model, created_at DESC)
  WHERE state = 'unknown';

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS scenario text;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS retry_of uuid REFERENCES attempts(id) ON DELETE SET NULL;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS reflection text;
ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS shortcuts_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  week date NOT NULL,
  attempt_id uuid REFERENCES attempts(id) ON DELETE SET NULL,
  reflection text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,week)
);

ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcription_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcript_provider text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcript_model text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcript_reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcription_requested_at timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS transcription_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS jobs_source_kind_status
  ON jobs(source_id, kind, status);

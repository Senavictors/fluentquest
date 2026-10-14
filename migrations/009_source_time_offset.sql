-- TASK-022 / ADR-009: deslocamento da letra em relação ao clipe, por fonte.
-- O LRC da comunidade pode ter sido sincronizado com outra gravação
-- (introdução diferente do clipe oficial). O ajuste fica na fonte e é somado
-- na hora de acompanhar: `start_ms` dos trechos nunca é reescrito (RN-04).
-- Aditiva, default 0.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS time_offset_ms integer NOT NULL DEFAULT 0;
ALTER TABLE sources ADD CONSTRAINT sources_time_offset_range
  CHECK (time_offset_ms BETWEEN -10000 AND 10000);

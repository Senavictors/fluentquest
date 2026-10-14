-- TASK-020 / ADR-009: letra de música como fonte com atribuição própria.
-- Até aqui uma letra só entrava colada como "Material próprio" — afirmação
-- falsa sobre a origem, o mesmo defeito que o ADR-004 corrigiu para legenda.
-- A fonte passa a guardar de qual catálogo e de qual registro a letra veio,
-- para reimportar sem duplicar.
--
-- Aditiva: só colunas, restrições e índice novos; nenhuma linha existente
-- muda (todas ficam com catalog_* nulo, que as restrições aceitam).
ALTER TABLE sources ADD COLUMN IF NOT EXISTS catalog_provider text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS catalog_id text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS catalog_duration_ms integer;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS catalog_meta jsonb;
ALTER TABLE sources ADD CONSTRAINT sources_catalog_provider
  CHECK (catalog_provider IS NULL OR catalog_provider IN ('lrclib'));
-- Provedor e ID andam juntos: atribuição pela metade não identifica nada.
ALTER TABLE sources ADD CONSTRAINT sources_catalog_pair
  CHECK ((catalog_provider IS NULL) = (catalog_id IS NULL));
ALTER TABLE sources ADD CONSTRAINT sources_catalog_duration
  CHECK (catalog_duration_ms IS NULL OR catalog_duration_ms >= 0);
-- RN-05: a mesma letra do catálogo não é importada duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS source_catalog_owner
  ON sources(user_id, catalog_provider, catalog_id)
  WHERE catalog_id IS NOT NULL;

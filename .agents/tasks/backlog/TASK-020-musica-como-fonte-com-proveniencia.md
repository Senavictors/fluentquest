---
id: TASK-020
title: Importar música como fonte, com proveniência e atribuição próprias
status: backlog
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [migrations/008_lyrics_catalog.sql, src/server/schema.ts, src/server/api.ts, src/domain/content.ts, scripts/integration.ts, docs/API.md, docs/data/README.md]
related_use_cases: [estudar música]
related_adrs: [ADR-009]
---

# TASK-020 — Importar música como fonte, com proveniência e atribuição próprias

## Contexto
Terceira etapa do ADR-009. Depende de TASK-018 e TASK-019. Precisa de revisão de `dados-persistencia` (migração nova).

## Problema
Hoje uma letra só entra como "Material próprio" (`rights: owned`, `origin: user_upload`) — afirmação falsa, mesmo defeito que o ADR-004 corrigiu para legenda.

## Objetivo
Criar a fonte a partir de um registro do LRCLIB, guardando de onde veio e com rótulo verdadeiro.

## Fora de escopo
- Tela (TASK-021) e karaokê (TASK-022).
- Migrar automaticamente a fonte antiga do Drake: o proprietário decide se reimporta.

## Comportamento atual
Não existe caminho de importação de música.

## Comportamento esperado
`POST /api/sources/lyrics` com `{ catalogId, language, videoUrl? }` busca o registro pelo adaptador (o cliente não envia o texto da letra), cria a fonte e os trechos numa `transaction`.

## Regras de negócio
- RN-01: Trechos com `origin='lyrics_catalog'`, `quality_status='community_unreviewed'`; `time_accuracy='approximate'` se veio de `syncedLyrics`, `'none'` se só `plainLyrics`.
- RN-02: Fonte com `catalog_provider='lrclib'`, `catalog_id`, `catalog_duration_ms`, título = `trackName`, autor = `artistName`; álbum guardado na atribuição.
- RN-03: `rights='third_party'` (valor novo; obra de terceiros para estudo pessoal) — **confirmar com o proprietário** (pergunta aberta do ADR-009).
- RN-04: Com `videoUrl`, a fonte é `kind='youtube'`, validada por `youtubeId` (host e ID exatos); sem, `kind='text'`.
- RN-05: Mesmo `catalog_id` já importado → devolve a fonte existente (`409` com o `id`), sem duplicar.
- RN-06: Registro `instrumental` ou sem letra → `LYRICS_EMPTY`, nada é gravado.
- RN-07: Idioma da fonte vem do formulário (ADR-006), default `en-US`.
- RN-08: Trechos `community_unreviewed` seguem a mesma regra de `ai_unreviewed` para virar cartão (revisão humana antes).

## Critérios de aceitação
- [ ] CA-01: Importação com letra sincronizada grava fonte + trechos com origem, qualidade, tempo e atribuição corretos.
- [ ] CA-02: Importação com vídeo cria `kind='youtube'` com `video_id` validado; URL inválida → erro de validação existente.
- [ ] CA-03: Reimportar o mesmo `catalog_id` não duplica.
- [ ] CA-04: Migração 008 aplica em banco limpo e em banco com dados (sem editar migrações anteriores).
- [ ] CA-05: `docs/API.md` e `docs/data/README.md` atualizados.

## Impacto técnico
### Backend
Rota nova em `src/server/api.ts`, reaproveitando `parseContent` e o adaptador da TASK-019.
### Frontend
Nenhum nesta task.
### Banco de dados
`migrations/008_lyrics_catalog.sql`: `sources.catalog_provider text`, `sources.catalog_id text`, `sources.catalog_duration_ms integer`, `sources.catalog_meta jsonb`, índice único parcial `(user_id, catalog_provider, catalog_id) WHERE catalog_id IS NOT NULL`. Ajustar CHECK/enum de `rights` se houver. `src/server/schema.ts` atualizado junto.
### Integrações
Usa o adaptador da TASK-019.
### Segurança
O texto vem do servidor (adaptador), não do cliente — a atribuição não pode ser forjada.

## Plano de implementação
- [ ] Migração 008 + `schema.ts` (revisão `dados-persistencia`).
- [ ] `rights` com `third_party` no domínio.
- [ ] Rota e transação.
- [ ] Cenários de integração com o adaptador simulado.

## Estratégia de testes
- [ ] Unitários: validação da entrada.
- [ ] Integração: CA-01 a CA-04.
- [ ] Manual: importar uma música real e conferir no banco.

## Riscos e rollback
Migração aditiva (só colunas e índice novos); rollback = não usar a rota. Nenhuma operação destrutiva.

## Registro de execução
### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

## Handoff

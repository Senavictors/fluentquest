---
id: TASK-020
title: Importar música como fonte, com proveniência e atribuição próprias
status: completed
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [migrations/008_lyrics_catalog.sql, src/server/schema.ts, src/server/api.ts, src/worker.ts, src/domain/content.ts, tests/domain.test.ts, scripts/integration.ts, docs/API.md, docs/data/README.md]
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
- RN-03: `rights='third_party'` (valor novo; obra de terceiros para estudo pessoal) — **confirmado pelo proprietário em 2026-10-14**.
- RN-04: Com `videoUrl`, a fonte é `kind='youtube'`, validada por `youtubeId` (host e ID exatos); sem, `kind='text'`.
- RN-05: Mesmo `catalog_id` já importado → devolve a fonte existente (`409` com o `id`), sem duplicar.
- RN-06: Registro `instrumental` ou sem letra → `LYRICS_EMPTY`, nada é gravado.
- RN-07: Idioma da fonte vem do formulário (ADR-006), default `en-US`.
- RN-08: Trechos `community_unreviewed` seguem a mesma regra de `ai_unreviewed` para virar cartão (revisão humana antes).

## Critérios de aceitação
- [x] CA-01: Importação com letra sincronizada grava fonte + trechos com origem, qualidade, tempo e atribuição corretos.
- [x] CA-02: Importação com vídeo cria `kind='youtube'` com `video_id` validado; URL inválida → erro de validação existente.
- [x] CA-03: Reimportar o mesmo `catalog_id` não duplica.
- [x] CA-04: Migração 008 aplica em banco limpo e em banco com dados (sem editar migrações anteriores).
- [x] CA-05: `docs/API.md` e `docs/data/README.md` atualizados.

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
- [x] Migração 008 + `schema.ts` (revisão `dados-persistencia`).
- [x] `rights` com `third_party` no domínio.
- [x] Rota e transação.
- [x] Cenários de integração com o adaptador simulado.

## Estratégia de testes
- [x] Unitários: validação da entrada.
- [x] Integração: CA-01 a CA-04.
- [ ] Manual: importar uma música real e conferir no banco.

## Riscos e rollback
Migração aditiva (só colunas e índice novos); rollback = não usar a rota. Nenhuma operação destrutiva.

## Registro de execução
### Alterações realizadas
- `migrations/008_lyrics_catalog.sql` (SQL mostrado ao proprietário e autorizado antes de criar/aplicar): `catalog_provider` (CHECK só `lrclib`), `catalog_id`, `catalog_duration_ms` (CHECK ≥ 0), `catalog_meta jsonb`, CHECK de par provedor/ID e índice único parcial `source_catalog_owner (user_id, catalog_provider, catalog_id) WHERE catalog_id IS NOT NULL`. `src/server/schema.ts` com as quatro colunas. `rights` não tem CHECK no banco, então `third_party` não exigiu migração.
- Domínio: `LYRICS_RIGHTS = "third_party"`, `lyricsImportInput` (`catalogId`, `language` default `en-US`, `videoUrl` opcional — sem texto nem `rights` na entrada) e `lyricsSegments(record)`: sincronizada → `parseContent` com tempo `approximate`; só texto simples → `none`; sincronizada que não passa no parser cai para o texto simples do mesmo registro, sem tempo; instrumental ou vazio → `LYRICS_EMPTY`.
- `POST /api/sources/lyrics` em `src/server/api.ts`: duplicata (mesmo `catalog_id` ou mesmo vídeo) responde `409 SOURCE_EXISTS` com `sourceId` **antes** da chamada ao LRCLIB; depois busca o registro pelo adaptador, fora da transação; dentro de `idempotent` (transação) re-checa a corrida e grava fonte + trechos + job de preparo + evento.
- `POST /api/sources/:id/segments` recusa fonte de catálogo com `CATALOG_SOURCE_LOCKED` (409).
- `src/worker.ts`: metadados do YouTube e a revalidação de 30 dias não trocam título/autor quando `catalog_id` não é nulo.
- `docs/API.md`, `docs/data/README.md`, `.claude/agents/dados-persistencia.md` e `.codex/agents/dados-persistencia.toml` (faixa de migrações).
### Arquivos principais
`migrations/008_lyrics_catalog.sql` · `src/server/schema.ts` · `src/domain/content.ts` · `src/server/api.ts` · `src/worker.ts` · `tests/domain.test.ts` (+4) · `scripts/integration.ts` (+5 cenários)
### Decisões
- Vídeo já existente como fonte → `409 SOURCE_EXISTS` com o `sourceId` dele (índice `source_youtube_owner` da 001), em vez de fundir fontes ou estourar a restrição. Apresentado ao proprietário junto com o SQL.
- Duplicata é verificada antes da rede, então reenviar uma importação já concluída (mesma `Idempotency-Key`) responde `409` com o mesmo `sourceId`, não o `201` original. O cliente obtém o ID nos dois casos.
- Rede fora da transação: a chamada ao LRCLIB não segura conexão nem lock; a corrida entre duas importações é decidida pelo re-check dentro da transação e, em último caso, pelo índice único.
- Título e autor truncados em 200/120 caracteres, os limites de `sourceInput`; o original fica em `catalog_meta`.
- RN-08: não há trava de servidor para `ai_unreviewed` virar cartão — cartão é sempre criado pela confirmação explícita do aluno (`POST /api/cards`). `community_unreviewed` segue exatamente o mesmo caminho; o rótulo na tela é da TASK-021.
- Exportação de conta já só leva trechos de fontes `owned`; letra `third_party` fica fora sem mudança no código (verificado na integração).
### Divergências
- **Escopo ampliado, com aviso ao proprietário:** (1) guarda `CATALOG_SOURCE_LOCKED` — anexar legenda `owned` reescrevia `rights` e levaria a letra para a exportação; (2) `src/worker.ts` — sem a mudança, o job de metadados trocaria faixa/artista pelo título do clipe e pelo canal, e a revalidação de 30 dias por "Vídeo aguardando revalidação"/"YouTube", quebrando RN-02.
### Pendências
- **Importação real (manual) não feita**: exige uma chamada real ao LRCLIB, que depende de autorização do proprietário.
- A fonte antiga `Drake - Not You Too` ("Material próprio") não existe neste banco local recriado; reimportar é decisão do proprietário (fora de escopo).

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

Resultados de 2026-10-14:
- `npm run db:migrate` no banco local: 008 registrada em `fq_migrations`; colunas, três CHECKs e índice conferidos.
- CA-04 em banco descartável: 001–007 aplicadas, duas fontes e dois trechos inseridos, 008 aplicada; hash das linhas existentes idêntico antes/depois, `catalog_*` nulo nelas, e as quatro restrições recusam duplicata, par incompleto, provedor desconhecido e duração negativa. Banco descartado ao fim. Banco limpo coberto pela integração (aplica 001–008 do zero).
- `npm run typecheck`: sem erros.
- `npm test`: 95/95 (91 antes + 4).
- `npm run test:integration`: 50/50 (45 antes + 5: importação sincronizada e só texto; reimportação sem duplicar nem chamar o LRCLIB; instrumental/inexistente/link inválido sem gravar; clipe com `kind=youtube`, faixa e artista preservados após metadados e revalidação, e vídeo já existente → 409; legenda recusada e letra fora da exportação). Tudo com `fetch` simulado; nenhuma chamada real ao LRCLIB, nenhuma de IA.
- Sem mudança de tela; `accessibility-qa` não se aplica.

## Handoff

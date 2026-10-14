---
id: TASK-019
title: Adaptador LRCLIB por host fixo e rota de busca de letras
status: backlog
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/server/providers.ts, src/server/api.ts, src/domain/content.ts, scripts/integration.ts, docs/API.md, docs/INTEGRACOES.md, .env.example]
related_use_cases: [estudar música]
related_adrs: [ADR-009]
---

# TASK-019 — Adaptador LRCLIB por host fixo e rota de busca de letras

## Contexto
Segunda etapa do ADR-009. Depende de TASK-018 (o resultado do LRCLIB é LRC).

## Problema
Para estudar uma música, o proprietário precisa achar a letra fora do app e colá-la.

## Objetivo
Buscar letras pelo nome da música/artista dentro do app, com o servidor falando **só** com `https://lrclib.net`.

## Fora de escopo
- Gravar a fonte (TASK-020) e a tela (TASK-021).
- Publicar letra no LRCLIB (`/api/publish`, proof-of-work) e sinalizar letra (`/api/flag`).
- Ler o `lyricsfile` (YAML) — usar `syncedLyrics`/`plainLyrics` nesta versão.

## Comportamento atual
Não há integração de letras.

## Comportamento esperado
`GET /api/lyrics/search?q=...` devolve até 20 resultados normalizados; `GET /api/lyrics/:id` devolve um registro.

## Regras de negócio
- RN-01: Host fixo `lrclib.net` construído no servidor com `new URL()`; o usuário só fornece `q` (1–200 caracteres) ou `id` (inteiro positivo). Nenhum campo aceita URL.
- RN-02: Cabeçalho `User-Agent: FluentQuest/<package.json version> (https://github.com/Senavictors/fluentquest)`; `AbortSignal.timeout(15000)`.
- RN-03: Resposta validada por schema Zod em `src/domain/content.ts` (`lyricsRecord`: `id`, `trackName`, `artistName`, `albumName`, `duration`, `instrumental`, `plainLyrics`, `syncedLyrics`). Campo fora do contrato é descartado; resposta inválida vira `INVALID_PROVIDER_OUTPUT`.
- RN-04: `429` → `AppError("LYRICS_RATE_LIMITED")` com o `Retry-After` na mensagem. **Sem nova tentativa automática.** `404` em `/get/{id}` → `LYRICS_NOT_FOUND`. Falha de rede/timeout → `LYRICS_UNAVAILABLE`.
- RN-05: Corpo de erro do LRCLIB nunca é tratado como JSON confiável (a doc avisa que o 429 vem da borda e pode não ser JSON).
- RN-06: `LYRICS_CATALOG_ENABLED !== "true"` → as rotas respondem "integração não configurada", sem chamar a rede.
- RN-07: Rotas exigem sessão do proprietário, como as demais.
- RN-08: Resultados `instrumental: true` aparecem marcados como instrumental (não estudáveis), não somem.

## Critérios de aceitação
- [ ] CA-01: Busca com catálogo ligado devolve lista normalizada (título, artista, álbum, duração, `hasSynced`).
- [ ] CA-02: Catálogo desligado → "integração não configurada", zero chamadas de rede.
- [ ] CA-03: `429`, `404`, timeout e JSON inválido viram os erros de RN-04/RN-03 com mensagem em pt-BR.
- [ ] CA-04: Teste de domínio garante que nenhum parâmetro de entrada altera host, protocolo ou caminho.
- [ ] CA-05: `docs/API.md`, `docs/INTEGRACOES.md` e `.env.example` atualizados.

## Impacto técnico
### Backend
Adaptador `LyricsCatalog` em `src/server/providers.ts` (seguindo o padrão de `videos.list`), injetável para teste; rotas em `src/server/api.ts`.
### Frontend
Nenhum nesta task.
### Banco de dados
Nenhum.
### Integrações
Nova: LRCLIB (gratuita, sem chave). Sem dependência npm nova (`fetch` nativo).
### Segurança
Host fixo é a defesa contra SSRF (Constituição). Sem segredo envolvido.

## Plano de implementação
- [ ] Schema `lyricsRecord` + `lyricsSearchQuery` no domínio.
- [ ] Adaptador com `search(q)` e `get(id)`; versão simulada para `scripts/integration.ts`.
- [ ] Rotas e flag `LYRICS_CATALOG_ENABLED`.
- [ ] Atualizar documentação.

## Estratégia de testes
- [ ] Unitários: schema, montagem da URL, mapeamento de erros.
- [ ] Integração: cenários com o adaptador simulado (sucesso, 429, 404, desligado). **Nenhuma chamada real ao LRCLIB em teste.**
- [ ] Manual: uma busca real com o catálogo ligado.

## Riscos e rollback
Mudança de formato do LRCLIB (schema falha de forma honesta). Rollback: `LYRICS_CATALOG_ENABLED=false`.

## Registro de execução
### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

## Handoff

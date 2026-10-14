---
id: TASK-019
title: Adaptador LRCLIB por host fixo e rota de busca de letras
status: completed
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/server/providers.ts, src/server/api.ts, src/domain/content.ts, scripts/integration.ts, tests/domain.test.ts, tests/providers.test.ts, docs/API.md, docs/INTEGRACOES.md, .env.example]
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
- [x] CA-01: Busca com catálogo ligado devolve lista normalizada (título, artista, álbum, duração, `hasSynced`).
- [x] CA-02: Catálogo desligado → "integração não configurada", zero chamadas de rede.
- [x] CA-03: `429`, `404`, timeout e JSON inválido viram os erros de RN-04/RN-03 com mensagem em pt-BR.
- [x] CA-04: Teste de domínio garante que nenhum parâmetro de entrada altera host, protocolo ou caminho.
- [x] CA-05: `docs/API.md`, `docs/INTEGRACOES.md` e `.env.example` atualizados.

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
- [x] Schema `lyricsRecord` + `lyricsSearchQuery` no domínio.
- [x] Adaptador com `search(q)` e `get(id)`; versão simulada para `scripts/integration.ts`.
- [x] Rotas e flag `LYRICS_CATALOG_ENABLED`.
- [x] Atualizar documentação.

## Estratégia de testes
- [x] Unitários: schema, montagem da URL, mapeamento de erros.
- [x] Integração: cenários com o adaptador simulado (sucesso, 429, 404, desligado). **Nenhuma chamada real ao LRCLIB em teste.**
- [x] Manual: uma busca real com o catálogo ligado (2026-10-14, autorizada pelo proprietário).

## Riscos e rollback
Mudança de formato do LRCLIB (schema falha de forma honesta). Rollback: `LYRICS_CATALOG_ENABLED=false`.

## Registro de execução
### Alterações realizadas
- Domínio (`src/domain/content.ts`): `LRCLIB_ORIGIN`, `lyricsSearchQuery` (1–200), `lyricsCatalogId` (inteiro positivo), `lyricsSearchUrl()`/`lyricsGetUrl()` — a URL inteira é montada aqui, com `new URL()` sobre a origem fixa —, schema `lyricsRecord` e `lyricsSummary()` (título, artista, álbum, `durationMs`, `instrumental`, `hasSynced`, `hasPlain`).
- Adaptador `createLyricsCatalog(fetchImpl)` + instância `lyricsCatalog` em `src/server/providers.ts`: `User-Agent: FluentQuest/<versão do package.json> (https://github.com/Senavictors/fluentquest)`, `AbortSignal.timeout(15000)`, `redirect: "error"`; 429 → `LYRICS_RATE_LIMITED` com `Retry-After` (segundos ou data HTTP); 404 em `get` → `LYRICS_NOT_FOUND`; outro erro HTTP, rede ou timeout → `LYRICS_UNAVAILABLE`; JSON inválido ou fora do schema → `INVALID_PROVIDER_OUTPUT`. Uma chamada por requisição, nunca repetida.
- Rotas `GET /api/lyrics/search?q=` (até 20 resumos, sem texto de letra) e `GET /api/lyrics/:id` (resumo + `plainLyrics`/`syncedLyrics`) em `src/server/api.ts`, depois da checagem de sessão do proprietário (RN-07).
- `LYRICS_CATALOG_ENABLED` em `.env.example` (default `false`); seção LRCLIB em `docs/INTEGRACOES.md`; duas linhas em `docs/API.md`.
### Arquivos principais
`src/domain/content.ts` · `src/server/providers.ts` · `src/server/api.ts` · `tests/domain.test.ts` (+4) · `tests/providers.test.ts` (+8) · `scripts/integration.ts` (+3 cenários) · `docs/API.md` · `docs/INTEGRACOES.md` · `.env.example`
### Decisões
- Montagem de URL no domínio, não no adaptador: é o que torna CA-04 um teste de domínio puro, e o adaptador só recebe uma `URL` pronta.
- A checagem de "catálogo desligado" vem **antes** da validação da entrada: desligado, a resposta é sempre `INTEGRATION_NOT_CONFIGURED`, qualquer que seja `q`/`id`.
- `redirect: "error"`: um redirecionamento do LRCLIB levaria o servidor a outro host, o que o host fixo existe para impedir.
- Corpo de resposta de erro nunca é lido (RN-05); o de sucesso é lido como texto e só então passa por `JSON.parse` + Zod.
- Saída inválida do LRCLIB não reaproveita `parseProviderOutput()` (a mensagem dele fala de resposta de IA cobrada). O log `LYRICS_INVALID_OUTPUT` leva só o caminho do campo e o motivo, nunca a letra.
- Uma resposta de busca com um único item fora do contrato é recusada inteira (RN-03), em vez de filtrar o item silenciosamente.
- `albumName` e `duration` aceitam `null`; `instrumental` é obrigatório.
- `createLyricsCatalog` recebe o `fetch`; a integração troca só o `fetch` (via `Object.assign` na instância exportada), então o mapeamento de erros exercitado é o de produção. `scripts/integration.ts` também apaga `LYRICS_CATALOG_ENABLED` no início, como já fazia com `YOUTUBE_API_KEY`.
### Divergências
- Nenhuma em relação às regras de negócio. O status de "catálogo ligado" **não** entrou em `integrations` do bootstrap: a aba da TASK-021 precisa dele (RN-02 de lá), e o contrato do bootstrap muda nessa task, junto com a tela.
### Pendências
- Nenhuma. Busca real feita em 2026-10-14 com autorização do proprietário: **uma** chamada `GET https://lrclib.net/api/search?q=drake not you too`, catálogo ligado só naquele processo, nada gravado. 498 ms, 20 resultados, todos passaram em `lyricsRecord`, todos com letra sincronizada. Achado para a TASK-021: o catálogo traz muitas versões quase iguais da mesma faixa ("Not You Too", "Not You Too (Audio) ft. Chris Brown", artista "Drake - Topic"…), com duração entre 269 e 271 s — a lista precisa deixar a escolha clara.

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

Resultados de 2026-10-14:
- `npm run typecheck`: sem erros.
- `npm test`: 91/91 (79 antes + 4 de domínio + 8 do adaptador, todos com `fetch` simulado).
- `npm run test:integration`: 45/45 (42 antes + 3 de letras: desligado sem rede; busca e obtenção pelo host fixo; 429, 404, resposta inválida, entrada inválida e acesso anônimo). Nenhuma chamada real ao LRCLIB, nenhuma chamada de IA.
- Sem mudança de tela; `accessibility-qa` não se aplica.

## Handoff

---
id: TASK-021
title: Aba "Música" na importação e rótulo de origem na sala
status: completed
type: feature
owner: interface-editorial
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/client/Study.tsx, src/client/types.ts, src/client/http.ts, src/app/globals.css, src/domain/content.ts, src/server/providers.ts, scripts/song-qa.mjs, scripts/qa-lrclib-fixture.mjs, scripts/qa-isolated.ts, scripts/source-qa.mjs, scripts/integration.ts, tests/domain.test.ts, docs/ui/README.md, docs/API.md]
related_use_cases: [estudar música]
related_adrs: [ADR-009]
---

# TASK-021 — Aba "Música" na importação e rótulo de origem na sala

## Contexto
Quarta etapa do ADR-009. Depende de TASK-019 (busca) e TASK-020 (criação da fonte).

## Problema
O `ImportForm` só oferece "Vídeo do YouTube", "Texto ou legenda" e "Arquivo próprio".

## Objetivo
Importar uma música em três passos: buscar → escolher a versão certa → (opcional) colar o link do clipe oficial.

## Fora de escopo
- Sincronia em tempo real com o vídeo (TASK-022).
- Busca de vídeo no YouTube a partir da música (exigiria `search.list`, com custo de cota — avaliar depois).

## Comportamento atual
Música entra como texto colado, rotulada "Material próprio".

## Comportamento esperado
```text
[ Vídeo do YouTube ] [ Texto ou legenda ] [ Arquivo próprio ] [ Música ]
                                                                  │
  Buscar: "drake not you too" ──▶ lista: título · artista · álbum · 4:30 · ● sincronizada
                                                                  │
  Link do clipe (opcional) ──▶ Idioma ──▶ Importar ──▶ sala de estudo
```

## Regras de negócio
- RN-01: Cada resultado mostra título, artista, álbum, duração (`m:ss`) e se tem letra sincronizada; instrumentais aparecem desabilitados.
- RN-02: Catálogo desligado → a aba explica "integração não configurada" e sugere colar um `.lrc` em "Texto ou legenda".
- RN-03: Rótulo ao pé do trecho: "Letra da comunidade (LRCLIB), não revisada · tempo aproximado" (ou "· sem tempo").
- RN-04: Biblioteca mostra a fonte com o artista como autor, nunca "Material próprio".
- RN-05: Erros `LYRICS_RATE_LIMITED`/`LYRICS_UNAVAILABLE` aparecem como mensagem, sem nova tentativa automática.
- RN-06: Aviso curto de direitos: letra de terceiros, uso pessoal de estudo.

## Critérios de aceitação
- [x] CA-01: Fluxo completo de importação funciona com teclado e leitor de tela (botões `aria-pressed`, lista de resultados navegável).
- [x] CA-02: Mobile 390×844 e desktop 1440, claro e escuro, sem overflow.
- [x] CA-03: `node scripts/accessibility-qa.mjs` com zero violações.
- [x] CA-04: Rótulos de RN-03/RN-04 visíveis.

## Impacto técnico
### Backend
Nenhum.
### Frontend
Novo ramo `kind === "song"` no `ImportForm` (é só estado de UI; a fonte gravada é `text` ou `youtube`). Tipos em `src/client/types.ts`.
### Banco de dados
Nenhum.
### Integrações
Consome `GET /api/lyrics/search` e `POST /api/sources/lyrics`.
### Segurança
Nenhum HTML vindo do catálogo é renderizado como HTML.

## Plano de implementação
- [x] Aba e estado de busca (debounce ≥ 400 ms, uma requisição por vez).
- [x] Lista de resultados e seleção.
- [x] Campo de link do clipe e idioma.
- [x] Rótulos na sala e na biblioteca.
- [x] QA de acessibilidade e capturas.

## Estratégia de testes
- [x] Unitários: formatação de duração, se extraída para função pura.
- [ ] Integração: —
- [x] E2E: `scripts/browser-qa.mjs` com o catálogo simulado.
- [ ] Manual: importar uma música real.

## Riscos e rollback
Só cliente; rollback = esconder a aba.

## Registro de execução
### Alterações realizadas
- `ImportForm` (`src/client/Study.tsx`): quarta aba **Música** (`kind === "song"`, só estado de tela). Esconde título/autor digitados, texto/legenda e seletor de permissão; mostra `SongSearch`, link opcional do clipe (com `aria-describedby`), idioma, aviso curto de direitos (RN-06) e consentimento próprio. Envia `POST /api/sources/lyrics`; `409 SOURCE_EXISTS` abre a fonte existente.
- `SongSearch`: busca com debounce de 450 ms e no mínimo 2 caracteres; uma requisição por vez (`AbortController` cancela a anterior); Enter busca na hora sem enviar o formulário; o mesmo termo não vai duas vezes à rede, e depois de um erro só volta por ação do proprietário (RN-05). Resultados em radios nativos num `fieldset`, com título, artista, álbum, duração `m:ss` e estado de sincronia; instrumental desabilitado (RN-01). Catálogo desligado → "Integração não configurada" + botão para "Texto ou legenda" (RN-02).
- Rótulos (RN-03/RN-04): trecho selecionado com `lyricsSegmentLabel()` (tempo aproximado ou sem tempo); subtítulo da sala com "Letra da comunidade (LRCLIB), não revisada", sempre visível; biblioteca com o artista como autor e "Letra (LRCLIB)".
- Funções puras no domínio: `songDuration()` e `lyricsSegmentLabel()`. `HttpError` ganhou `details` (corpo do erro, para o `sourceId`). Tipos `LyricsResult`, `Integrations.lyrics`, `Source.catalog_*`.
- `integrationStatus()` devolve `lyrics` (bootstrap e `GET /api/integrations`).
- QA: `scripts/song-qa.mjs` (novo) e `scripts/qa-lrclib-fixture.mjs` (LRCLIB simulado, carregado por `--import` só no servidor de QA), ligados em `scripts/qa-isolated.ts`. `scripts/source-qa.mjs` exclui o iframe do player do YouTube do axe, por decisão do proprietário.
- CSS em `src/app/globals.css` (campo de busca com ícone, lista que rola acima de 420px), reaproveitando `.transcription-choice`.
### Arquivos principais
`src/client/Study.tsx` · `src/app/globals.css` · `src/client/types.ts` · `src/client/http.ts` · `src/domain/content.ts` · `src/server/providers.ts` · `scripts/song-qa.mjs` · `scripts/qa-lrclib-fixture.mjs` · `scripts/qa-isolated.ts` · `scripts/source-qa.mjs`
### Decisões
- Radios nativos em vez de lista com `aria-selected`: navegação por setas, pulo de desabilitados e anúncio de posição vêm do navegador, sem script de foco.
- `integrations.lyrics` no bootstrap (adiado da TASK-019) para a aba explicar o catálogo desligado antes de qualquer busca, em vez de descobrir pelo 503.
- Rótulo de origem também no subtítulo da sala: o rótulo de trecho só aparece no trecho selecionado (padrão existente), e a letra não pode passar por material próprio enquanto nenhum trecho está aberto.
- Catálogo simulado no QA por interceptação de `fetch` no processo do servidor, não por mock no navegador: assim tela → rota → adaptador → banco são exercitados de verdade, e o host fixo do adaptador não precisa de exceção de teste. O fixture devolve 404 para qualquer caminho que não seja `/api/search` ou `/api/get/{id}` conhecido e nunca deixa `lrclib.net` chegar à rede.
- Exclusão do iframe: `exclude([".youtube-host iframe", "html"])` (só o documento interno) não alcançou o frame de origem cruzada de forma estável; ficou `exclude(".youtube-host iframe")`, o elemento inteiro, como o proprietário pediu.
### Divergências
- E2E em script novo (`song-qa.mjs`) em vez de dentro de `browser-qa.mjs`: o fluxo precisa do servidor com catálogo simulado, que só `qa-isolated.ts` monta; `browser-qa.mjs` segue intacto.
- Tocou `src/server/providers.ts` (uma linha em `integrationStatus`) e `scripts/integration.ts` (asserção do campo `lyrics`), fora de "Backend: nenhum" da task — consequência da decisão acima.
### Pendências
- **Importação real (manual)**: depende de autorização do proprietário para chamadas reais ao LRCLIB (busca + obtenção).
- Mobile: com quatro abas, a barra de abas rola horizontalmente em 390px (comportamento já existente de `.import-form .tabs`); a aba ativa fica visível, mas "Vídeo do YouTube" aparece cortada na borda.

## Validação
`npm run typecheck` · `npm run build` · `node scripts/accessibility-qa.mjs`

Resultados de 2026-10-14:
- `npm run typecheck`: sem erros. `npm run build`: compilou.
- `npm test`: 97/97 (95 antes + 2: `songDuration`, `lyricsSegmentLabel`).
- `npm run test:integration`: 50/50 (cenário da TASK-019 agora também confere `integrations.lyrics` falso/verdadeiro).
- `npx tsx --env-file=.env.local scripts/qa-isolated.ts`: `browser-qa` sem erros nem overflow; `accessibility-qa` com `violations: []` nas 9 rotas; `source-qa` com 0 violações nas 4 variantes (antes 2–3, todas no iframe do YouTube); `song-qa` com 0 violações e sem overflow em 9 varreduras — resultados e sala em 1440/390 × claro/escuro, mais catálogo desligado —, teclado (Space marca, setas trocam de versão pulando o instrumental), reimportação abrindo a mesma fonte, rótulos na sala e na biblioteca. Nenhuma chamada real ao LRCLIB.

## Handoff

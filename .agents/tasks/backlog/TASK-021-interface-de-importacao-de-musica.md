---
id: TASK-021
title: Aba "Música" na importação e rótulo de origem na sala
status: backlog
type: feature
owner: interface-editorial
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/client/Study.tsx, src/client/types.ts, src/app/globals.css, scripts/accessibility-qa.mjs, docs/ui/README.md]
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
- [ ] CA-01: Fluxo completo de importação funciona com teclado e leitor de tela (botões `aria-pressed`, lista de resultados navegável).
- [ ] CA-02: Mobile 390×844 e desktop 1440, claro e escuro, sem overflow.
- [ ] CA-03: `node scripts/accessibility-qa.mjs` com zero violações.
- [ ] CA-04: Rótulos de RN-03/RN-04 visíveis.

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
- [ ] Aba e estado de busca (debounce ≥ 400 ms, uma requisição por vez).
- [ ] Lista de resultados e seleção.
- [ ] Campo de link do clipe e idioma.
- [ ] Rótulos na sala e na biblioteca.
- [ ] QA de acessibilidade e capturas.

## Estratégia de testes
- [ ] Unitários: formatação de duração, se extraída para função pura.
- [ ] Integração: —
- [ ] E2E: `scripts/browser-qa.mjs` com o catálogo simulado.
- [ ] Manual: importar uma música real.

## Riscos e rollback
Só cliente; rollback = esconder a aba.

## Registro de execução
### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação
`npm run typecheck` · `npm run build` · `node scripts/accessibility-qa.mjs`

## Handoff

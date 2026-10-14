---
id: TASK-022
title: Modo karaokê — trecho acompanha a música na sala de estudo
status: backlog
type: feature
owner: interface-editorial
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/client/Study.tsx, src/app/globals.css, src/server/api.ts, migrations/009_source_time_offset.sql, docs/ui/README.md]
related_use_cases: [estudar música]
related_adrs: [ADR-009]
---

# TASK-022 — Modo karaokê: trecho acompanha a música na sala de estudo

## Contexto
Última etapa do ADR-009. Depende de TASK-020 (música com tempo e vídeo vinculado).

## Problema
A sala já sabe pular para o trecho e repetir em loop, mas:
- o player do YouTube é consultado a cada **1000 ms** (`setInterval` em `Study.tsx`), lento demais para versos de 2–3 s;
- o trecho em destaque não segue a reprodução sozinho;
- o tempo do LRC pode estar deslocado da gravação do clipe (introdução diferente).

## Objetivo
Com a música tocando, o verso atual acende e a lista rola até ele; o proprietário pode ajustar o deslocamento.

## Fora de escopo
- Destaque por palavra.
- Áudio fora do YouTube (o servidor não baixa áudio — Constituição).
- Mudar o comportamento de fontes que não são música.

## Comportamento atual
Trecho ativo só muda por clique; tempo atualizado a cada 1 s.

## Comportamento esperado
```text
 ┌──────── vídeo ────────┐   01  First time in a long time
 │   ▶  00:21            │ ▶ 02  Hurtin' deeply inside     ← acende e rola
 └───────────────────────┘   03  First time in a long time
   Ajuste: [-0,5 s] [+0,5 s]  deslocamento atual +1,0 s
```

## Regras de negócio
- RN-01: Só se aplica a fonte com trechos `origin='lyrics_catalog'` e `time_accuracy='approximate'`.
- RN-02: Durante a reprodução, consultar `getCurrentTime()` a cada ~200 ms; manter o salvamento de posição a cada 10 s como hoje.
- RN-03: Trecho ativo = último com `start_ms + offset ≤ tempo atual`. Acompanhar pode ser desligado (atalho `K`); clicar num trecho pausa o acompanhamento até a próxima reprodução.
- RN-04: Deslocamento ajustável em passos de 0,5 s (−10 s a +10 s), persistido por fonte (`sources.time_offset_ms`, migração 009). O deslocamento **não** reescreve `start_ms` dos trechos.
- RN-05: Rolagem automática respeita `prefers-reduced-motion`.
- RN-06: O rótulo "tempo aproximado" continua visível.

## Critérios de aceitação
- [ ] CA-01: Com o clipe tocando, o trecho ativo muda sozinho em até ~300 ms do início do verso (com deslocamento correto).
- [ ] CA-02: Ajuste de deslocamento persiste ao reabrir a fonte.
- [ ] CA-03: Loop de trecho e modo cinema continuam funcionando.
- [ ] CA-04: Fontes que não são música não mudam de comportamento.
- [ ] CA-05: `accessibility-qa` com zero violações; atalho `K` documentado junto de `R`, `T` e `C`.

## Impacto técnico
### Backend
`PATCH /api/sources/:id` aceita `timeOffsetMs` (−10000 a 10000). `docs/API.md`.
### Frontend
Intervalo de consulta condicional, cálculo do trecho ativo (função pura testável), controles de ajuste, `scrollIntoView`.
### Banco de dados
`migrations/009_source_time_offset.sql`: `sources.time_offset_ms integer NOT NULL DEFAULT 0`.
### Integrações
Nenhuma nova.
### Segurança
Nenhum ponto novo.

## Plano de implementação
- [ ] Função pura `activeSegmentAt(segments, timeMs, offsetMs)` no domínio + testes.
- [ ] Intervalo de 200 ms só para música em reprodução.
- [ ] Destaque, rolagem e atalho `K`.
- [ ] Controles de deslocamento + migração 009 + `PATCH`.

## Estratégia de testes
- [ ] Unitários: `activeSegmentAt` (antes do primeiro verso, entre versos, depois do último, com deslocamento).
- [ ] Integração: `PATCH` com `timeOffsetMs` válido e fora do limite.
- [ ] Manual: tocar uma música real com clipe e ajustar o deslocamento.

## Riscos e rollback
Custo de CPU do intervalo de 200 ms (só ativo durante reprodução de música). Rollback: voltar o intervalo para 1000 ms e esconder o acompanhamento.

## Registro de execução
### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration` · `node scripts/accessibility-qa.mjs`

## Handoff

---
id: TASK-022
title: Modo karaokê — trecho acompanha a música na sala de estudo
status: completed
type: feature
owner: interface-editorial
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [migrations/009_source_time_offset.sql, src/server/schema.ts, src/server/api.ts, src/domain/content.ts, src/client/Study.tsx, src/client/Settings.tsx, src/client/types.ts, src/app/globals.css, scripts/integration.ts, scripts/song-qa.mjs, scripts/qa-lrclib-fixture.mjs, tests/domain.test.ts, docs/API.md, docs/ui/README.md, docs/data/README.md, DESIGN.md]
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
- [x] CA-01: Com o clipe tocando, o trecho ativo muda sozinho em até ~300 ms do início do verso (com deslocamento correto).
- [x] CA-02: Ajuste de deslocamento persiste ao reabrir a fonte.
- [x] CA-03: Loop de trecho e modo cinema continuam funcionando.
- [x] CA-04: Fontes que não são música não mudam de comportamento.
- [x] CA-05: `accessibility-qa` com zero violações; atalho `K` documentado junto de `R`, `T` e `C`.

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
- [x] Função pura `activeSegmentAt(segments, timeMs, offsetMs)` no domínio + testes.
- [x] Intervalo de 200 ms só para música em reprodução.
- [x] Destaque, rolagem e atalho `K`.
- [x] Controles de deslocamento + migração 009 + `PATCH`.

## Estratégia de testes
- [x] Unitários: `activeSegmentAt` (antes do primeiro verso, entre versos, depois do último, com deslocamento).
- [x] Integração: `PATCH` com `timeOffsetMs` válido e fora do limite.
- [x] Manual: tocar uma música real com clipe (2026-10-14, autorizado pelo proprietário; ver Validação).

## Riscos e rollback
Custo de CPU do intervalo de 200 ms (só ativo durante reprodução de música). Rollback: voltar o intervalo para 1000 ms e esconder o acompanhamento.

## Registro de execução
### Alterações realizadas
- `migrations/009_source_time_offset.sql` (SQL mostrado ao proprietário e autorizado): `sources.time_offset_ms integer NOT NULL DEFAULT 0` com CHECK entre −10000 e 10000; `src/server/schema.ts` junto. Aplicada no banco local.
- `PATCH /api/sources/:id` aceita `positionMs` e/ou `timeOffsetMs` (`timeOffsetMs` validado pelo schema do domínio); campo ausente não muda (`coalesce`); corpo vazio → `INVALID_INPUT`.
- Domínio: `activeSegmentIndex(starts, timeMs, offsetMs)`, `followsPlayback(segments)` (RN-01), `stepTimeOffset`, `formatTimeOffset`, `timeOffsetMs`, `TIME_OFFSET_LIMIT_MS`/`TIME_OFFSET_STEP_MS`.
- `Player`: props opcionais `onFollow` e `onPlay`. Com `onFollow`, uma consulta extra de 200 ms roda só enquanto o player está tocando (`onStateChange` = 1); o intervalo de 1 s (posição a cada 10 s, A–B) continua igual. `onPlay` só dispara num recomeço real — o "carregando" de um salto no meio da reprodução não conta.
- Sala: `playingId` (verso tocando) separado da seleção, com classe `playing`, `aria-current="time"`, troca de página e `scrollIntoView` (`auto` sob `prefers-reduced-motion`). Barra "Acompanhamento da letra": botão "Acompanhar a letra" (`aria-pressed`, K, `localStorage` `fq-karaoke`), "−0,5 s"/"+0,5 s" com valor num `output` vivo, linha de ajuda com "tempo aproximado" (RN-06) e erro de gravação. Clique num trecho pausa o acompanhamento até a próxima reprodução (RN-03). Salto ao trecho, R, "Repetir trecho" e A–B usam o deslocamento; em fonte que não é música ele é 0.
- Dica de rodapé com "K: acompanhar" só em música; Ajustes cita R, T, C e K (CA-05).
- QA: `scripts/song-qa.mjs` ganhou o karaokê (player do YouTube simulado só no navegador de teste) e `scripts/qa-lrclib-fixture.mjs` uma faixa com clipe e busca que filtra pelo termo.
### Arquivos principais
`migrations/009_source_time_offset.sql` · `src/server/schema.ts` · `src/server/api.ts` · `src/domain/content.ts` · `src/client/Study.tsx` · `src/client/Settings.tsx` · `src/app/globals.css` · `tests/domain.test.ts` (+6) · `scripts/integration.ts` (+2 cenários) · `scripts/song-qa.mjs`
### Decisões
- **Verso tocando ≠ trecho selecionado.** A task dizia "trecho ativo"; se o acompanhamento movesse a seleção, cada verso novo fecharia o apoio aberto e apagaria o rascunho de cartão (efeito existente ao mudar de seleção). Os dois convivem: fio à esquerda para o que toca, fundo para o selecionado.
- **Sentido do deslocamento:** positivo = a letra acende depois (clipe com introdução mais longa). A linha de ajuda diz isso na tela.
- **Consulta rápida separada do intervalo de 1 s**, em vez de trocar o período: assim fontes que não são música mantêm exatamente o comportamento anterior (CA-04), e o player não é recriado quando o modo muda.
- **A–B aplica o deslocamento** ao início e ao fim do trecho; sem isso, numa música deslocada, o laço cortaria o verso errado. Em fonte que não é música o deslocamento é 0, então nada muda.
- Acompanhamento desligado, pausado por clique ou com A–B ativo não deixa verso aceso.
- Rolagem com `block: "nearest"`: acompanha sem pular a página inteira a cada verso.
- Deslocamento em passos de 0,5 s é regra da tela (`stepTimeOffset`); o servidor aceita qualquer inteiro no intervalo.
### Divergências
- **Correção pós-entrega (2026-10-14), achada no teste real:** na faixa empilhada (1001–1239 px) a coluna do vídeo tem piso de 180 px; barra do player (73 px) + barra da letra (165 px, ajuda em duas linhas) passavam disso e o iframe colapsava para 0×0 (visto em 1027×502). Agora, nessa faixa, a barra da letra fica numa linha (a ajuda fixa sai da tela mas segue em `aria-describedby`; o aviso de pausa continua visível, classe `hold`) e `.study-media:has(.karaoke-toolbar)` tem piso de 240 px. Em 1100×700 o vídeo passou de 0 para 175×99.
- Tocou `src/client/Settings.tsx` (texto dos atalhos) e `DESIGN.md`, para cumprir CA-05 ("K documentado junto de R, T e C").
- CA-01 foi medido com player simulado (relógio próprio), não com o clipe real: reprodução real do YouTube em navegador headless é instável e não permite medir latência. A lógica medida (consulta de 200 ms → `activeSegmentIndex` → destaque) é a de produção.
### Pendências
- Ajuste de deslocamento com música real não foi necessário nem conferido de ouvido: o verso acende no instante que o LRC declara, mas se a letra *soa* no mesmo instante só o proprietário pode julgar ouvindo.
- Faixa empilhada (1001–1239 px) em janela baixa: com a barra da letra, o vídeo fica pequeno (175×99 em 1100×700) e a transcrição mostra ~1 verso. Já era o limite desse arranjo; o modo cinema, que resolveria, só existe acima de 1240 px.

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration` · `node scripts/accessibility-qa.mjs`

Resultados de 2026-10-14:
- `npm run db:migrate`: 009 registrada; coluna com default 0 conferida.
- `npm run typecheck`: sem erros. `npm run build`: compilou.
- `npm test`: 103/103 (97 antes + 6: verso ativo antes/entre/depois/com deslocamento/empate, passos e limites, formato, `followsPlayback`).
- `npm run test:integration`: 52/52 (50 antes + 2: deslocamento persiste sem reescrever `start_ms` nem a posição; fora do intervalo, fracionário ou corpo vazio → 422).
- `npx tsx --env-file=.env.local scripts/qa-isolated.ts` (QA completo, rodado de novo depois do último ajuste de tela): `browser-qa` sem erros/overflow; `accessibility-qa` com `violations: []` nas 9 rotas; `source-qa` com 0 violações nas 4 variantes; `song-qa` com 0 violações e sem overflow em 14 varreduras, incluindo karaokê em 1440/390 × claro/escuro e no cinema. Latência medida do destaque (CA-01): 119 ms, 13 ms e 117 ms (com +1,0 s) após o início declarado do verso. Deslocamento +1,0 s persistiu após recarregar (CA-02). A–B voltou ao trecho deslocado (6,4 s, dentro de 5,0–8,25 s) e o cinema abriu com a barra da letra (CA-03). Vídeo com legenda pública não mostrou a barra nem o atalho K (CA-04). Nenhuma chamada real ao LRCLIB.

## Handoff

### Validação real — 2026-10-14 (autorizada pelo proprietário)
- `LYRICS_CATALOG_ENABLED=true` em `.env.local`. Importação pela aba "Música" com `npm run dev`, no navegador embutido.
- Busca real: as duas primeiras tentativas receberam **503 do LRCLIB** (uma requisição cada, nenhuma nova tentativa automática; a tela mostrou "respondeu com erro 503. Tente de novo mais tarde."). Uma chamada de diagnóstico fora do Next respondeu 200 logo depois, e a terceira tentativa pela tela também — instabilidade passageira do LRCLIB, não defeito do adaptador.
- Versão escolhida: LRCLIB `37735743`, "Not You Too (Audio) ft. Chris Brown", álbum igual ao título do vídeo oficial, 4:30. Vídeo: upload oficial de áudio do canal do Drake (`ZX_mvoY_Hg0`, OVO/Republic); não existe clipe com imagem.
- No banco: `kind=youtube`, `rights=third_party`, título/autor do catálogo, `catalog_provider=lrclib`, `catalog_id=37735743`, `catalog_duration_ms=270000`, 66 trechos `lyrics_catalog`/`community_unreviewed`/`approximate` com `start_ms` estritamente crescente.
- Reprodução real (1366×768): nada aceso até 0:10; o primeiro verso acendeu em 0:10, o seguinte em 0:15 e o próximo em 0:19, acompanhando o relógio do player conforme o LRC. Biblioteca: autor "Drake" e "Letra (LRCLIB)".


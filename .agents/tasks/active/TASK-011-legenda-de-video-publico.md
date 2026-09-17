---
id: TASK-011
title: Legenda de vídeo público com proveniência própria
status: active
type: feature
owner: fontes-proveniencia
affected_modules:
  [src/server/api.ts, src/client/Study.tsx, scripts/integration.ts, docs/API.md]
created_at: 2026-09-17
updated_at: 2026-09-17
related_use_cases: [ingestão de legenda autorizada]
related_adrs: [ADR-004]
---

# TASK-011 — Legenda de vídeo público com proveniência própria

## Contexto

O proprietário quis estudar uma entrevista pública de 1h10 (`Lx8lrn-cytc`) acompanhando a legenda. A transcrição por IA não serve: `MAX_VIDEO_TRANSCRIPTION_MS` limita a 15 minutos.

## Problema

`POST /api/sources/:id/segments` aceitava só `rights: "owned" | "licensed"`, sobrescrevia `sources.rights` e gravava `origin='user_upload'`. Anexar a legenda de um vídeo de terceiros exigia declarar material próprio ou licenciado e um envio que não foi feito pelo proprietário — três falsidades nos campos que existem para registrar a origem.

## Objetivo

Dar ao caso um rótulo verdadeiro, em vez de deixá-lo vagar sob um rótulo existente.

## Fora de escopo

- Obter a legenda. O servidor continua sem buscar, baixar ou raspar coisa alguma; ele recebe um texto fornecido pelo proprietário.
- Elevar o limite de 15 minutos da transcrição por IA.

## Regras de negócio

- RN-01: `public_link` só é aceito quando a fonte já foi criada como link público. Caso contrário, `RIGHTS_MISMATCH`. Não é caminho para reclassificar fonte.
- RN-02: Com `public_link`, os direitos da fonte não mudam.
- RN-03: Os trechos entram como `origin='public_caption'` e `quality_status='ai_unreviewed'` — legenda de máquina, não revisada, como a do Gemini, para não virar cartão sem alguém ter lido.
- RN-04: `owned` e `licensed` mantêm exatamente o comportamento anterior.

## Critérios de aceitação

- [x] CA-01: Legenda com `public_link` entra sem alterar os direitos da fonte, com origem e estado corretos.
- [x] CA-02: `public_link` em fonte de outro direito devolve `RIGHTS_MISMATCH`.
- [x] CA-03: A tela nomeia a origem ao pé do trecho.
- [x] CA-04: `docs/API.md` atualizado; ADR-004 registrado.
- [x] CA-05: typecheck, `npm test`, `npm run test:integration` e `accessibility-qa` verdes.

## Registro de execução

### Alterações realizadas

- `src/server/api.ts`: enum de `rights` com `public_link`, guarda `RIGHTS_MISMATCH`, `origin`/`quality_status` derivados do caso.
- `src/client/Study.tsx`: rótulo "Legenda automática do vídeo público, não revisada · tempo aproximado".
- `scripts/integration.ts`: cenário novo cobrindo o caminho feliz e a guarda.
- `docs/API.md`, `.agents/decisions/ADR-004`.

### Pendências

- **A legenda em si não foi importada.** A fonte `823def1c-4722-41b6-8afc-e43b4d435d5a` continua `no_transcript`. O caminho existe e está testado; falta o proprietário fornecer o texto da legenda, que é o que a Constituição define como origem legítima.

## Validação

- `npm run typecheck`: passou.
- `npm test`: 56/56.
- `npm run test:integration`: 31/31, sem chamadas de IA.
- `npm run build`: passou.
- `node scripts/accessibility-qa.mjs`: 0 violações nas 9 rotas.

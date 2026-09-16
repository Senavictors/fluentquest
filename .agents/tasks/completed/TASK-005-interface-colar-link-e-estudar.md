---
id: TASK-005
title: Interface do fluxo colar link e estudar
status: completed
type: feature
owner: interface-editorial
created_at: 2026-09-14
updated_at: 2026-09-15
affected_modules: [src/client/Study.tsx, src/client/App.tsx, src/client/types.ts]
related_use_cases: [ingestão de fonte do YouTube com transcrição]
related_adrs: [ADR-001]
---

# TASK-005 — Interface do fluxo colar link e estudar

## Contexto

Fecha a Fase B do ADR-001. É a task que o proprietário efetivamente vê: colar o link, acompanhar a transcrição acontecendo e começar a estudar.

## Problema

O fluxo de transcrição por URL introduz um estado que a interface não sabe mostrar: um vídeo cujo texto está sendo produzido por um provedor, com custo, com proveniência automática e com timestamps aproximados. Sem tratamento editorial, a transcrição apareceria indistinguível de uma legenda autorizada — o que a Constituição não permite.

## Objetivo

Colar um link do YouTube, ver o progresso da transcrição e estudar o resultado, com a origem do texto e a aproximação dos tempos visíveis sem esforço.

## Fora de escopo

- Editor completo de transcrição. Correção manual de segmento é desejável, mas entra como task futura se não couber.
- Qualquer mudança de contrato de API — o contrato vem pronto de TASK-003 e TASK-004.

## Comportamento atual

`src/client/Study.tsx` mostra player e segmentos quando existem, e nada de acionável quando a fonte é `no_transcript`. O acompanhamento de job por SSE já existe via `GET /api/jobs/:id/events`.

## Comportamento esperado

Ao colar um link, o proprietário escolhe explicitamente entre "vou colar a legenda" e "transcrever com IA", vê o custo estimado antes de confirmar, acompanha o progresso e recebe o texto marcado como transcrição automática não revisada.

## Regras de negócio

- RN-01: A transcrição por IA nunca é disparada sem confirmação explícita, porque gera custo.
- RN-02: O custo estimado é mostrado antes da confirmação, junto do saldo do teto mensal.
- RN-03: Segmentos transcritos exibem proveniência automática e tempos aproximados. Nada sugere sincronização exata.
- RN-04: Com IA indisponível, a opção de transcrever aparece desabilitada com "integração não configurada" — nunca oculta, nunca simulada.
- RN-05: Texto de interface em pt-BR; conteúdo de estudo em inglês.

## Critérios de aceitação

- [x] CA-01: O fluxo de colar link oferece as duas opções de forma clara, com a de IA exigindo confirmação.
- [x] CA-02: Custo estimado e saldo do teto aparecem antes da confirmação.
- [x] CA-03: O progresso é acompanhado por SSE e sobrevive a um refresh da página.
- [x] CA-04: Segmentos transcritos são visualmente distinguíveis de legenda fornecida pelo proprietário.
- [x] CA-05: Com `AI_ENABLED=false`, a opção aparece desabilitada com a mensagem padrão.
- [x] CA-06: `node scripts/accessibility-qa.mjs` com 0 violações; layout verificado em 390×844.
- [x] CA-07: Identidade Broadsheet preservada nos temas claro e escuro.

## Impacto técnico

### Backend
Nenhum. Se faltar dado na resposta, a lacuna volta para TASK-003/004 em vez de virar cálculo no cliente.

### Frontend
`src/client/Study.tsx` (fluxo e estados), `src/client/types.ts` (tipos novos de origem e job).

### Banco de dados
Nenhum.

### Integrações
Nenhuma direta.

### Segurança
O aviso de privacidade do tier gratuito aparece antes da primeira transcrição, conforme ADR-001.

## Plano de implementação

- [x] Etapa 1: Mapear os estados possíveis da fonte e desenhar o que cada um mostra.
- [x] Etapa 2: Implementar a escolha e a confirmação com custo.
- [x] Etapa 3: Ligar o acompanhamento por SSE ao novo tipo de job.
- [x] Etapa 4: Tratamento visual de proveniência e tempo aproximado.
- [x] Etapa 5: QA de acessibilidade e verificação mobile.

## Estratégia de testes

- [x] Unitários: não se aplica; regras de estimativa e disponibilidade ficam no servidor.
- [x] Integração: rota, consentimento e persistência cobertos pelos 30 cenários da Fase B.
- [x] E2E: `scripts/source-qa.mjs` verifica a opção sem IA, legenda e proveniência automática.
- [x] Manual: fluxo real conferido no Chrome; QA isolado em 1440×1000 e 390×844, claro e escuro, sem violações axe ou overflow.

## Riscos e rollback

Risco de o custo estimado exibido divergir do cobrado. Mitigação: apresentar como estimativa, com a mesma folga usada na reserva, nunca como valor final. Rollback é esconder a opção de transcrever; o resto do fluxo continua válido.

## Registro de execução

### Alterações realizadas
O formulário de YouTube oferece legenda autorizada ou Gemini; a segunda opção fica indisponível sem integração. A tela de estudo mostra estimativa, saldo, consentimento, progresso persistente do job e a marcação de transcrição automática não revisada com tempo aproximado.

### Arquivos principais
`src/client/Study.tsx`, `src/client/types.ts`, `src/app/globals.css`, `scripts/qa-isolated.ts` e `scripts/source-qa.mjs`.

### Decisões
Todo cálculo de custo e elegibilidade vem do servidor. A interface apenas apresenta o estado e exige confirmação explícita.

### Divergências
O provedor real não devolveu segmentos por HTTP 503. A apresentação final de proveniência foi validada em banco e navegador isolados com fixture declarada, sem alegar resultado real.

### Pendências
Nenhuma de interface. A transcrição real e o custo por minuto permanecem na TASK-004.

## Validação

`npm run typecheck`: passou. `npm test -- --run`: 35/35. `npm run test:integration`: 30/30. `npm run build`: passou. QA isolado: zero erros, violações axe e overflow; confirmou opção desabilitada sem IA e proveniência automática em 1440/390, claro/escuro. Chrome real confirmou estimativa, saldo, consentimento, fila e progresso SSE.

## Handoff

Não se aplica; task pronta para `completed/`.

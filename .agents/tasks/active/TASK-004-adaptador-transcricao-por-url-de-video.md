---
id: TASK-004
title: Adaptador Gemini de transcrição por URL de vídeo e orçamento por minuto
status: active
type: integration
owner: ia-orcamento
created_at: 2026-09-14
updated_at: 2026-09-16
affected_modules: [src/server/providers.ts, src/server/budget.ts, src/worker.ts, migrations/004_budget_reservation_provider_model.sql, docs/INTEGRACOES.md]
related_use_cases: [transcrição de vídeo por URL]
related_adrs: [ADR-001]
---

# TASK-004 — Adaptador Gemini de transcrição por URL de vídeo e orçamento por minuto

## Contexto

Núcleo da Fase B do ADR-001. É esta task que transforma "colei um link" em "tenho texto para estudar", sem que o servidor baixe mídia: a URL é enviada ao Gemini e o Google faz o processamento do lado dele.

## Problema

`infer()` em `src/server/providers.ts:88` reserva orçamento a partir de uma estimativa de tokens de texto e de áudio (`90 * 100` para áudio curto). Vídeo não cabe nessa conta: o custo escala com a duração da mídia, não com o tamanho do prompt. Reservar por token de texto para uma chamada de vídeo subestimaria a reserva e furaria a regra de que a reserva precede e cobre a inferência.

## Objetivo

Um caminho de transcrição por URL de vídeo, com reserva de orçamento proporcional à duração, saída segmentada com timestamps aproximados, e nenhuma mídia trafegando pelo servidor.

## Fora de escopo

- Tela e fluxo de uso (TASK-005).
- Qualquer provedor além do Gemini.
- Download de áudio ou vídeo, em qualquer hipótese.

## Comportamento atual

`gemini.transcribe()` aceita `Buffer` de áudio do próprio proprietário. Não existe caminho que aceite URL.

## Comportamento esperado

Nova função de provedor que recebe a URL validada e a duração conhecida (vinda de `videos.list`, TASK-002), reserva orçamento em função dos minutos, chama o Gemini com a URL, valida e persiste os segmentos.

## Regras de negócio

- RN-01: A reserva de orçamento precede a chamada, como toda inferência. A fórmula de reserva passa a considerar duração; o multiplicador de folga existente (1,25) é mantido ou justificado se alterado.
- RN-02: Sem `duration_ms` conhecido, a transcrição é recusada — não se reserva orçamento cego.
- RN-03: Vídeo acima do limite de duração de TASK-003 é recusado antes de qualquer reserva.
- RN-04: Finalidade (`purpose`) própria em `budget_reservations` e `usage_events`, para que o custo de vídeo seja distinguível do custo de texto em `GET /api/usage`.
- RN-05: Saída sem medição de uso mantém a reserva em `unknown`, como já faz `infer()`. Não se repete automaticamente uma chamada que pode ter sido cobrada.
- RN-06: Resultado truncado ou incompleto **não** vira transcrição salva.
- RN-07: O servidor não baixa mídia. Nenhuma dependência de download entra no projeto.

## Critérios de aceitação

- [ ] CA-01: Transcrição de um vídeo curto real produz segmentos com `time_accuracy = 'approximate'` e o `origin` novo de TASK-003.
- [ ] CA-02: `GET /api/usage` mostra o custo da transcrição em finalidade separada da geração de atividade.
- [x] CA-03: Vídeo acima do limite é recusado sem criar reserva — verificável por `budget_reservations` vazia após a tentativa.
- [ ] CA-04: Custo real por minuto de vídeo medido e registrado em `docs/VALIDACAO.md`.
- [x] CA-05: Uma interrupção no meio da transcrição deixa a reserva em `unknown` e nenhum segmento parcial salvo.
- [x] CA-06: `docs/INTEGRACOES.md` reescrito: a frase que diz que o suporte a URL de vídeo não está ativado deixa de valer e é substituída pelos limites reais adotados.
- [x] CA-07: Nenhuma dependência nova no `package.json`.

## Impacto técnico

### Backend
`src/server/providers.ts` (função nova ao lado de `gemini.transcribe`), `src/server/budget.ts` (fórmula de reserva por duração), `src/worker.ts` (novo handler de job).

### Frontend
Nenhum nesta task.

### Banco de dados
Nenhuma migração — consome o schema de TASK-003.

### Integrações
Primeiro uso do Gemini com entrada de vídeo por URL. Verificar no piloto se o tier gratuito permite esse modo e com que limite.

### Segurança
Conteúdo de terceiros passa a ser enviado ao provedor. No tier gratuito isso alimenta o treino do modelo — risco aceito em ADR-001, mas precisa estar visível ao proprietário antes da primeira transcrição.

## Plano de implementação

- [x] Etapa 1: Confirmar na documentação do provedor o formato exato de entrada de URL de vídeo e os limites do tier gratuito.
- [x] Etapa 2: Estender a fórmula de reserva para duração.
- [x] Etapa 3: Escrever o adaptador, com schema de saída segmentada validado por Zod.
- [x] Etapa 4: Adicionar o handler de job no worker.
- [ ] Etapa 5: Medir custo e latência com um vídeo curto; registrar.
- [x] Etapa 6: Exercitar recusa por duração, interrupção e resposta truncada.
- [x] Etapa 7: Reescrever a seção de YouTube em `docs/INTEGRACOES.md`.

## Estratégia de testes

- [x] Unitários: fórmula de reserva por duração e contrato de SDK sem tráfego externo.
- [x] Integração: `npm run test:integration` com recusa por duração, falha sem parcial e persistência atômica.
- [ ] E2E: não se aplica.
- [ ] Manual: um vídeo curto real, medido.

## Riscos e rollback

Maior risco de custo do plano inteiro. Mitigação aplicada: vídeo de 8 min 15 s e teto temporário de US$ 1 no aplicativo. Rollback é desativar o novo `jobs.kind` — o schema de TASK-003 permanece sem causar dano. O agente `ia-orcamento` tem poder de veto sobre esta task.

## Registro de execução

### Alterações realizadas
Implementado adaptador de vídeo com URL canônica do YouTube, blocos `text`/`video` da API Interactions, saída segmentada validada, reserva conservadora por duração, preços próprios do modelo de vídeo, timeout de 180 s, retries do SDK desativados e persistência atômica no worker. A migração 004 registra provedor/modelo na reserva para o disjuntor operar por identidade.

### Arquivos principais
`src/server/providers.ts`, `src/server/budget.ts`, `src/worker.ts`, `migrations/004_budget_reservation_provider_model.sql`, `tests/providers.test.ts`, `scripts/integration.ts`, `docs/INTEGRACOES.md` e `docs/VALIDACAO.md`.

### Decisões
Modelo final configurado: `gemini-3.5-flash-lite`, indicado pela própria API para contas novas. O servidor não baixa mídia. HTTP 5xx e timeout são ambíguos e mantêm reserva; 4xx conhecido libera.

### Divergências
O plano supunha que um vídeo curto produziria medição na primeira janela. O Google respondeu 503 por alta demanda nos modelos válidos; depois da correção para o contrato atual de Interactions, 3.5 Flash-Lite respondeu 500 com a mesma condição. O fallback 2.5 retornou 404 por indisponibilidade para conta nova.

### Pendências
CA-01, CA-02, CA-04, etapa 5 e teste manual dependem de uma resposta real com uso. Até lá não existe custo por minuto nem segmento real para declarar.

## Validação

`npm run typecheck`: passou. `npm test -- --run tests/providers.test.ts`: 22/22. `npm run test:integration`: 30/30, sem chamadas externas. `npm run build`: passou. Piloto real: URL aceita e processada pelo worker; 503 `UNAVAILABLE` e, no contrato atual de Interactions, 500 por alta demanda; zero segmentos e reservas preservadas para conciliação. Detalhes em `docs/VALIDACAO.md`.

## Handoff

Continuar nesta task após a janela do disjuntor e quando o endpoint de vídeo do Gemini estiver disponível.

## Desbloqueio — 2026-09-16

### Diagnóstico

O bloqueio nunca foi indisponibilidade do provedor. O 503/500 "high demand" era sintoma, não causa. Três defeitos independentes, isolados por bissecção da requisição contra `v1beta/interactions`:

1. **`processing: "agentic"` em `gemini-3.5-flash-lite`.** O modelo não sustenta o laço de ferramentas do processamento agêntico: a mesma URL alterna entre HTTP 400 "Model generated invalid JSON syntax" e HTTP 500 "high demand". Sem a flag, o mesmo vídeo de 13 min 57 s é lido normalmente (76.166 tokens de vídeo, HTTP 200).
2. **`minItems`/`maxItems` no schema de saída estruturada.** Vinham de `z.array(...).min(1).max(240)` em `videoTranscript` e não estavam em `unsupportedGeminiSchemaKeywords`. O Gemini recusa a requisição inteira com HTTP 400 "Request contains an invalid argument" — reproduzido com prompt de texto puro, sem vídeo, em 0,6 s. Afetava também `generatedUnit` (geração de atividade pelo Gemini), hoje mascarado por `AI_TEXT_PROVIDER=openai`.
3. **Drift de tempo tratado como erro fatal.** O Gemini estima os tempos e acumula drift: 837 s de vídeo voltaram com o trecho final em 936 s (~12%), sendo esse trecho o encerramento real. A validação `endMs > durationMs + 2000` rejeitava a transcrição inteira.

Verificado que a chave `...b5OA` é válida (projeto `gen-lang-client-0923897944`, nível gratuito) e que `gemini-3.5-flash-lite` é o único modelo testado que aceita URL do YouTube de forma confiável: `gemini-3.5-flash` e `gemini-3.6-flash` retornam 400 "invalid argument", `gemini-3.5-transcribe` recusa a modalidade, `gemini-3.8-flash` aceita mas excede 300 s.

### Correções

- `src/server/providers.ts`: `gemini-3.5-flash-lite` sai de `agenticVideoModels`; `minItems`/`maxItems` entram em `unsupportedGeminiSchemaKeywords`; a mensagem do 400 deixa de afirmar que o Gemini "recusou o vídeo após processá-lo" (causa falsa para um 400 de requisição).
- `src/domain/content.ts`: novo `fitTranscriptToDuration()` — reescala a linha do tempo por `durationMs / lastEnd` quando há drift, e mantém a recusa acima de `MAX_TIME_DRIFT` (1,5×), que é erro de unidade e não drift.

### Resultado real

Transcrição concluída pela interface: **78 trechos**, 983 ms → 837.000 ms, zero fora da duração, `origin=provider_video_url`, `time_accuracy=approximate`, `quality_status=ai_unreviewed`. Fonte em `text_ready`. Reserva `settled` (US$ 0,058 no contador do app; conta em nível gratuito, sem fatura real).

### Pendências

- **Qualidade não revisada:** 9 dos 78 trechos são repetição de um bloco anterior (69 inícios distintos) — o modelo repetiu uma seção por volta de 00:53/03:13. Revisão humana do texto continua pendente, como previsto por `ai_unreviewed`.
- **Custo por minuto:** medido em conta gratuita, portanto sem preço real conciliado. CA-02 permanece aberto até um piloto com faturamento ativo.
- **Drift linear é hipótese:** o reescalonamento assume drift acumulativo aproximadamente linear, apoiado em o último trecho ser o encerramento real do vídeo. Não há ground truth para os tempos do meio.

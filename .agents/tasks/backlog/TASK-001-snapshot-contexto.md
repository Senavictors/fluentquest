# Snapshot — TASK-001

Gerado em: 2026-09-14 23:30
Task: `.agents/tasks/backlog/TASK-001-configurar-e-pilotar-gemini.md`

## ADR de referência

`.agents/decisions/ADR-001-ativacao-camada-ia.md` — ativação da camada de IA em três fases. TASK-001 é a primeira task da Fase A e a primeira do projeto inteiro a gerar tráfego externo real.

Parâmetros já decididos pelo proprietário, não reabra: teto mensal **US$ 10**, chave Gemini no **tier gratuito**.

## Estado verificado em 2026-09-14

- `tsc --noEmit` limpo; `npm test` 11/11.
- PostgreSQL 18.4 vivo, 26 tabelas, migrações `001_initial` e `002_learning_flow` aplicadas.
- Proprietário e `learner_profiles` já existem; 1 fonte (pacote de exemplo); `usage_events` e `budget_reservations` **vazias** — nenhuma chamada jamais foi feita.
- `.env.local` tem `AI_ENABLED=false` e **não** tem `GEMINI_API_KEY`, `AI_PRICES_REVIEWED_ON`, `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION`, `YOUTUBE_API_KEY`.
- `@google/genai` 2.22.0 instalado; o namespace `Interactions` que o código usa existe nos tipos (`node_modules/@google/genai/dist/genai.d.ts:8424`). Modelo `gemini-3.5-flash-lite` **nunca foi chamado** — existência na conta não verificada.

## Assinaturas de código necessárias

- `integrationStatus()` em `src/server/providers.ts:12` — devolve `{ai, youtube, model, message}`; `ai` só é `true` com `AI_ENABLED === "true"` **e** `GEMINI_API_KEY` **e** `AI_PRICES_REVIEWED_ON` preenchidos.
- `requireAI()` em `src/server/providers.ts:22` — lança `INTEGRATION_NOT_CONFIGURED` (503) ou `PRICES_REVIEW_REQUIRED` (503) se a revisão de preço passou de 31 dias.
- `infer(userId, purpose, prompt, schema?, audio?, onText?)` em `src/server/providers.ts:88` — caminho único de toda inferência: cache por usuário/conteúdo/modelo/schema/prompt, disjuntor após 3 reservas `unknown` em 10 min, reserva de orçamento, chamada, conciliação, validação de schema, gravação em `result_cache`.
- `normalizeUsage(usage)` em `src/server/providers.ts:61` — lança `USAGE_UNKNOWN` se o provedor não devolver contagem de tokens de entrada e saída.
- `gemini.explain / generate / transcribe` em `src/server/providers.ts:269` — tutor, geração de atividade (valida que `segmentIds` existem na fonte) e transcrição de áudio próprio.
- `streamTutor(userId, context, question, onText)` em `src/server/providers.ts:304` — tutor por SSE.
- `assessSpeech(userId, audio, mime, prompt)` em `src/server/providers.ts:319` — transcreve e depois avalia; devolve sempre `pronunciation: "not_assessed"`.
- `reserveBudget(userId, purpose, micros)` em `src/server/budget.ts:20` — bloqueia com `AI_CONCURRENCY_LIMIT` acima de 2 reservas ativas e com `BUDGET_EXCEEDED` ao estourar `monthly_limit_cents * 10000`.
- `settleBudget(id, {model,input,output,micros,priceVersion,raw})` em `src/server/budget.ts:89` e `failBudget(id, ambiguous)` em `src/server/budget.ts:129` — conciliação; `ambiguous` mantém a reserva em `unknown`.
- `tokenCostMicros(input, output, inputPrice, outputPrice)` em `src/server/budget.ts:12` — `tokens * preço_por_milhão` já resulta em micros de dólar. Conta conferida, não "corrija".
- `usage(userId)` em `src/server/budget.ts:135` — alimenta `GET /api/usage`; `forecast` é `null` de propósito.
- `PATCH /api/profile` em `src/server/api.ts:268` — aceita `monthlyLimitCents` e `alertCents`; é por aqui que o teto vira US$ 10, sem SQL manual.
- `GET /api/bootstrap` em `src/server/api.ts:236` — devolve `integrations: integrationStatus()`, consumido pela tela de Ajustes em `src/client/Settings.tsx:344`.
- `prepare(id)` em `src/worker.ts:6` — job de preparo; falha com `NO_TRANSCRIPT` se a fonte não tiver segmentos.

## Restrições ativas

- **IA nunca simula avaliação.** Com a integração indisponível o estado correto é "integração não configurada". Resultado truncado ou sem medição de uso não vira avaliação salva.
- **Orçamento é reservado antes da inferência.** Máximo duas reservas ativas; timeout ambíguo mantém o valor reservado; nunca repetir automaticamente uma inferência que pode já ter sido cobrada.
- **Credencial só em `.env.local`**, que não é versionado. Nenhuma chave em arquivo do repositório, em documento ou em conversa de agente.
- **Preço não se inventa.** `GEMINI_INPUT_USD_PER_MILLION` e `GEMINI_OUTPUT_USD_PER_MILLION` vêm da tabela oficial do provedor na data da configuração; `AI_PRICES_REVIEWED_ON` recebe essa data e vence em 31 dias.
- **Tier gratuito: não há fatura.** O passo 5 do piloto (`docs/INTEGRACOES.md`) não pode ser concluído e deve ser registrado como pendente, nunca como aprovado. O teto de US$ 10 é freio de uso, não de gasto.
- **Privacidade no tier gratuito.** O provedor pode usar o conteúdo para treino, apesar de `store: false`. Nenhuma gravação de voz é enviada antes de esse risco estar visível ao proprietário.
- **Escopo:** nada de transcrição de vídeo por URL aqui — isso é TASK-004, Fase B. Nenhum provedor além do Gemini — isso é TASK-007, Fase C.

## Próximo passo imediato

Criar a chave da API Gemini no console do Google (tier gratuito), aplicar os limites disponíveis no lado do provedor e anotar os preços oficiais de entrada e saída do modelo `gemini-3.5-flash-lite` com a data da consulta. Só depois disso o `.env.local` é preenchido — a chave é colada pelo proprietário, não por um agente.

---
Para retomar: abra uma sessão nova e peça para ler este arquivo antes de continuar a task `TASK-001`.

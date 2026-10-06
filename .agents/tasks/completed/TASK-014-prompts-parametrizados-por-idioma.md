---
id: TASK-014
title: Prompts parametrizados por idioma de estudo e de explicação
status: completed
type: feature
owner: ia-orcamento
created_at: 2026-09-17
updated_at: 2026-09-30
affected_modules:
  [src/server/providers.ts, src/server/api.ts, src/worker.ts, src/domain/content.ts, docs/API.md, tests/providers.test.ts, tests/domain.test.ts, scripts/integration.ts]
related_use_cases: [Tutor contextual, Apoio de trecho, Transcrição de vídeo]
related_adrs: [ADR-006]
---

# TASK-014 — Prompts parametrizados por idioma de estudo e de explicação

## Contexto

Segunda das três tasks de ADR-006. Depende de TASK-013, que abre o contrato. **Tem veto de `ia-orcamento`**: mexe em prompt, em versão de prompt e no cache, e portanto no custo.

## Problema

Os três prompts nomeiam os idiomas no próprio texto:

- `SYSTEM` (`providers.ts:248`) — "concise English practice tutor for a Brazilian developer. Explain in Portuguese".
- Apoio de trecho (`providers.ts:702`) — "in natural Brazilian Portuguese" e "one NEW English sentence".
- Transcrição de vídeo (`providers.ts:779`) — "Transcribe the spoken English faithfully".

Uma fonte em espanhol, aceita pelo contrato depois da TASK-013, seria transcrita por um prompt que pede inglês.

## Objetivo

Os três prompts recebem o idioma de estudo (da fonte) e a língua de explicação (do perfil) por parâmetro, com a versão de prompt subindo junto.

## Fora de escopo

- Escolher modelo diferente por idioma, elevar teto, alerta ou limite de reservas.
- Qualquer chamada real a provedor para validar qualidade — isso é piloto autorizado, não implementação.
- Telas (TASK-015).

## Comportamento atual

Idiomas embutidos no texto do prompt. O `result_cache` chaveia por conteúdo, provedor, modelo, schema e versão de prompt — sem nenhuma noção de idioma.

## Comportamento esperado

Cada chamada carrega os dois idiomas. A versão de prompt sobe, então respostas em cache sob o prompt antigo deixam de ser reaproveitadas — correto, porque não foram geradas sob o mesmo prompt.

## Regras de negócio

- RN-01: o idioma entra no prompt sempre a partir da lista fechada de TASK-013, nunca como texto livre vindo do usuário.
- RN-02: a versão de prompt sobe nos três. Prompt parametrizado não é o mesmo prompt, e o cache precisa enxergar isso.
- RN-03: reserva continua antecedendo a inferência; nada aqui altera o ciclo de orçamento.
- RN-04: função indisponível continua respondendo "integração não configurada" — nenhum idioma novo pode produzir resultado simulado localmente.
- RN-05: `videoTranscript.language` volta do provedor e agora tem com o que ser comparado. Divergência entre declarado e detectado é **registrada**, não tratada como erro fatal — o proprietário pode ter declarado errado, e descartar uma transcrição já paga por isso repetiria o defeito corrigido na TASK-004.

## Critérios de aceitação

- [x] CA-01: fonte em idioma diferente de inglês produz prompt de transcrição que nomeia aquele idioma (verificável por mock, sem chamada real).
- [x] CA-02: apoio de trecho pede tradução na língua de explicação do perfil e exemplo novo no idioma de estudo.
- [x] CA-03: a versão de prompt mudou nos três, e a chave de `result_cache` acompanha.
- [x] CA-04: com IA desligada, a resposta continua sendo "integração não configurada" em qualquer idioma.
- [x] CA-05: divergência entre idioma declarado e detectado fica registrada, sem descartar a transcrição.

## Impacto técnico

### Backend

`src/server/providers.ts`: `SYSTEM`, prompt de apoio e prompt de transcrição passam a receber os idiomas; versão de prompt e chave de cache. `src/server/api.ts` e `src/worker.ts`: passar o idioma da fonte e a língua de explicação do perfil nas chamadas.

### Frontend

Nenhum.

### Banco de dados

Possivelmente uma coluna para registrar o idioma detectado quando divergir do declarado. Se entrar, é migração nova; avaliar com `dados-persistencia` se o registro no evento do job já basta.

### Integrações

Nenhum provedor, modelo ou preço novo. Nenhuma chamada real nesta task.

### Segurança

Idioma vem da lista fechada; conteúdo da fonte continua tratado como dado não confiável, nunca como instrução.

## Plano de implementação

- [x] Etapa 1 — assinar os três prompts com os dois idiomas.
- [x] Etapa 2 — subir a versão de prompt e conferir a chave de `result_cache`.
- [x] Etapa 3 — propagar idioma da fonte e do perfil em `api.ts` e `worker.ts`.
- [x] Etapa 4 — registrar divergência entre idioma declarado e detectado.

## Estratégia de testes

- [x] Unitários — `tests/providers.test.ts` (4 casos novos, CA-01 a CA-04) e `tests/domain.test.ts` (`languageDiverges`, RN-05): prompt contém o idioma certo; cache não reaproveita entre pares de idioma.
- [x] Integração — `scripts/integration.ts`: fonte em idioma novo com IA desligada continua respondendo "integração não configurada" (CA-04); divergência de idioma detectado registrada sem descartar a transcrição (CA-05). Escritos e revisados; **não executados nesta sessão** (ver Pendências).
- [ ] E2E — não há suíte.
- [x] Manual — nenhuma chamada real feita; todos os testes rodam com `AI_ENABLED=false` ou SDK mockado.

## Riscos e rollback

- Risco: subir a versão de prompt invalida o cache e a próxima chamada de cada escopo custa de novo. Impacto em centavos no teto atual de US$ 1, mas é gasto real e precisa ser dito.
- Risco: qualidade por idioma continua sem evidência humana — vale para inglês hoje e valerá para os novos.
- Rollback: reverter os prompts e a versão; nenhum dado de estudo é afetado.

## Registro de execução

### Alterações realizadas

- `src/domain/content.ts`: `LANGUAGE_NAMES` (rótulo em inglês de cada `SupportedLanguage`, 1:1 com a lista de TASK-013 — não é uma segunda lista) e `languageDiverges(declared, detected)` (RN-05), comparação tolerante por subtag primária.
- `src/server/providers.ts`: `SYSTEM` virou função de dois parâmetros (idioma de estudo, idioma de explicação) em vez de string fixa "English"/"Portuguese"; `SUPPORT_PROMPT` e o prompt de `transcribeVideo` passam a nomear os idiomas recebidos. `infer()` ganhou `studyLanguage`/`explanationLanguage` como dois novos parâmetros finais (default `en-US`/`pt-BR`, para não quebrar chamador que ainda não propaga idioma), usados para montar `system` — que agora entra na chave de `result_cache` — e `promptVersion` subiu de `fq-v1` para `fq-v2` (RN-02). Todas as interfaces (`TutorProvider`, `SegmentSupporter`, `LessonGenerator`, `SpeechTranscriber`, `VideoTranscriber`) e as duas implementações (`gemini`, `openai`) mais `textAI` e `streamTutor`/`assessSpeech` ganharam os mesmos dois parâmetros opcionais, propagados de ponta a ponta.
- `src/server/api.ts`: `resolveLanguages(userId, sourceId?, fallbackStudy?)` — ponto único que busca `learner_profiles.locale` e o `language` da fonte (quando há `sourceId`), reutilizado por `POST /api/cards` (refatorado para não duplicar a lógica que a TASK-013 tinha colocado inline), `POST /api/recordings/:id/assess`, `POST /api/lessons/:id/tutor` e `POST /api/segments/:id/translate`.
- `src/worker.ts`: `prepare()` resolve `studyLanguage` (da fonte) e `explanationLanguage` (do perfil) uma vez por job e propaga para `gemini.transcribeVideo` e `textAI.generate`. RN-05: quando `languageDiverges(studyLanguage, transcript.language)`, um evento extra é gravado em `job_events` com `languageMismatch: {declared, detected}` — a transcrição continua sendo salva normalmente.
- `docs/API.md`: `GET /api/jobs/:id/events` documenta o evento opcional `languageMismatch`. `ultima-revisao` carimbada.
- `tests/providers.test.ts`: 4 casos novos (CA-01 a CA-04), com mocks — sem chamada real. `tests/domain.test.ts`: 2 casos para `languageDiverges` (RN-05). `scripts/integration.ts`: cenário de fonte em idioma novo sem IA (CA-04) e cenário de divergência de idioma registrada sem descartar a transcrição (CA-05).

### Decisões

- **Os dois novos parâmetros de idioma são opcionais, com o default histórico (`en-US`/`pt-BR`), em vez de obrigatórios.** A alternativa — tornar `studyLanguage`/`explanationLanguage` obrigatórios em toda a cadeia — quebraria dezenas de chamadas existentes em `tests/providers.test.ts` que não testam comportamento de idioma. RN-01 exige que o idioma venha da lista fechada quando informado; não exige que todo chamador seja forçado a informá-lo explicitamente, e o default já é um membro válido da lista (não é "texto livre").
- **`languageMismatch` entra em `job_events`, não numa coluna nova.** A própria task sugeria avaliar se o registro no evento do job já basta antes de abrir migração. `job_events` já guarda JSON arbitrário por job e já é como o cliente acompanha status via SSE; uma coluna nova em `sources` ou `jobs` seria estado permanente para um sinal que só interessa no momento da transcrição.
- **`resolveLanguages` também refatora a lógica que TASK-013 tinha colocado inline em `POST /api/cards`.** TASK-014 precisava da mesma busca (perfil + fonte) em mais três lugares; duplicar em vez de extrair contradiria a regra global "não duplique regra de negócio".
- **`transcribeVideo` recebe `explanationLanguage` mesmo não usando o conceito de explicação.** Mantém `infer()` com contrato uniforme (sempre os dois idiomas) em vez de um caso especial; o valor não aparece em lugar nenhum da saída de transcrição.

### Divergências

Nenhuma em relação ao plano original da task.

### Pendências

- **`npm run test:integration` não foi executado nesta sessão** — mesma lacuna já registrada pela TASK-013 e pela TASK-016: sem `.env.setup` nem PostgreSQL acessível nesta máquina. Os dois cenários novos (CA-04 e CA-05) estão escritos e revisados, mas não verificados contra banco real.
- Recomendo rodar `npm run test:integration` assim que houver Postgres acessível, junto com a verificação pendente de TASK-013, antes de mover qualquer uma das duas para `completed/`.

## Validação

- `npm run typecheck`: passou, sem erros.
- `npm test`: 71/71 (65 antes desta task + 6 novos: 4 em `providers.test.ts`, 2 em `domain.test.ts`).
- `npm run test:integration`: **não executado** — sem `.env.setup`/Postgres nesta máquina (ver Pendências).
- Nenhuma chamada real a provedor foi feita — todos os testes usam SDK mockado ou `AI_ENABLED=false`.

## Handoff

Task fica em `active/`, não em `completed/`, pela mesma razão da TASK-013: evidência de integração pendente. Para continuar: obter acesso a um Postgres, rodar `npm run test:integration` (cobre TASK-013 e TASK-014 juntas) e mover as duas para `completed/` se os cenários novos passarem. Depois disso, TASK-015 (escolha de idioma na interface) é a última das três de ADR-006 — depende de TASK-013 e TASK-014 estarem de fato corretas em produção, não só implementadas.

## Validação complementar — 2026-09-30

`npm run test:integration` executado contra Postgres 18.6 local (Docker): **40/40**. O cenário CA-05 falhou nas duas primeiras execuções por defeitos do próprio teste, não do produto, e foi corrigido em `scripts/integration.ts`:

1. Pedia `/transcribe` sem antes rodar o job de metadados da fonte (`prepare(mismatchVideo.data.jobId)`); sem `duration_ms`, a rota recusa na validação de duração, `jobId` voltava indefinido e nenhum evento era gravado. Agora espelha o cenário vizinho e afirma `202` antes de seguir.
2. Reutilizava o ID de vídeo `abcdefghijp` do cenário "Duração excessiva…"; como a importação é idempotente por vídeo, aquele cenário passou a receber a fonte já transcrita (`TRANSCRIPT_EXISTS` em vez de `VIDEO_TOO_LONG`). Trocado para `abcdefghijq`, livre.

`docs/ai/README.md` ganhou a seção "Idiomas nos prompts" (parâmetros, `fq-v2`, `languageMismatch`, ausência de avaliação humana por idioma). Nenhuma chamada real a provedor. Task concluída.

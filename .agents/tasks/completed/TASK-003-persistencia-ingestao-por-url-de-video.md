---
id: TASK-003
title: Persistência e domínio da ingestão por URL de vídeo
status: completed
type: feature
owner: dados-persistencia
created_at: 2026-09-14
updated_at: 2026-09-15
affected_modules: [migrations/003_video_transcription.sql, src/server/schema.ts, src/domain/content.ts, src/server/api.ts, docs/API.md]
related_use_cases: [ingestão de fonte do YouTube com transcrição]
related_adrs: [ADR-001]
---

# TASK-003 — Persistência e domínio da ingestão por URL de vídeo

## Contexto

Primeira task da Fase B do ADR-001. Antes de existir adaptador ou tela, o modelo de dados precisa saber representar um segmento cuja origem é uma transcrição feita pelo provedor a partir da URL do vídeo — distinta de `user_upload`, que é legenda fornecida pelo proprietário.

## Problema

`segments.origin` hoje recebe `'user_upload'` fixo em `src/server/api.ts:403`. Não existe valor que signifique "transcrito pelo provedor a partir da URL". Sem essa distinção, a proveniência mente: uma transcrição automática apareceria como legenda autorizada fornecida pelo proprietário, o que contradiz a exigência de honestidade de proveniência.

## Objetivo

Modelo de dados e validações capazes de representar, distinguir e limitar a transcrição por URL de vídeo, sem ainda fazer nenhuma chamada.

## Fora de escopo

- O adaptador que chama o Gemini (TASK-004).
- A tela (TASK-005).

## Comportamento atual

`origin` é sempre `user_upload`; `status` de fonte cobre `text_ready`, `no_transcript`, `processing`, `partial_ready`, `unavailable`; `jobs.kind` é `prepare`.

## Comportamento esperado

Existe um `origin` novo para transcrição por provedor; existe um `jobs.kind` novo para a transcrição; a duração máxima de vídeo aceita é validada no domínio; `rights` de fonte transcrita de terceiro é obrigatoriamente `public_link`.

## Regras de negócio

- RN-01: Migração **nova** em `migrations/003_*.sql`. `001_initial.sql` e `002_learning_flow.sql` já estão em `fq_migrations` e não podem ser editadas.
- RN-02: Todo segmento vindo de transcrição por URL nasce com `time_accuracy = 'approximate'`. Nunca `exact`.
- RN-03: A regra de duração máxima vive em `src/domain/content.ts`, pura, testável sem banco. O servidor não a duplica.
- RN-04: Uma fonte de terceiro transcrita não pode ser gravada com `rights = 'owned'`.

## Critérios de aceitação

- [x] CA-01: `migrations/003_*.sql` aplicada transacionalmente por `npm run db:migrate`, e `src/server/schema.ts` atualizado junto.
- [x] CA-02: Novo valor de `origin` distingue transcrição por provedor de legenda do proprietário.
- [x] CA-03: Limite de duração implementado em `src/domain/content.ts` com teste unitário próprio.
- [x] CA-04: `POST /api/sources` aceita a intenção de transcrever e recusa combinações de direitos inválidas, com `AppError` e mensagem em pt-BR.
- [x] CA-05: `docs/API.md` atualizado — contrato público não muda em silêncio.
- [x] CA-06: `npm run typecheck` limpo; `npm test` passa com o teste novo; `npm run test:integration` verde.

## Impacto técnico

### Backend
`src/server/api.ts` no handler de `POST /api/sources` (linha 355 em diante).

### Frontend
Nenhum nesta task.

### Banco de dados
Migração nova. Se `origin` e `status` forem colunas com CHECK ou enum, a migração precisa estender o domínio de valores sem quebrar linhas existentes — verificar `001_initial.sql` antes de escrever.

### Integrações
Nenhuma chamada nesta task.

### Segurança
O campo `rights` passa a carregar mais peso: é o que separa uso pessoal legítimo de alegação falsa de propriedade.

## Plano de implementação

- [x] Etapa 1: Ler `001_initial.sql` e `002_learning_flow.sql` e mapear como `origin`, `status` e `jobs.kind` estão restritos hoje.
- [x] Etapa 2: Escrever a migração 003.
- [x] Etapa 3: Atualizar `src/server/schema.ts`.
- [x] Etapa 4: Adicionar a regra de duração e o novo caminho de entrada em `src/domain/content.ts`, com teste.
- [x] Etapa 5: Ajustar o handler e `docs/API.md`.

## Estratégia de testes

- [x] Unitários: limite de duração e schema segmentado.
- [x] Integração: `npm run test:integration`, incluindo consentimento, persistência atômica e duração excessiva.
- [x] E2E: não se aplica.
- [x] Manual: backup criado antes da migração; `npm run db:migrate` aplicado no banco real sem alterar as fontes existentes.

## Riscos e rollback

Migração de schema em banco com histórico de estudo real. O agente `dados-persistencia` tem poder de veto. Fazer backup com `scripts/backup.ts` antes de aplicar; o rollback é `scripts/restore.ts`.

## Registro de execução

### Alterações realizadas
Adicionada a intenção `manual|ai`, limite puro de 15 minutos, schema de transcrição ordenada, colunas de rastreabilidade na fonte e rota autenticada/consentida para criar job de transcrição. Segmentos automáticos são gravados juntos com origem, qualidade e precisão explícitas.

### Arquivos principais
`migrations/003_video_transcription.sql`, `src/domain/content.ts`, `src/server/schema.ts`, `src/server/api.ts` e `docs/API.md`.

### Decisões
Vídeo de terceiro usa `rights=public_link`; a escolha de IA no cadastro registra intenção e a inferência só começa numa segunda mutação com consentimento e estimativa.

### Divergências
Nenhuma. A migração foi aditiva e não alterou migrações já aplicadas.

### Pendências
Nenhuma nesta task. Disponibilidade e medição do provedor pertencem à TASK-004.

## Validação

`npm run db:migrate`: passou no banco real. `npm run typecheck`: passou. `npm test -- --run`: 35/35. `npm run test:integration`: 30/30, sem chamadas externas. `npm run build`: passou.

## Handoff

Não se aplica; task pronta para `completed/`.

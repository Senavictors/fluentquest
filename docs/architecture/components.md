---
estado: real
fonte: src/client/, src/domain/, src/server/, src/worker.ts
ultima-revisao: 2026-09-17 (TASK-012; demais seções de 2026-09-14, bootstrap-init)
---

# Componentes

Componentes internos por camada. A direção de dependência permitida entre elas está em [dependencies.md](dependencies.md).

## Camada de entrada (HTTP)

- **`src/server/api.ts`** (1339 linhas) — todas as rotas da API local, verificação de proprietário em cada consulta de domínio, checagem de `Origin` em mutações e erros no formato `{code, message, retryable, requestId}`. Contratos completos em [`../API.md`](../API.md).
- **`src/server/auth.ts`** — Better Auth: `baseURL` e `trustedOrigins` derivados de `BETTER_AUTH_URL`; cookie seguro apenas quando a base é HTTPS; sinalizador `FQ_OWNER_SETUP` que libera o cadastro único usado por `scripts/owner.ts`.
- **`src/server/idempotency.ts`** — chave de idempotência por usuário e escopo, com resposta memorizada; sustenta o cenário de importação concorrente.

## Núcleo de domínio (puro)

- **`src/domain/content.ts`** (199 linhas) — `youtubeId` (validação exata de host e ID, defesa contra SSRF), `parseContent` (texto, SRT, VTT), `normalize` (deduplicação), schemas Zod (`sourceInput`, `cardInput`, `generatedUnit`, `speechFeedback`), `scenarios` autorais e a classe `AppError`.
- **`src/domain/review.ts`** (32 linhas) — agendamento FSRS (`initialCard`, `restoreCard`, `scheduleCard`) e progressão de XP (`xpLevel`, `nextLevelXp`), com a configuração versionada em `FSRS_CONFIG_VERSION`.

Nenhum dos dois importa `pg`, Next ou qualquer coisa de `src/server/` — é o que permite testá-los sem banco em `tests/domain.test.ts`.

## Acesso a dados e arquivos

- **`src/server/db.ts`** — `pool`, `db` (Drizzle), `query` e `transaction`.
- **`src/server/schema.ts`** — espelho tipado do SQL de `migrations/`.
- **`src/server/storage.ts`** — `ObjectStorage` sobre `data/objects/`, mais `removeUserObjects` para exclusão de conta.
- **`src/server/media.ts`** — verificação do conteúdo real do arquivo (`file-type`, `music-metadata`) e da duração (`ffprobe-static`), com limite de 25 MB / 30 minutos.

## Integração e custo

- **`src/server/providers.ts`** (384 linhas) — `integrationStatus`, `requireAI`, as interfaces `TutorProvider`, `LessonGenerator`, `SpeechTranscriber` e `VideoMetadataProvider`, o adaptador `gemini`, `streamTutor` (SSE), `assessSpeech` e `normalizeUsage`.
- **`src/server/budget.ts`** (168 linhas) — `budgetPeriod`, `tokenCostMicros`, `reserveBudget` (transacional, com `FOR UPDATE` e teto de duas reservas ativas), `settleBudget`, `failBudget` e `usage`.
- **`src/server/credentials.ts`** — chaves de provedor cadastradas pelo proprietário: cifra AES-256-GCM derivada de `BETTER_AUTH_SECRET`, cache de processo recarregado por requisição e por job, e precedência sobre a variável de ambiente correspondente (ADR-005). `credential()` é síncrona porque `providerConfig()` e `youtube.get()` são chamados longe de qualquer `userId`.
- **`src/server/queue.ts`** — `boss()`, `emitJob`, `dispatchJobs` sobre `pg-boss`.
- **`src/server/example.ts`** — pacote autoral de exemplo, explicitamente não atribuído a um vídeo real.

## Interface

- **`src/client/App.tsx`** (650 linhas) — casca, navegação entre destinos e carga inicial via `GET /api/bootstrap`.
- **`src/client/Study.tsx`** (1340 linhas) — biblioteca, ingestão de fontes, sala de estudo, player e modo imersão.
- **`src/client/Practice.tsx`** (721 linhas) — atividades de produção, gravação de áudio com consentimento, descarte e preservação.
- **`src/client/Settings.tsx`** (656 linhas) — perfil, metas, tema, atalhos, orçamento, exportação e exclusão.
- **`src/client/http.ts`** e **`src/client/types.ts`** — cliente HTTP e tipos compartilhados com o servidor.

## Observabilidade e infraestrutura transversal

- Erros de domínio padronizados por `AppError`, com `requestId` na resposta.
- `job_events` guarda eventos de job com ID persistido, servidos por SSE com suporte a `Last-Event-ID` — uma reconexão recupera o estado atual em vez de recomeçar.
- `rate_limits` implementa limitação por chave no próprio banco.
- Cabeçalhos de segurança definidos em `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` e `Permissions-Policy: camera=(), microphone=(self)`.
- Não há logging estruturado, métricas ou alerta externo — decisão compatível com o escopo local e de usuário único.

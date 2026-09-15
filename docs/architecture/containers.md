---
estado: real
fonte: package.json (scripts dev/start/worker), src/worker.ts, src/server/db.ts, src/server/queue.ts, migrations/
ultima-revisao: 2026-09-14 (bootstrap-init)
---

# Containers

Processos implantáveis de forma independente. Portas e variáveis de ambiente reais ficam em [deployment.md](deployment.md); aqui o foco é responsabilidade e comunicação.

## 1. Aplicação web (Next.js)

- Next.js 16 com App Router e Turbopack, React 19. Servidor e cliente no mesmo processo: as telas vivem em `src/client/` e as rotas HTTP em `src/server/api.ts`, expostas pelas rotas dinâmicas `/[[...screen]]`, `/api/[...path]` e `/api/auth/[...all]`.
- Autenticação Better Auth com sessão em cookie HttpOnly. Mutação exige `Origin` igual a `BETTER_AUTH_URL` — é o que produz 403 em acesso por `127.0.0.1` quando a base está configurada como `localhost`.
- Acessa o PostgreSQL diretamente pelo pool de `src/server/db.ts`. Enfileira trabalho pesado em vez de executá-lo na requisição.
- Comando real: `npm run dev:web` (desenvolvimento) ou `npm start` (produção local).

## 2. Worker (`src/worker.ts`)

- Processo separado, iniciado junto da web por `concurrently` em `npm run dev`, ou isolado por `npm run worker`.
- Consome a fila `pg-boss` (`QUEUE = "fluentquest-prepare"`, ver `src/server/queue.ts`): preparo de fontes, manutenção periódica, expiração de gravações e conclusão de exclusão de conta preservando tombstone.
- Persiste falha sem IA e é idempotente: duas execuções não duplicam preparo (cenário verificado em `scripts/integration.ts`).
- Anuncia o estado das integrações no boot — hoje, `FluentQuest worker pronto. IA desativada.`

## 3. Banco de dados (PostgreSQL 18)

- Banco e usuário exclusivos `fluentquest`; bancos de outros projetos não são tocados.
- Schema gerenciado por migrações SQL versionadas em `migrations/`, aplicadas por `scripts/migrate.ts` dentro de uma transação única, com `pg_advisory_xact_lock(843201)` e controle em `fq_migrations`.
- Hospeda também a fila `pg-boss` — não há broker separado.
- `src/server/schema.ts` é o espelho Drizzle tipado do SQL, mantido manualmente em sincronia.

## Serviços externos consumidos

| Serviço | Consumido por | Protocolo |
|---|---|---|
| Google Gemini | `src/server/providers.ts` (web e worker) | HTTPS via `@google/genai`, desligado por padrão |
| YouTube Data API | `src/server/providers.ts` (`youtube`) | HTTPS `videos.list`, só com `YOUTUBE_API_KEY` |
| YouTube player | `src/client/Study.tsx` | iframe oficial, no navegador |
| ffprobe | `src/server/media.ts` | binário local de `ffprobe-static` |

## Comunicação entre containers

```text
Proprietário → navegador → Aplicação web (127.0.0.1:3215) → PostgreSQL
                                     ↓ enfileira (pg-boss, no próprio Postgres)
                                  Worker → PostgreSQL
                                     ↓ (somente se AI_ENABLED=true)
                                  Gemini
```

Arquivos de mídia nunca trafegam por pasta pública: são gravados em `data/objects/` por `src/server/storage.ts` e servidos por rota autenticada com suporte a `Range`.

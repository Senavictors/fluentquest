---
estado: real
fonte: package.json (scripts), next.config.ts, .env.example, .env.local, scripts/migrate.ts, scripts/setup.ts, .claude/launch.json
ultima-revisao: 2026-09-17 (TASK-006, TASK-007, TASK-012)
---

# Implantação

Ambiente: **máquina local Windows do proprietário**. Não há Docker, nuvem, proxy reverso nem pipeline de deploy. O projeto vive em `C:\Users\Essencis007\Documents\FluentQuest`, com PostgreSQL 18 instalado nativamente.

## Processos/serviços

| Serviço | Processo | Porta | Path público | Env relevantes |
|---|---|---|---|---|
| Web | `next dev --hostname 127.0.0.1 --port 3215` (dev) / `next start --hostname 127.0.0.1 --port 3215` (produção local) | 3215 | nenhum — só loopback | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AI_ENABLED`, `DATA_DIR` |
| Worker | `tsx watch --env-file=.env.local src/worker.ts` (dev) / `tsx --env-file=.env.local src/worker.ts` | — | — | as mesmas, mais `PG_BIN` para manutenção |
| PostgreSQL | serviço do Windows | 5432 | — | — |

`npm run dev` sobe web e worker juntos via `concurrently -k`; `Ctrl+C` encerra os dois.

## Roteamento/proxy

Não há. A escolha de `--hostname 127.0.0.1` é deliberada: a aplicação **não** escuta em interface de rede e não é alcançável por outro computador. A porta 3215 foi escolhida por não colidir com os outros projetos locais do proprietário (3000, 3900, 4300 e 5000 estão ocupadas por outros serviços).

**Armadilha conhecida, já observada na prática**: Better Auth valida a origem contra `BETTER_AUTH_URL`. Com a base em `http://localhost:3215`, abrir a aplicação por `http://127.0.0.1:3215` faz toda mutação responder **403 `Invalid origin`** — inclusive o login, que falha *antes* de a senha ser avaliada. Use sempre `localhost`, ou ajuste `BETTER_AUTH_URL`. O arquivo `.claude/launch.json` já fixa a URL correta do preview.

## Variáveis de ambiente relevantes

- `DATABASE_URL` — conexão do usuário exclusivo `fluentquest`. Gerada com senha aleatória por `scripts/setup.ts`.
- `BETTER_AUTH_SECRET` — segredo de sessão, mínimo de 32 caracteres.
- `BETTER_AUTH_URL` — base e origem confiável da autenticação. Default `http://localhost:3215`.
- `AI_ENABLED` — default `false`. Enquanto falso, as funções de IA informam "integração não configurada".
- `AI_TEXT_PROVIDER` — seleciona `gemini` ou `openai` para tutor, atividade e tradução.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION`, `AI_PRICES_REVIEWED_ON` — Gemini para texto quando selecionado, vídeo por URL e transcrição de fala; a revisão vence em 31 dias.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`, `OPENAI_PRICES_REVIEWED_ON` — OpenAI para texto; a revisão vence em 31 dias. A chave nunca é exposta ao cliente.
- `YOUTUBE_API_KEY` — opcional; só habilita metadados. O player funciona sem ela.

As três chaves (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`) também podem ser cadastradas em Ajustes → Integrações, onde ficam cifradas na tabela `integration_credentials` e valem para web e worker sem reinício; a chave cadastrada tem precedência sobre a variável correspondente, que permanece como fallback (ADR-005). `AI_ENABLED`, `AI_TEXT_PROVIDER` e as datas de revisão de preço continuam exclusivamente no ambiente. Trocar `BETTER_AUTH_SECRET` torna as chaves guardadas ilegíveis e elas passam a contar como ausentes.
- `DATA_DIR` — raiz dos arquivos privados (default `./data`).
- `PG_BIN` — caminho dos binários do PostgreSQL, usado por backup e restauração.

Arquivos de ambiente: `.env.local` (aplicação), `.env.setup` (credencial administrativa para provisionamento) e `.env.owner` (credenciais do proprietário). Nenhum é versionado; `.env.example` é o modelo.

## Boot da aplicação

1. Provisionamento, uma única vez: `npm run setup` cria banco e usuário (recusa sobrescrever existentes) e `npm run db:migrate` aplica as migrações.
2. Criação do proprietário, uma única vez: `npm run owner:create` lê `.env.owner`. O script recusa criar um segundo proprietário e o cadastro pela interface é desabilitado.
3. `npm run dev` sobe web e worker. O worker conecta ao `pg-boss` e informa o estado das integrações no log.
4. O cliente carrega `GET /api/bootstrap`, que responde 401 enquanto não há sessão — é o comportamento esperado na tela de login.

## Armazenamento de arquivos

`data/objects/`, fora de qualquer pasta pública, com `DATA_DIR` configurável. Gravações têm `expires_at` padrão de 7 dias e sinalizador `preserve`; a expiração é executada pelo worker. Backups manuais vão para `backups/<timestamp>/` via `npm run backup`.

## Observabilidade

Log de console dos dois processos, `job_events` como trilha persistente por job e `usage_events` como livro-razão de custo de IA. Não há métricas, tracing ou alerta externo.

## Divergência conhecida

Nenhuma divergência entre este documento e o código. Pendência operacional registrada em [`../OPERACAO.md`](../OPERACAO.md): o backup é manual, e nenhuma tarefa agendada do Windows foi criada.

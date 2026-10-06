---
id: TASK-016
title: Preparar FluentQuest para implantação no Railway com banco vazio
status: active
type: infrastructure
owner: dados-persistencia
created_at: 2026-09-19
updated_at: 2026-09-30
affected_modules: [package.json, Dockerfile, .dockerignore, .railway/railway.ts, scripts/owner.ts, src/server/auth.ts, docs/architecture/deployment.md]
related_use_cases: [abrir o app no navegador usando Railway]
related_adrs: [ADR-007]
---

# TASK-016 — Preparar FluentQuest para implantação no Railway com banco vazio

## Contexto e objetivo

O `.env.local` e o PostgreSQL local não estão disponíveis. O proprietário escolheu iniciar com banco vazio e preparar o projeto para Railway. A task configura build/runtime, PostgreSQL gerenciado, migrações, armazenamento persistente e o bootstrap seguro do único proprietário, sem provisionar infraestrutura externa nesta etapa.

## Fora de escopo

- Aplicar a configuração em projeto Railway existente, criar serviço, gerar domínio público ou executar cobrança.
- Importar dados locais, ativar IA, cadastrar credenciais de provedor ou criar proprietário remoto nesta preparação.
- Migrar para um storage de objetos externo.

## Critérios de aceitação

- [x] Railway IaC declara somente app FluentQuest, Postgres novo e volume, referenciando `Senavictors/FluentQuest`.
- [x] O app usa a porta Railway, liga em `0.0.0.0` e executa worker e web juntos.
- [x] O pre-deploy aplica migrações existentes sem depender de `.env.local`.
- [x] O caminho de arquivo do proprietário aponta ao volume persistente, e `.env*` e `data/` não entram na imagem.
- [x] `owner:create:railway` usa variáveis Railway ou `.env.owner`, mantém recusa de segundo usuário e exige senha de pelo menos 12 caracteres.
- [x] `AI_ENABLED` segue `false`, sem segredos versionados ou domínio público declarado.
- [x] Documentação explica o fluxo de plano/aplicação, variáveis, criação do proprietário e backups.
- [x] Typecheck e build executados; nenhum recurso Railway foi criado nesta task.

## Riscos e pendências

- Railway IaC em TypeScript depende da CLI Railway compatível com a API atual.
- A primeira aplicação precisa de um `BETTER_AUTH_SECRET` configurado no serviço e, depois de gerar um domínio, `BETTER_AUTH_URL` atualizado com a origem HTTPS exata.
- Região e custo final dependem do projeto dedicado e do plano/valores vigentes da conta.
- A validação real de banco, worker e autenticação requer deploy em projeto Railway dedicado.
- Docker Desktop está instalado, mas seu engine não estava ativo para executar `docker build` durante esta sessão.

## Estado verificado em 2026-09-30

A configuração **já foi aplicada** — pelo proprietário, em 21/09, depois do handoff de 19/09 que ainda dizia "nada provisionado". Conferido por leitura na conta `victorsena760@gmail.com`, workspace "Victor Sena's Projects", projeto `FluentQuest` (ID `96a50419-3d67-48cb-9bb5-bb56a0c7a580`, ambiente `production`, região `us-west2`):

- `fluentquest-app`: GitHub `Senavictors/FluentQuest@main`, Dockerfile, pre-deploy `npm run db:migrate:railway`, 1 réplica, volume `fluentquest-files` (1 GiB) em `/app/data`. Deploy `3f98f194` SUCCESS com healthcheck OK, no commit **`49f12eb`** — três commits atrás da `main` (TASK-013/014/015 não estão em produção; nenhuma migração nova entre eles). Variáveis: `AI_ENABLED`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, `DATA_DIR`, `NODE_ENV`. Sem `BETTER_AUTH_URL` e sem domínio.
- `fluentquest-postgres`: `postgres-ssl:18` (18.6), volume de 5 GB. Banco `railway` com as sete migrações em `fq_migrations` e **zero** usuários (proprietário remoto não criado).

Nesta sessão, com autorização do proprietário: um proxy TCP temporário foi aberto no Postgres e **removido** depois; o role `fluentquest` foi criado no servidor para `integration.ts` (senha aleatória, já descartada — `.env.setup`/`.env.local` foram regravados para o banco local). O role não é dono de nada e **continua existindo**; removê-lo exige aprovação (`DROP ROLE fluentquest`). A integração remota travou na fila (pg-boss) sem mensagem e foi abandonada em favor do Postgres local em Docker.

### Próximos passos (operação, cada um com autorização)

1. Redeploy da `main` atual no `fluentquest-app` (leva TASK-013/014/015 à produção; sem migração nova).
2. Criar o proprietário remoto por SSH com `npm run owner:create:railway` (ver `docs/architecture/deployment.md`).
3. Quando for publicar: gerar domínio, configurar `BETTER_AUTH_URL` com a origem HTTPS exata e redeployar.
4. Backups do Postgres e do volume na Railway.
5. Remover o role `fluentquest` não usado no Postgres remoto.

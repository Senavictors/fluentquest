---
id: TASK-016
title: Preparar FluentQuest para implantação no Railway com banco vazio
status: active
type: infrastructure
owner: dados-persistencia
created_at: 2026-09-19
updated_at: 2026-09-19
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

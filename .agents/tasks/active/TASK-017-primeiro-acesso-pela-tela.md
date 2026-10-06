---
id: TASK-017
title: Primeiro acesso pela tela, com código de configuração
status: active
type: feature
owner: dados-persistencia
created_at: 2026-10-05
updated_at: 2026-10-05
affected_modules: [src/server/auth.ts, src/server/setup.ts, src/app/api/setup/route.ts, src/client/App.tsx, scripts/integration.ts, docs/API.md, docs/architecture/deployment.md, .env.example]
related_use_cases: [criar a conta do proprietário sem acesso ao servidor]
related_adrs: [ADR-008, ADR-007]
---

# TASK-017 — Primeiro acesso pela tela, com código de configuração

## Contexto

O app foi publicado no Railway em 21/09/2026 sem nenhum usuário, e o único caminho de criação (comando dentro do container por SSH) falhou no ambiente do proprietário. Ver ADR-008.

## Problema

Sem conta não há como entrar, e um `register` aberto expõe o app numa URL pública.

## Objetivo

Permitir que o proprietário crie a própria conta pelo navegador, uma única vez, sem abrir cadastro para terceiros.

## Fora de escopo

- Recuperação de senha, convite de outros usuários ou qualquer segunda conta.
- Remover `owner:create` e `owner:create:railway`.

## Comportamento esperado

- Banco sem usuário e `FQ_SETUP_TOKEN` configurada: a tela de login vira "Primeiro acesso" (e-mail, senha, repetir senha, código).
- Código correto: conta criada, perfil criado, login automático.
- Qualquer outro caso: login normal, `POST /api/setup` recusado.

## Regras de negócio

- RN-01: só existe um proprietário; a criação é serializada e a segunda tentativa recebe `409 OWNER_EXISTS`.
- RN-02: sem `FQ_SETUP_TOKEN` válida (16+ caracteres) a rota não cria nada (`SETUP_DISABLED`).
- RN-03: o cadastro público de `/api/auth/*` continua desabilitado.
- RN-04: 10 tentativas por minuto em `POST /api/setup`.

## Critérios de aceitação

- [x] CA-01: sem código configurado, `GET` devolve `open:false` e `POST` não cria usuário.
- [x] CA-02: origem inválida, código errado e senha curta não criam usuário.
- [x] CA-03: duas criações simultâneas resultam em um 201 e um 409, com um único usuário e um perfil.
- [x] CA-04: depois da criação, `GET` devolve `open:false` e `POST` devolve `OWNER_EXISTS`.
- [x] CA-05: a tela abre, recusa código errado e entra com o código certo (verificado no navegador, banco vazio temporário).
- [x] CA-06: `docs/API.md`, `.env.example`, deployment e ADR-008 atualizados.
- [x] CA-07: axe sem violações e sem overflow em desktop/mobile, claro/escuro.
- [ ] CA-08: deploy no Railway, `FQ_SETUP_TOKEN` configurada, conta criada em produção e a variável removida em seguida.

## Impacto técnico

### Segurança
Comparação do código em tempo constante, `Origin` obrigatório, advisory lock, limite de tentativas. A janela de risco termina na primeira criação; a variável deve ser removida depois.

## Registro de execução

### Alterações realizadas
- `src/server/auth.ts`: fábrica `build(disableSignUp)`; `auth` (cadastro fechado) e `ownerSetupAuth`.
- `src/server/setup.ts` e `src/app/api/setup/route.ts`: `GET`/`POST /api/setup`.
- `src/client/App.tsx`: `FirstAccess` no lugar do login quando `open:true`.
- `scripts/integration.ts`: cenário "Primeiro acesso".

### Pendências
- CA-08: depende de deploy em produção.

## Validação

- `npm run typecheck`: passou.
- `npm test`: 71/71.
- `npm run test:integration`: 41/41, sem chamadas de IA.
- `npm run build`: passou, com `/api/setup` na lista de rotas.
- Navegador, banco vazio temporário: código errado recusado; código certo cria a conta, entra no app e fecha a tela. axe: 0 violações e 0 overflow em 4 variantes.

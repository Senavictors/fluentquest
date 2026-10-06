---
id: ADR-008
title: Primeiro acesso pela tela, protegido por código de configuração e fechado depois do proprietário
status: accepted
date: 2026-10-05
deciders: [Victor Sena]
related_tasks: [TASK-017]
---

# ADR-008 — Primeiro acesso pela tela, protegido por código de configuração e fechado depois do proprietário

## Contexto

O FluentQuest tem um único proprietário e o cadastro público era desabilitado: a conta só podia ser criada por `npm run owner:create` (local) ou `owner:create:railway` (dentro do container, por SSH). Em 21/09/2026 o app foi publicado no Railway e o proprietário não conseguiu criar a conta: o `railway ssh` interativo no PowerShell do Windows não entrega o Enter ao container, e o caminho alternativo exigia montar um comando com a senha. O app ficou no ar, sem nenhum usuário e sem forma prática de entrar.

Abrir um `register` comum não serve: com o app em URL pública, qualquer pessoa criaria uma conta antes ou depois do proprietário.

## Decisão

- Existe uma tela de **primeiro acesso**, mostrada no lugar do login enquanto a tabela `user` está vazia **e** `FQ_SETUP_TOKEN` está configurada (16+ caracteres).
- Criar a conta exige o código de configuração (`FQ_SETUP_TOKEN`), comparado em tempo constante, e `Origin` igual a `BETTER_AUTH_URL`.
- A criação é serializada por `pg_advisory_lock`: duas requisições simultâneas resultam em um proprietário e um `409 OWNER_EXISTS`.
- Depois do primeiro usuário, `GET /api/setup` devolve `open: false` e `POST /api/setup` devolve `409`. A tela deixa de existir sem nenhuma ação adicional.
- A rota pública `/api/auth/*` continua com `disableSignUp: true`. O cadastro só é feito por uma segunda instância do Better Auth (`ownerSetupAuth`) usada exclusivamente por `src/server/setup.ts`.
- `POST /api/setup` tem limite de 10 tentativas por minuto, para o código de configuração não ser adivinhado por força bruta.
- Sem `FQ_SETUP_TOKEN`, nada muda: continua valendo `owner:create` / `owner:create:railway`.

## Alternativas consideradas

- **Rota `register` aberta.** Rejeitada: numa URL pública, qualquer pessoa cria conta e o produto deixa de ser de proprietário único.
- **Manter só o comando no servidor.** Rejeitada: foi o que falhou na prática; depende de SSH interativo e de digitar senha num shell remoto.
- **Criar a conta por uma variável de ambiente no deploy (`OWNER_EMAIL`/`OWNER_PASSWORD`).** Rejeitada: deixaria a senha em texto no painel do Railway e no ambiente do processo.

## Consequências

- Quem conhece `FQ_SETUP_TOKEN` e chega antes do proprietário pode criar a conta. Por isso o código é aleatório, longo e fica só no Railway, e a janela de risco termina na primeira criação. **Depois de criar a conta, a variável deve ser removida.**
- O `owner:create:railway` continua existindo e usa a mesma regra de proprietário único.
- Contrato novo em `docs/API.md`: `GET /api/setup` e `POST /api/setup`, fora do portão de autenticação do restante da API.

---
id: TASK-011
title: Cadastro de chaves de API pela interface
status: completed
type: feature
owner: proprietário
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules:
  [
    src/server/credentials.ts,
    src/server/providers.ts,
    src/server/api.ts,
    src/worker.ts,
    src/client/Settings.tsx,
    migrations,
  ]
related_use_cases: [Configurar integrações]
related_adrs: [ADR-004]
---

# TASK-011 — Cadastro de chaves de API pela interface

## Contexto

Pedido do proprietário: registrar as chaves de Gemini, OpenAI e YouTube direto na tela, em vez de editar `.env.local` e reiniciar web e worker.

## Problema

A tela Ajustes só relatava "configurado" ou "não configurado", sem caminho para configurar e sem distinguir qual dos três requisitos do provedor de texto (chave, preço revisado, `AI_ENABLED`) estava faltando.

## Objetivo

Cadastrar, substituir e remover chave pela interface, com a chave cifrada em repouso, sem reinício e sem que o segredo volte por nenhuma rota.

## Fora de escopo

- Ligar ou desligar `AI_ENABLED` pela interface.
- Escolher `AI_TEXT_PROVIDER` pela interface.
- Registrar revisão de preço pela interface.
- Validar a chave com uma chamada real ao provedor.
- Suporte a idioma de estudo diferente de inglês (levantamento entregue em separado; nada implementado).

## Comportamento atual

Chave lida de `process.env` em `providerConfig()` e em `youtube.get()`. Trocar exigia editar arquivo e reiniciar dois processos.

## Comportamento esperado

Chave cadastrada em Ajustes tem precedência sobre a variável de ambiente; sem cadastro, o ambiente continua valendo. A tela mostra origem, quatro últimos caracteres e o que ainda falta para o provedor ficar pronto.

## Regras de negócio

- RN-01: a chave nunca é devolvida por nenhuma rota; só `hint` (quatro últimos caracteres).
- RN-02: a chave é cifrada (AES-256-GCM, chave derivada de `BETTER_AUTH_SECRET`) antes de tocar o banco, porque o backup despeja o banco.
- RN-03: salvar não dispara chamada ao provedor — seria inferência sem reserva prévia.
- RN-04: chave presente não é integração pronta; preço revisado e `AI_ENABLED` continuam no ambiente.
- RN-05: `BETTER_AUTH_SECRET` trocado degrada a chave para "ausente", não para erro.

## Critérios de aceitação

- [x] CA-01: `PUT /api/integrations/:provider` guarda a chave cifrada e devolve o estado sem o segredo.
- [x] CA-02: `DELETE /api/integrations/:provider` remove o cadastro e devolve o fallback de ambiente.
- [x] CA-03: a chave cadastrada vale para servidor e worker sem reinício.
- [x] CA-04: a tela nomeia o requisito que falta em cada provedor.
- [x] CA-05: nenhuma violação axe em `configuracoes`, claro e escuro/mobile.

## Impacto técnico

### Backend

`src/server/credentials.ts` novo (cifra, cache de processo, precedência sobre ambiente); `providerConfig()` e `youtube.get()` passam a ler `credential()`; `integrationStatus()` ganha `enabled`, `keys` e `detail`; três rotas novas em `src/server/api.ts`; `refreshCredentials()` no início de `handle()`.

### Frontend

Seção "Integrações" de `src/client/Settings.tsx` reescrita com formulário por provedor; tipos em `src/client/types.ts`; CSS de `.integration-head`, `.integration-pending`, `.key-form` e `.key-actions`.

### Banco de dados

Migração `007_integration_credentials.sql`.

### Integrações

Nenhuma chamada de provedor nova. Nenhum modelo, preço ou teto alterado.

### Segurança

Chave cifrada em repouso; fora da exportação de dados (allowlist de tabelas); removida junto com a conta por `ON DELETE CASCADE`.

## Estratégia de testes

- [x] Unitários — `tests/credentials.test.ts`: ida e volta da cifra, ausência do valor em claro, precedência sobre ambiente, segredo trocado, troca de usuário, validação de formato.
- [x] Integração — cenário "Chave cadastrada pela interface fica cifrada e não volta pela API".
- [ ] E2E — não há suíte E2E no projeto.
- [x] Manual — cadastro, exibição da origem e remoção verificados na tela, com retorno ao fallback de ambiente.

## Riscos e rollback

- Trocar `BETTER_AUTH_SECRET` invalida as chaves guardadas; o proprietário recadastra.
- O cache de chaves é global por processo, correto sob a premissa de proprietário único (ADR-004).
- Rollback: `DROP TABLE integration_credentials` e reverter os arquivos; o ambiente volta a ser a única fonte.

## Registro de execução

### Alterações realizadas

Migração 007; `src/server/credentials.ts`; leitura de chave em `providers.ts`; rotas em `api.ts`; recarga por job no worker; tela de Ajustes; tipos; CSS; `docs/API.md`; `docs/INTEGRACOES.md`; ADR-004.

### Decisões

ADR-004.

### Divergências

Nenhuma.

### Pendências

`AI_ENABLED`, `AI_TEXT_PROVIDER` e revisão de preço continuam só no ambiente, por decisão registrada em ADR-004.

## Validação

`npm run typecheck` sem erros. `npm test`: 62 testes. `npm run test:integration`: 31 cenários, nenhuma chamada de IA. `npm run build`: 4 rotas. `scripts/accessibility-qa.mjs` (porta ajustada para a pré-visualização em 3216, porque 3215 estava ocupada pelo servidor do proprietário): zero violações em nove variantes, incluindo `configuracoes` e `configuracoes-dark-mobile`.

## Handoff

Não aplicável — concluída na mesma sessão.

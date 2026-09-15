# API

> **Fonte primária: [`../API.md`](../API.md).** Aquele documento já lista todas as rotas com seus contratos e é o dono do assunto. Esta pasta **não** duplica a tabela de endpoints — ela guarda o que sustenta a leitura daquele contrato e, quando necessário, o detalhamento de um endpoint específico.

## Como a API está montada

A API local é servida pelo mesmo processo Next.js que renderiza as telas, através de três rotas dinâmicas: `/[[...screen]]` (interface), `/api/[...path]` (domínio, despachado por `src/server/api.ts`, 1339 linhas) e `/api/auth/[...all]` (Better Auth).

## Regras transversais a todo endpoint

1. **Sessão em cookie HttpOnly**, emitida pelo Better Auth. `GET /api/bootstrap` responde 401 sem sessão — é o estado normal da tela de login.
2. **Toda consulta de domínio verifica o proprietário.** Não existe rota que devolva dado de outro usuário; o isolamento é verificado em `scripts/integration.ts`.
3. **Mutação exige `Origin` igual a `BETTER_AUTH_URL`.** Origem diferente recebe **403 antes de qualquer validação de credencial** — inclusive no login. É a causa do erro `Invalid origin` ao abrir por `127.0.0.1` com a base em `localhost`.
4. **Erros seguem `{code, message, retryable, requestId}`**, produzidos a partir de `AppError` (`src/domain/content.ts`).
5. **Idempotência por chave** em operações de importação, via `src/server/idempotency.ts`; repetição concorrente devolve a resposta memorizada em vez de duplicar trabalho.
6. **Concorrência otimista** nas revisões: o cliente envia a `version` do cartão e recebe conflito se estiver obsoleta.
7. **Dado externo e resposta de IA são renderizados como texto**, nunca como HTML executável.
8. **SSE com estado recuperável**: `GET /api/jobs/:id/events` persiste os IDs e honra `Last-Event-ID` — reconectar não recomeça o trabalho.

## Quando documentar um endpoint aqui

Crie `docs/api/<endpoint>.md` (com frontmatter de estado) somente quando o contrato de `../API.md` não for suficiente — por exemplo, quando um endpoint ganhar um fluxo de erro não óbvio, um formato de streaming próprio ou uma regra de compatibilidade que precise de histórico. Mudança que quebre compatibilidade exige ADR em `.agents/decisions/`.

---
name: global
description: Regras globais do FluentQuest, válidas para qualquer subagente ou alteração no repositório.
---

## Propósito

Manter consistência arquitetural entre domínio, servidor, worker e interface, independente de qual agente ou ferramenta executa a mudança. O projeto é de proprietário único e guarda histórico de estudo real: previsibilidade importa mais que velocidade.

## Escopo

Todo o repositório — `src/client/`, `src/domain/`, `src/server/`, `src/worker.ts`, `migrations/`, `scripts/`, `tests/` e `docs/`.

## Práticas exigidas

- `src/domain/` é puro: só recebe e devolve dados, sem `pg`, sem Next, sem `src/server/`. É o que permite testá-lo sem banco.
- Acesso a banco pelo `pool`, `query` e `transaction` de `src/server/db.ts`; escrita multi-tabela sempre dentro de `transaction`.
- Schema muda apenas por migração nova em `migrations/`, no padrão `NNN_descricao.sql`, com `src/server/schema.ts` atualizado junto.
- Validação de entrada com schemas Zod já definidos em `src/domain/content.ts`; erros de negócio usam `AppError`.
- Toda função de IA indisponível responde "integração não configurada" — nunca um resultado plausível gerado localmente.
- Contratos públicos (rotas de `src/server/api.ts`, schemas) não mudam silenciosamente: atualize `docs/API.md` e registre em `.agents/decisions/`.
- Texto de interface em pt-BR; conteúdo de estudo em inglês.

## Práticas proibidas

- Duplicar regra de negócio entre `src/domain/` e `src/server/`.
- Editar migração já registrada em `fq_migrations`.
- Servir `data/objects/` como pasta pública ou expor arquivo do proprietário sem autenticação.
- Scraping, download de mídia do YouTube ou fetch de URL arbitrária no servidor.
- Chamar provedor de IA sem reserva de orçamento prévia.
- Introduzir dependência nova sem que o projeto já a use em algum lugar.

## Documentos necessários antes de alterar código

- `.agents/context/CONTEXT.md`
- `.agents/test-onboarding.md` (seção Constituição)
- Subagente relevante: `.claude/agents/<papel>.md`
- Task ativa em `.agents/tasks/active/`, se houver

## Comandos de validação

```bash
npm run typecheck
npm test
```

```bash
npm run test:integration
```

Ressalvas: não existe `npm run lint` neste projeto (Prettier está instalado, sem script). `npm test` cobre apenas `src/domain/`; mudanças em servidor ou worker exigem `npm run test:integration`, que precisa de `.env.setup` e PostgreSQL disponível. Mudanças de tela exigem `node scripts/accessibility-qa.mjs`.

## Condições de atualização

Revisar quando um padrão arquitetural novo for adotado ou quando um ADR em `.agents/decisions/` mudar uma regra listada aqui.

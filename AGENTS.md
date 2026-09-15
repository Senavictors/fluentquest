# Guia de Agentes — FluentQuest

Arquivo versionado neste projeto (decisão do bootstrap: tudo vai para o Git, exceto segredos e dados do proprietário).

## Projeto

Aplicativo pessoal de inglês para desenvolvedores — conteúdo, produção, fala e revisão espaçada. Local-first, proprietário único, servido apenas em loopback (`127.0.0.1:3215`). Next.js 16 (App Router, Turbopack) + React 19 com telas em `src/client/`, lógica de domínio em `src/domain/`, servidor e persistência em `src/server/` sobre PostgreSQL 18 + Drizzle, fila `pg-boss` no worker `src/worker.ts`, autenticação Better Auth e agendamento FSRS via `ts-fsrs`. Integrações de IA (Gemini) estão implementadas mas **desligadas** por padrão.

## Fontes de verdade

- Contexto vivo: `.agents/context/CONTEXT.md`
- Estado de trabalho: `.agents/tasks/` e `.agents/handoffs/`
- Decisões arquiteturais: `.agents/decisions/` (índice em `.agents/decisions/README.md`)
- Constituição e teste de sanidade: `.agents/test-onboarding.md`
- Documentação do produto e da arquitetura: `docs/` (mapa em `docs/README.md`)

## Leitura obrigatória antes de alterar código

1. Leia `.agents/context/CONTEXT.md`.
2. Identifique se há task ativa em `.agents/tasks/active/`.
3. Leia o papel especializado relevante em `.claude/agents/` (lista abaixo).
4. Releia a seção "Constituição" de `.agents/test-onboarding.md` — nenhuma mudança deve contradizê-la silenciosamente.
5. Se a mudança toca IA, leia `docs/INTEGRACOES.md` antes: o piloto pago descrito lá ainda não foi executado.

## Auditoria local

Antes de um commit ou handoff, rode a skill `bootstrap-audit`. Para que o guardrail anti-vazamento valha também em commits manuais, rode `bootstrap-install-hook` uma vez nesta máquina — opcional, não ativado por padrão.

## Ciclo de vida de uma task

`bootstrap-plan` (ingestão → 3 opções → ADR → task em `backlog/`) → mover para `active/` ao começar → `bootstrap-handoff` para pausar → `bootstrap-complete` verifica o DoD e move para `completed/`.

## Mapa do repositório

- `src/client/` — telas do produto (`App.tsx`, `Study.tsx`, `Practice.tsx`, `Settings.tsx`) e cliente HTTP.
- `src/domain/` — regras puras: `content.ts` (fontes, trechos, proveniência) e `review.ts` (FSRS, XP).
- `src/server/` — `api.ts`, `auth.ts`, `db.ts`, `schema.ts`, `budget.ts`, `providers.ts`, `queue.ts`, `storage.ts`, `media.ts`, `idempotency.ts`, `example.ts`.
- `src/worker.ts` — fila pg-boss, preparo de fontes e manutenção periódica.
- `migrations/` — SQL versionado, aplicado transacionalmente.
- `scripts/` — setup, migrate, owner, backup, restore, integration, browser-qa, accessibility-qa.
- `tests/` — testes unitários de domínio (Vitest).
- `data/objects/` — arquivos privados do proprietário; nunca servidos como pasta pública.
- `docs/` — documentação do produto e da arquitetura.

## Papéis especializados (agentes)

- `.claude/agents/dominio-revisao.md` — FSRS, XP e idempotência de recompensa.
- `.claude/agents/fontes-proveniencia.md` — ingestão de fontes, validação de URL e honestidade de proveniência.
- `.claude/agents/dados-persistencia.md` — PostgreSQL, Drizzle, migrações e armazenamento privado. **Poder de veto** sobre operações destrutivas.
- `.claude/agents/ia-orcamento.md` — adaptadores Gemini e controle de orçamento. **Poder de veto** sobre ativar IA.
- `.claude/agents/interface-editorial.md` — telas, identidade Broadsheet, temas, mobile e acessibilidade.

## Regras globais

- Nenhuma função de IA indisponível pode simular resultado — o estado correto é "integração não configurada".
- Não duplique regra de negócio entre `src/domain/` e `src/server/`; o domínio é puro e não conhece HTTP nem banco.
- Não altere contratos públicos (rotas de `src/server/api.ts`, schemas Zod) sem atualizar `docs/API.md`.
- Toda mudança de schema entra como migração nova em `migrations/`; nunca edite uma migração já aplicada.
- Não amplie o escopo de uma task sem registrar em `.agents/tasks/`.
- Registre decisões arquiteturais relevantes em `.agents/decisions/`.

## Comandos reais

```bash
npm run dev              # web (127.0.0.1:3215) + worker, via concurrently
npm run build            # next build
npm run typecheck        # tsc --noEmit
npm test                 # Vitest — APENAS 11 testes de domínio, não cobre o servidor
npm run test:integration # 23 cenários com banco temporário; exige .env.setup e PostgreSQL
npm run db:migrate       # aplica migrations/ transacionalmente
node scripts/browser-qa.mjs         # QA de navegador (sem script npm)
node scripts/accessibility-qa.mjs   # axe nas telas (sem script npm)
```

**Ressalvas:** não existe script de lint (Prettier está instalado, mas sem `npm run lint`). `npm test` cobre só `src/domain/`; a cobertura real de servidor, worker e fluxo completo está em `npm run test:integration`.

## Critérios de conclusão

- Critérios de aceitação da task verificados.
- `npm run typecheck` e o escopo de teste correspondente executados; para mudanças de servidor/worker, `npm run test:integration`.
- Riscos e pendências declarados.
- Handoff preenchido em `.agents/handoffs/` quando houver continuação em outra sessão/ferramenta.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---
id: TASK-006
title: Abstração multi-provedor de inferência e preço
status: backlog
type: refactor
owner: ia-orcamento
created_at: 2026-09-14
updated_at: 2026-09-14
affected_modules: [src/server/providers.ts, src/server/budget.ts, .env.example, docs/INTEGRACOES.md]
related_use_cases: [tutor contextual, geração de atividade, transcrição]
related_adrs: [ADR-001]
---

# TASK-006 — Abstração multi-provedor de inferência e preço

## Contexto

Primeira task da Fase C do ADR-001. Refatoração preparatória: nenhum provedor novo é adicionado aqui. O objetivo é que adicionar um provedor depois seja seguro, e não uma gambiarra sobre variáveis com nome de Gemini.

## Problema

Preço, modelo e credencial estão colados ao Gemini. `infer()` lê `GEMINI_INPUT_USD_PER_MILLION` e `GEMINI_OUTPUT_USD_PER_MILLION` diretamente (`src/server/providers.ts:139`), `integrationStatus()` só conhece um provedor, e `requireAI()` valida uma única data de revisão de preço. Chamar um segundo provedor nesse desenho faria `usage_events` registrar o modelo certo com o preço errado — a conciliação de custo passaria a mentir silenciosamente, que é a pior falha possível neste subsistema.

## Objetivo

`infer()` e o orçamento operando sobre uma descrição de provedor (nome, modelo, credencial, preços, data de revisão), com o Gemini sendo apenas a primeira instância dela. Comportamento externo idêntico ao de hoje.

## Fora de escopo

- Adicionar a OpenAI (TASK-007).
- Mudar contratos de API ou schema.
- Mudar a política de orçamento: reserva antes da inferência, duas reservas ativas, disjuntor — tudo permanece.

## Comportamento atual

Um provedor, hard-coded, com variáveis de ambiente prefixadas `GEMINI_`.

## Comportamento esperado

Registro de provedores em que cada entrada carrega suas próprias credenciais, preços e data de revisão; `usage_events.price_version` passa a identificar qual provedor e qual revisão geraram aquele custo.

## Regras de negócio

- RN-01: Refatoração sem mudança de comportamento observável. Se algo mudar para o usuário, virou feature e sai do escopo desta task.
- RN-02: As variáveis `GEMINI_*` continuam funcionando ou têm caminho de migração documentado — `.env.local` do proprietário não pode quebrar em silêncio.
- RN-03: Preço ausente ou revisão vencida continua bloqueando a chamada, **por provedor**.
- RN-04: Nenhuma dependência nova nesta task.

## Critérios de aceitação

- [ ] CA-01: `infer()` não lê nenhuma variável com prefixo de provedor específico.
- [ ] CA-02: Um provedor com revisão de preço vencida é bloqueado sem afetar outro provedor válido.
- [ ] CA-03: `usage_events` permite atribuir cada linha ao provedor e à revisão de preço que a geraram.
- [ ] CA-04: `npm run typecheck` limpo, `npm test` 11/11, `npm run test:integration` 23/23 — os mesmos números de antes.
- [ ] CA-05: `.env.example` e `docs/INTEGRACOES.md` refletem o formato novo.

## Impacto técnico

### Backend
`src/server/providers.ts` é o alvo principal; `src/server/budget.ts` recebe o preço como parâmetro em vez de lê-lo do ambiente.

### Frontend
`integrations` em `GET /api/bootstrap` pode passar a listar mais de um provedor — se mudar de forma, `docs/API.md` e `src/client/Settings.tsx` acompanham.

### Banco de dados
Preferir usar `price_version` e `model`, que já existem em `usage_events`, antes de propor coluna nova. Se uma migração for mesmo necessária, ela é `004_*.sql`.

### Integrações
Nenhuma chamada nova.

### Segurança
Cada provedor tem credencial própria em `.env.local`.

## Plano de implementação

- [ ] Etapa 1: Mapear todos os pontos que leem `GEMINI_*`.
- [ ] Etapa 2: Desenhar a descrição de provedor e o registro.
- [ ] Etapa 3: Refatorar `infer()` e a reserva de orçamento.
- [ ] Etapa 4: Confirmar paridade de comportamento rodando a suíte completa.
- [ ] Etapa 5: Atualizar `.env.example` e a documentação.

## Estratégia de testes

- [ ] Unitários: cálculo de custo por provedor, com preços distintos.
- [ ] Integração: `npm run test:integration` precisa fechar nos mesmos 23 cenários.
- [ ] E2E: não se aplica.
- [ ] Manual: uma chamada real ao Gemini antes e depois, comparando a linha gravada em `usage_events`.

## Riscos e rollback

Refatoração no caminho que gasta dinheiro. Risco de erro de preço silencioso. Mitigação: CA-04 exige paridade exata de testes, e a etapa manual compara a linha de `usage_events` antes e depois. Rollback é reverter o commit — nada de schema muda se a etapa de banco for evitada.

## Registro de execução

### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação

Comandos e resultados.

## Handoff

Link para o handoff ativo, quando aplicável.

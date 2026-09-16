---
id: TASK-001
title: Configurar Gemini e executar o piloto de ativação
status: active
type: integration
owner: ia-orcamento
created_at: 2026-09-14
updated_at: 2026-09-15
affected_modules: [src/server/providers.ts, src/server/budget.ts, docs/INTEGRACOES.md, docs/VALIDACAO.md]
related_use_cases: [tutor contextual, geração de atividade, feedback de fala]
related_adrs: [ADR-001]
---

# TASK-001 — Configurar Gemini e executar o piloto de ativação

## Contexto

Fase A do ADR-001. A camada de IA está escrita e passa por tipos e contratos, mas nunca fez uma chamada. Esta é a primeira task do projeto que produz custo e tráfego externo reais.

## Problema

Com `AI_ENABLED=false` e sem `GEMINI_API_KEY`, `integrationStatus()` retorna `ai: false` e `requireAI()` lança 503 em toda função de IA. Tutor, tradução, geração de atividade e feedback de fala estão indisponíveis. Não se sabe se `gemini-3.5-flash-lite` existe na conta, qual a latência, qual o custo por atividade, nem se a qualidade pedagógica serve.

## Objetivo

Camada de IA ligada, exercitada de ponta a ponta com material do próprio proprietário, com as evidências dos passos 1 a 6 de `docs/INTEGRACOES.md` registradas em `docs/VALIDACAO.md`.

## Fora de escopo

- Transcrição de vídeo do YouTube por URL (TASK-004).
- Qualquer provedor que não o Gemini (TASK-006, TASK-007).
- Corpus autorizado de 12–20 trechos e revisão dos 100 itens — passo 7 do piloto, posterior a esta task.

## Comportamento atual

`GET /api/bootstrap` devolve `integrations.ai = false`; a tela de Ajustes mostra "Não configurado" em `src/client/Settings.tsx:344`. Fontes de texto entram e são estudáveis, mas nenhum job de preparo sai de `awaiting_configuration`.

## Comportamento esperado

`integrations.ai = true`; tutor responde por SSE; `POST /api/sources/:id/prepare` gera uma atividade com `provenance = 'gemini_unreviewed'`; `POST /api/recordings/:id/assess` devolve transcrição e feedback; `GET /api/usage` mostra consumo estimado real em `usage_events`.

## Regras de negócio

- RN-01: A chave vai **apenas** para `.env.local`, que não é versionado. Nenhuma credencial entra no repositório, em documento ou em conversa de agente.
- RN-02: `monthly_limit_cents` do proprietário passa a **1000** (US$ 10) e `alert_cents` a um valor abaixo disso, conforme ADR-001.
- RN-03: Os preços em `GEMINI_INPUT_USD_PER_MILLION` e `GEMINI_OUTPUT_USD_PER_MILLION` são copiados da tabela oficial do provedor no dia da configuração, e `AI_PRICES_REVIEWED_ON` recebe essa data. Valor inventado ou herdado do `.env.example` invalida a task.
- RN-04: Tier gratuito — o passo 5 do piloto (comparar com a fatura) **não pode ser concluído** e deve ser registrado como pendente, não como aprovado.
- RN-05: Nenhuma gravação de voz é enviada antes de o risco de privacidade do tier gratuito estar visível ao proprietário.

## Critérios de aceitação

- [x] CA-01: `.env.local` contém `AI_ENABLED=true`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PRICES_REVIEWED_ON` e os dois preços; nenhum deles aparece em arquivo versionado.
- [ ] CA-02: Tela de Ajustes mostra Gemini como "Configurado".
- [ ] CA-03: Uma atividade foi gerada a partir de um texto curto do proprietário, e os `segmentIds` citados existem na fonte (passo 3 do piloto).
- [ ] CA-04: Uma gravação própria curta foi transcrita e avaliada; transcrição e feedback foram comparados a uma avaliação humana e a divergência ficou registrada (passo 4).
- [x] CA-05: `GET /api/usage` mostra `confirmed > 0` e a reserva correspondente saiu de `active`.
- [ ] CA-06: Timeout, 429 e saída truncada foram exercitados e o comportamento observado ficou registrado (passo 6).
- [ ] CA-07: `docs/VALIDACAO.md` existe, cobre os passos 1 a 6 com resultado real, marca o passo 5 como não concluído por ausência de fatura, e o link do `README.md:82` deixa de estar quebrado.
- [x] CA-08: `docs/INTEGRACOES.md` atualizado com o custo e a latência medidos, substituindo a afirmação de que nenhuma chamada paga foi realizada.

## Impacto técnico

### Backend
Nenhuma alteração de código prevista. Se o piloto revelar incompatibilidade entre o uso de `ai.interactions.create` em `src/server/providers.ts:200` e o SDK real, a correção entra nesta task e vira divergência registrada.

### Frontend
Nenhuma, além do estado já existente em `src/client/Settings.tsx`.

### Banco de dados
Nenhuma migração e nenhum SQL manual. O teto é alterado pela própria tela de Ajustes, que envia `monthlyLimitCents` em `PATCH /api/profile` (`src/server/api.ts:282`). O padrão em `migrations/001_initial.sql` é 4000 (US$ 40); passa a 1000.

### Integrações
Primeira chamada real ao Gemini. Configurar também limites no console do provedor, conforme passo 1 do piloto.

### Segurança
Tier gratuito implica uso do conteúdo pelo provedor. Risco aceito em ADR-001; validar que a interface comunica isso antes do envio de gravação.

## Plano de implementação

- [ ] Etapa 1: Criar a chave Gemini no console e aplicar limites no lado do provedor.
- [ ] Etapa 2: Consultar a tabela oficial de preços e anotar os valores com a data.
- [ ] Etapa 3: Preencher `.env.local` e reiniciar web e worker.
- [ ] Etapa 4: Baixar o teto para US$ 10 e o alerta para um valor abaixo disso, pela tela de Ajustes.
- [ ] Etapa 5: Executar os passos 2 a 4 do piloto com material próprio.
- [ ] Etapa 6: Executar o passo 6 com fixtures anonimizadas.
- [ ] Etapa 7: Escrever `docs/VALIDACAO.md` e atualizar `docs/INTEGRACOES.md`.

## Estratégia de testes

- [ ] Unitários: `npm test` continua 11/11 (nenhuma regra de domínio muda).
- [ ] Integração: `npm run test:integration` — atenção ao cenário "IA desligada sem resposta simulada", que precisa continuar válido para o caso desligado.
- [ ] E2E: não se aplica.
- [ ] Manual: o piloto de `docs/INTEGRACOES.md` é o teste manual desta task.

## Riscos e rollback

Rollback é `AI_ENABLED=false` e reinício — volta ao estado atual sem perda. Risco principal: uma chamada cobrada que não concilia; nesse caso a reserva fica em `unknown` e três ocorrências em dez minutos abrem o disjuntor, o que é comportamento correto, não bug.

## Registro de execução

### Alterações realizadas

2026-09-15 — Preços implícitos removidos; datas inválidas, futuras ou vencidas bloqueadas; estado de integração considera preços; SDK sem retries; HTTP 408 mantém reserva. Consentimento de envio de gravações implementado em Practice.tsx. tests/providers.test.ts cobre IA desligada, preços, datas, ordem de reserva, timeout, 429, truncamento e uso ausente. docs/INTEGRACOES.md e docs/API.md atualizados.

### Arquivos principais
### Decisões
### Divergências

Escopo registrado nesta revisão: correções necessárias à execução segura do fluxo local identificado pela inspeção. QA isolado e documentação transversal registrados separadamente em TASK-008. Fixtures não equivalem ao piloto real.

### Pendências

Credencial Gemini ausente, IA desligada. Preços oficiais, material próprio, limites do provedor, piloto real, custos/latência e comparação humana pendentes. Teto do proprietário não alterado. Fase B não liberada.


## Validação

Validação de 15/09/2026: npm run typecheck passou; npm test 30/30; npm run test:integration 27/27; npm run build passou. QA Edge desktop/mobile e axe: zero erros/transbordamentos e zero violações em nove telas e quatro variantes do formulário. Execução em banco temporário, sem chamadas reais de IA/YouTube. Evidências e limites em [docs/VALIDACAO.md](../../../docs/VALIDACAO.md).

## Handoff

[Continuidade da Fase A](../../handoffs/FASE-A-2026-09-15.md)

## Atualização após configuração — 2026-09-15

Piloto real de texto autorizado e executado. Gemini aceito; preços oficiais registrados localmente, IA ativada, teto US$ 1 e alerta US$ 0,80 pela API. Geração em 1993 ms e tutor em 14284 ms; três IDs de evidência válidos; duas reservas settled, US$ 0,001288 estimados e zero reservado. AI Studio: nível gratuito sem faturamento. CA-01/CA-05 verificados; CA-03 exercitado com exemplo autoral do aplicativo autorizado pelo proprietário, não com texto pessoal. Ajustes no navegador, voz e avaliação humana continuam pendentes. CA-06 tem fixtures locais já executadas. CA-08 documentado com custos estimados/latências reais.

Resultados detalhados em [VALIDACAO.md](../../../docs/VALIDACAO.md), seção Piloto real de texto. Registros anteriores permanecem como histórico.

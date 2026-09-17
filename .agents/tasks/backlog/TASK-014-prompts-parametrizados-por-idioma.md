---
id: TASK-014
title: Prompts parametrizados por idioma de estudo e de explicação
status: backlog
type: feature
owner:
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules: [src/server/providers.ts, src/server/api.ts, src/worker.ts]
related_use_cases: [Tutor contextual, Apoio de trecho, Transcrição de vídeo]
related_adrs: [ADR-006]
---

# TASK-014 — Prompts parametrizados por idioma de estudo e de explicação

## Contexto

Segunda das três tasks de ADR-006. Depende de TASK-013, que abre o contrato. **Tem veto de `ia-orcamento`**: mexe em prompt, em versão de prompt e no cache, e portanto no custo.

## Problema

Os três prompts nomeiam os idiomas no próprio texto:

- `SYSTEM` (`providers.ts:248`) — "concise English practice tutor for a Brazilian developer. Explain in Portuguese".
- Apoio de trecho (`providers.ts:702`) — "in natural Brazilian Portuguese" e "one NEW English sentence".
- Transcrição de vídeo (`providers.ts:779`) — "Transcribe the spoken English faithfully".

Uma fonte em espanhol, aceita pelo contrato depois da TASK-013, seria transcrita por um prompt que pede inglês.

## Objetivo

Os três prompts recebem o idioma de estudo (da fonte) e a língua de explicação (do perfil) por parâmetro, com a versão de prompt subindo junto.

## Fora de escopo

- Escolher modelo diferente por idioma, elevar teto, alerta ou limite de reservas.
- Qualquer chamada real a provedor para validar qualidade — isso é piloto autorizado, não implementação.
- Telas (TASK-015).

## Comportamento atual

Idiomas embutidos no texto do prompt. O `result_cache` chaveia por conteúdo, provedor, modelo, schema e versão de prompt — sem nenhuma noção de idioma.

## Comportamento esperado

Cada chamada carrega os dois idiomas. A versão de prompt sobe, então respostas em cache sob o prompt antigo deixam de ser reaproveitadas — correto, porque não foram geradas sob o mesmo prompt.

## Regras de negócio

- RN-01: o idioma entra no prompt sempre a partir da lista fechada de TASK-013, nunca como texto livre vindo do usuário.
- RN-02: a versão de prompt sobe nos três. Prompt parametrizado não é o mesmo prompt, e o cache precisa enxergar isso.
- RN-03: reserva continua antecedendo a inferência; nada aqui altera o ciclo de orçamento.
- RN-04: função indisponível continua respondendo "integração não configurada" — nenhum idioma novo pode produzir resultado simulado localmente.
- RN-05: `videoTranscript.language` volta do provedor e agora tem com o que ser comparado. Divergência entre declarado e detectado é **registrada**, não tratada como erro fatal — o proprietário pode ter declarado errado, e descartar uma transcrição já paga por isso repetiria o defeito corrigido na TASK-004.

## Critérios de aceitação

- [ ] CA-01: fonte em idioma diferente de inglês produz prompt de transcrição que nomeia aquele idioma (verificável por mock, sem chamada real).
- [ ] CA-02: apoio de trecho pede tradução na língua de explicação do perfil e exemplo novo no idioma de estudo.
- [ ] CA-03: a versão de prompt mudou nos três, e a chave de `result_cache` acompanha.
- [ ] CA-04: com IA desligada, a resposta continua sendo "integração não configurada" em qualquer idioma.
- [ ] CA-05: divergência entre idioma declarado e detectado fica registrada, sem descartar a transcrição.

## Impacto técnico

### Backend

`src/server/providers.ts`: `SYSTEM`, prompt de apoio e prompt de transcrição passam a receber os idiomas; versão de prompt e chave de cache. `src/server/api.ts` e `src/worker.ts`: passar o idioma da fonte e a língua de explicação do perfil nas chamadas.

### Frontend

Nenhum.

### Banco de dados

Possivelmente uma coluna para registrar o idioma detectado quando divergir do declarado. Se entrar, é migração nova; avaliar com `dados-persistencia` se o registro no evento do job já basta.

### Integrações

Nenhum provedor, modelo ou preço novo. Nenhuma chamada real nesta task.

### Segurança

Idioma vem da lista fechada; conteúdo da fonte continua tratado como dado não confiável, nunca como instrução.

## Plano de implementação

- [ ] Etapa 1 — assinar os três prompts com os dois idiomas.
- [ ] Etapa 2 — subir a versão de prompt e conferir a chave de `result_cache`.
- [ ] Etapa 3 — propagar idioma da fonte e do perfil em `api.ts` e `worker.ts`.
- [ ] Etapa 4 — registrar divergência entre idioma declarado e detectado.

## Estratégia de testes

- [ ] Unitários — `tests/providers.test.ts`, com mocks: prompt contém o idioma certo; cache não reaproveita entre versões de prompt.
- [ ] Integração — `scripts/integration.ts`: fonte em idioma novo com IA desligada continua respondendo "integração não configurada".
- [ ] E2E — não há suíte.
- [ ] Manual — nenhuma chamada real sem autorização explícita do proprietário.

## Riscos e rollback

- Risco: subir a versão de prompt invalida o cache e a próxima chamada de cada escopo custa de novo. Impacto em centavos no teto atual de US$ 1, mas é gasto real e precisa ser dito.
- Risco: qualidade por idioma continua sem evidência humana — vale para inglês hoje e valerá para os novos.
- Rollback: reverter os prompts e a versão; nenhum dado de estudo é afetado.

## Registro de execução

### Alterações realizadas

### Arquivos principais

### Decisões

### Divergências

### Pendências

## Validação

## Handoff

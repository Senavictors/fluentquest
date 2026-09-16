---
id: TASK-008
title: Validação isolada e registro das lacunas de implementação
status: completed
type: maintenance
owner: interface-editorial
created_at: 2026-09-15
updated_at: 2026-09-15
affected_modules: [scripts/qa-isolated.ts, scripts/source-qa.mjs, scripts/browser-qa.mjs, scripts/accessibility-qa.mjs, docs/VALIDACAO.md]
related_use_cases: [validação local sem alterar estudo do proprietário]
related_adrs: [ADR-001]
---

# TASK-008 — Validação isolada e registro das lacunas

## Contexto e problema
Revisão solicitada pelo proprietário encontrou sete tasks existentes. Faltava um runner de navegador com banco descartável e um registro atual de implementação/validação. Os scripts existentes usavam diretamente o proprietário real.

## Objetivo e escopo
Executar QA real com dados fictícios, preservar o estudo do proprietário e registrar pendências por task. Implementação direta sobre scripts existentes, sem nova arquitetura ou dependência. Não inclui piloto externo, migrações reais ou ativação de IA.

## Critérios de aceitação
- [x] Runner recusa porta ocupada, cria banco temporário, inicia apenas seu servidor em loopback e encerra ambos ao final.
- [x] Fluxo de legenda salva e recarrega; consentimento/feedback indisponível verificado.
- [x] Desktop/mobile, claro/escuro e axe sem regressões nos fluxos alterados.
- [x] Relatório distingue implementação, fixtures e piloto real pendente.

## Registro de execução
### Alterações realizadas
scripts/qa-isolated.ts provisiona fixtures e executa os scripts existentes sem ler .env.owner; scripts/source-qa.mjs valida legenda e consentimento; scripts originais aceitam senha efêmera via ambiente. docs/VALIDACAO.md criado, docs herdadas receberam estado documental. Frase de acesso ao banco sincronizada nos papéis Claude/Codex sem mudar vetos. Nenhum estado de IA ou preço do proprietário foi alterado.
### Documentação
docs/VALIDACAO.md descreve comandos, resultados e limites. ADR-001 preservado. Não há contrato de produto ou schema novo nesta task.
### Validação
Validação de 15/09/2026: npm run typecheck passou; npm test 30/30; npm run test:integration 27/27; npm run build passou. QA Edge desktop/mobile e axe: zero erros/transbordamentos e zero violações em nove telas e quatro variantes do formulário. Execução em banco temporário, sem chamadas reais de IA/YouTube. Evidências e limites em [docs/VALIDACAO.md](../../../docs/VALIDACAO.md).
### Riscos e pendências
QA usa áudio sintético e uma referência fictícia na lista de gravações; não valida microfone físico ou provedor real. TASK-001/002 permanecem abertas. Nenhuma pendência deste escopo.

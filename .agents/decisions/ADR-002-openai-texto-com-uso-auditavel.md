---
id: ADR-002
title: OpenAI limitada a inferências textuais com uso auditável
status: accepted
date: 2026-09-15
deciders: [Victor Sena]
related_tasks: [TASK-006, TASK-007]
---

# ADR-002 — OpenAI limitada a inferências textuais com uso auditável

## Contexto

O projeto passou a usar `gpt-4o-mini` como provedor alternativo para tutor, geração de atividade e tradução. A Responses API retorna uso de entrada e saída nesses caminhos, permitindo reservar, conciliar e registrar custo por chamada.

O contrato de transcrição OpenAI avaliado nesta etapa não devolve a mesma medição de uso. Concluir uma transcrição ou avaliação de fala sem essa medição contrariaria a Constituição, que exige reserva anterior e conciliação do uso retornado.

## Decisão

OpenAI fica habilitada apenas para inferências textuais. Fala continua com transcrição no Gemini; o feedback textual posterior usa o provedor de texto selecionado. O aplicativo rejeita explicitamente áudio e vídeo quando OpenAI é escolhido, e não tenta download ou extração de áudio de links do YouTube.

`usage_events.price_version` passa a armazenar `provedor:AAAA-MM-DD`, e as reservas mantêm provedor e modelo. Assim uma atividade e um tutor do mesmo modelo podem ser conciliados à tabela de preço configurada sem confundir os provedores.

## Consequências

- O piloto OpenAI pode ser concluído para texto com custo auditável localmente.
- A avaliação de fala não é simulada nem passa a ser exibida como concluída.
- Uma futura ativação de transcrição OpenAI requer evidência de uso retornado, preços revisados, testes de falha e uma atualização desta decisão.

## Validação

O piloto de 15/09/2026 registrou uma atividade e uma resposta de tutor pelo `gpt-4o-mini`, com duas reservas `settled` e `price_version=openai:2026-09-15`. Evidência e custos estão em [docs/VALIDACAO.md](../../docs/VALIDACAO.md).

---
id: ADR-003
title: Conciliação manual de reserva ambígua, com estado próprio no livro-razão
status: accepted
date: 2026-09-17
---

# ADR-003 — Conciliação manual de reserva ambígua, com estado próprio no livro-razão

## Contexto

`failBudget(id, ambiguous)` move para `unknown` toda reserva cuja chamada falhou sem medição de uso — timeout, HTTP 5xx, erro nosso depois do envio. A Constituição sustenta esse comportamento: "timeout ambíguo mantém o valor reservado", porque a chamada pode ter sido cobrada e liberar por conta própria subestimaria o gasto.

O que faltava era a saída. Nenhum caminho do código tirava uma reserva de `unknown`, e `usage()` soma `state IN ('active','unknown')` contra o teto mensal. Na prática o estado era terminal e cumulativo: em 2026-09-17 havia 10 reservas somando US$ 0,5897 de um teto de US$ 1,00, enquanto o consumo real medido do mês era US$ 0,2190. O disponível tinha caído para US$ 0,22 por causa de chamadas que, numa conta em nível gratuito, nunca geraram fatura. O orçamento deixou de proteger e passou a travar.

## Decisão

Conciliação é um ato explícito do proprietário, registrado no próprio livro-razão.

- Novo estado `reconciled`, distinto de `released`. `released` é o provedor tendo recusado a chamada com erro definitivo de cliente; `reconciled` é o proprietário tendo verificado, contra o painel do provedor, que a chamada não gerou cobrança. Fundir os dois apagaria a diferença entre "não cobrou" e "conferimos que não cobrou".
- Migração 006 acrescenta `reconciled_at` e `reconciliation_note` a `budget_reservations`. Um livro-razão que muda de saldo sem dizer por quê não é livro-razão.
- `scripts/reconcile.ts` (`npm run budget:reconcile`) relata por padrão e só altera estado com `--liberar "motivo"`. Recusa conciliar reserva que tenha `usage_event` associado — isso apagaria custo real medido — e reserva com menos de 10 minutos, que pode estar em voo.
- Nada disso é automático. Não há expiração por tempo nem varredura periódica no worker: seria liberar valor ambíguo sem ninguém ter olhado, exatamente o que a Constituição proíbe.

## Alternativas consideradas

- **Expirar `unknown` automaticamente após N dias.** Resolveria o acúmulo sem trabalho manual, mas contradiz a Constituição: o valor deixaria de ser contabilizado sem que ninguém verificasse a fatura. Rejeitada.
- **Reaproveitar `released`.** Um comando a menos e nenhuma migração, ao custo de perder no banco a distinção entre recusa do provedor e conferência do proprietário — justamente o que uma auditoria futura precisaria. Rejeitada.
- **Conciliar pela interface, em Ajustes.** Mais visível, porém exige rota nova, contrato novo em `docs/API.md` e QA de acessibilidade, para uma operação que é rara e administrativa. Adiada, não descartada: se a conciliação virar rotina, este é o caminho.

## Consequências

- O teto volta a medir uso, não histórico de falha. Primeira execução conciliou 10 reservas e devolveu US$ 0,5897.
- Conciliar continua dependendo de alguém abrir o painel do provedor. Com faturamento ativado, o motivo registrado precisa citar a fatura conferida, não o nível gratuito.
- `reconciled` é um valor novo de `state` e não há CHECK na coluna; qualquer consulta futura que filtre estados precisa considerá-lo. Hoje só `usage()` e o próprio script filtram.
- A anotação é texto livre. É auditoria mínima: diz quem decidiu e com base em quê, sem prometer conferência automática contra fatura.

-- `unknown` era um estado terminal: `failBudget` colocava a reserva ambígua lá
-- e nada no código a tirava de volta. Em 2026-09-17 havia 10 reservas somando
-- 589.697 micros (US$ 0,59) de um teto de US$ 1,00 — consumo real do mês,
-- US$ 0,19 — bloqueando trabalho por cobranças que a conta, em nível gratuito,
-- nunca teve. A saída não pode ser liberar automaticamente: a Constituição diz
-- que reserva ambígua permanece contabilizada até conciliação, e conciliação é
-- um ato do proprietário contra o painel do provedor.
--
-- Estas colunas guardam esse ato. O estado `reconciled` fica distinto de
-- `released` de propósito: `released` é o provedor tendo recusado a chamada,
-- `reconciled` é o proprietário tendo verificado que ela não gerou cobrança.
ALTER TABLE budget_reservations
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_note text;

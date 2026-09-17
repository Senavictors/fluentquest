// Conciliação de reservas ambíguas.
//
// Uma chamada que falhou sem medição de uso deixa a reserva em `unknown`: pode
// ter sido cobrada, e a Constituição manda mantê-la contabilizada até que
// alguém verifique. Só que nada no código tirava a reserva desse estado, então
// ele acumulava e comia o teto mensal para sempre.
//
// Este script é a saída, e ela é deliberadamente manual: quem concilia é o
// proprietário, olhando o painel do provedor, porque o livro-razão local é
// estimativa e não fatura. Sem `--liberar`, só relata.
import { pool, query } from "../src/server/db";
import { budgetPeriod } from "../src/server/budget";
const dinheiro = (micros: number) => `US$ ${(micros / 1_000_000).toFixed(4)}`;
// No fuso de estudo, não em UTC: o proprietário identifica a chamada pelo
// horário que viu na tela.
const quando = (valor: string | Date) =>
  new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
const args = process.argv.slice(2);
const liberar = args.includes("--liberar");
const motivo = args[args.indexOf("--liberar") + 1];
try {
  const pendentes = await query(
    `SELECT r.id, r.created_at, r.purpose, r.amount_micros, r.provider, r.model,
            (SELECT count(*) FROM usage_events u WHERE u.reservation_id = r.id)::int AS usos,
            r.created_at < now() - interval '10 minutes' AS assentada
       FROM budget_reservations r
      WHERE r.state = 'unknown'
      ORDER BY r.created_at`,
  );
  if (!pendentes.length) {
    console.log("Nenhuma reserva ambígua pendente de conciliação.");
    process.exit(0);
  }
  const total = pendentes.reduce(
    (soma, r) => soma + Number(r.amount_micros),
    0,
  );
  console.log(
    `${pendentes.length} reserva(s) em 'unknown', somando ${dinheiro(total)}:\n`,
  );
  for (const r of pendentes)
    console.log(
      [
        quando(r.created_at),
        r.purpose,
        `${r.provider || "—"}/${r.model || "—"}`,
        dinheiro(Number(r.amount_micros)),
        // Uso registrado significa que a chamada foi medida e já entrou no
        // livro-razão: liberar a reserva aqui apagaria um custo real.
        r.usos ? "TEM USO REGISTRADO — não liberável" : "sem uso registrado",
        r.assentada ? "" : "recente demais, pode estar em voo",
      ]
        .filter(Boolean)
        .join(" | "),
    );
  const elegiveis = pendentes.filter((r) => !r.usos && r.assentada);
  const soma = elegiveis.reduce((s, r) => s + Number(r.amount_micros), 0);
  console.log(
    `\nElegíveis para conciliação: ${elegiveis.length} de ${pendentes.length}, ${dinheiro(soma)}.`,
  );
  if (!liberar) {
    console.log(
      "\nRelatório apenas. Confirme no painel do provedor que estas chamadas não geraram cobrança e rode:\n" +
        '  npm run budget:reconcile -- --liberar "motivo da conciliação"',
    );
    process.exit(0);
  }
  if (!motivo || motivo.startsWith("--") || motivo.trim().length < 10)
    throw new Error(
      'Informe o motivo da conciliação com pelo menos 10 caracteres: --liberar "conferido no AI Studio em AAAA-MM-DD, sem faturamento".',
    );
  if (!elegiveis.length) throw new Error("Nada elegível para conciliar.");
  const liberadas = await query(
    `UPDATE budget_reservations
        SET state = 'reconciled', reconciled_at = now(), reconciliation_note = $2
      WHERE state = 'unknown'
        AND id = ANY($1::uuid[])
      RETURNING id, amount_micros`,
    [elegiveis.map((r) => r.id), motivo.trim()],
  );
  const conciliado = liberadas.reduce((s, r) => s + Number(r.amount_micros), 0);
  const restante = await query(
    `SELECT coalesce(sum(amount_micros),0)::bigint AS micros
       FROM budget_reservations WHERE state IN ('active','unknown')`,
  );
  const usado = await query(
    "SELECT coalesce(sum(amount_micros),0)::bigint AS micros FROM usage_events WHERE period=$1",
    [budgetPeriod()],
  );
  console.log(
    `\n${liberadas.length} reserva(s) conciliada(s), ${dinheiro(conciliado)} devolvidos ao teto.` +
      `\nMotivo registrado: ${motivo.trim()}` +
      `\nUso real do período ${budgetPeriod()}: ${dinheiro(Number(usado[0].micros))}.` +
      `\nAinda reservado (active + unknown): ${dinheiro(Number(restante[0].micros))}.` +
      "\n\nRegistre esta conciliação em .agents/tasks/ ou .agents/decisions/ — o livro-razão local é estimativa, não fatura.",
  );
} finally {
  await pool.end();
}

import { transaction, query } from "./db";
import { AppError } from "../domain/content";
export function budgetPeriod(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);
}
export function tokenCostMicros(
  input: number,
  output: number,
  inputPrice: number,
  outputPrice: number,
) {
  return Math.ceil(input * inputPrice + output * outputPrice);
}
export async function reserveBudget(
  userId: string,
  purpose: string,
  micros: number,
) {
  if (!Number.isSafeInteger(micros) || micros <= 0)
    throw new AppError("INVALID_RESERVATION", "Reserva de custo inválida.");
  return transaction(async (c) => {
    const profile = (
      await c.query(
        "SELECT monthly_limit_cents FROM learner_profiles WHERE user_id=$1 FOR UPDATE",
        [userId],
      )
    ).rows[0];
    if (
      !profile ||
      (
        await c.query("SELECT 1 FROM deletion_requests WHERE user_id=$1", [
          userId,
        ])
      ).rowCount
    )
      throw new AppError("ACCOUNT_UNAVAILABLE", "Conta indisponível.", 403);
    const period = budgetPeriod();
    const active = Number(
      (
        await c.query(
          "SELECT count(*) AS n FROM budget_reservations WHERE user_id=$1 AND state='active'",
          [userId],
        )
      ).rows[0].n,
    );
    if (active >= 2)
      throw new AppError(
        "AI_CONCURRENCY_LIMIT",
        "Há duas chamadas em andamento. Aguarde a conclusão antes de iniciar outra.",
        429,
        true,
      );
    const used = Number(
      (
        await c.query(
          "SELECT coalesce(sum(amount_micros),0) AS total FROM usage_events WHERE user_id=$1 AND period=$2",
          [userId, period],
        )
      ).rows[0].total,
    );
    const reserved = Number(
      (
        await c.query(
          "SELECT coalesce(sum(amount_micros),0) AS total FROM budget_reservations WHERE user_id=$1 AND state IN ('active','unknown')",
          [userId],
        )
      ).rows[0].total,
    );
    if (used + reserved + micros > profile.monthly_limit_cents * 10000)
      throw new AppError(
        "BUDGET_EXCEEDED",
        "Limite de IA atingido. Seu material pronto e suas revisões continuam disponíveis.",
        429,
      );
    return (
      await c.query(
        "INSERT INTO budget_reservations(user_id,period,purpose,amount_micros) VALUES($1,$2,$3,$4) RETURNING id",
        [userId, period, purpose, micros],
      )
    ).rows[0].id as string;
  });
}
export async function settleBudget(
  id: string,
  data: {
    model: string;
    input: number;
    output: number;
    micros: number;
    priceVersion: string;
    raw: unknown;
  },
) {
  await transaction(async (c) => {
    const r = (
      await c.query(
        "SELECT * FROM budget_reservations WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r || r.state === "settled") return;
    await c.query(
      "INSERT INTO usage_events(user_id,reservation_id,period,purpose,model,input_tokens,output_tokens,amount_micros,price_version,raw_usage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
      [
        r.user_id,
        id,
        r.period,
        r.purpose,
        data.model,
        data.input,
        data.output,
        data.micros,
        data.priceVersion,
        JSON.stringify(data.raw),
      ],
    );
    await c.query(
      "UPDATE budget_reservations SET state='settled' WHERE id=$1",
      [id],
    );
  });
}
export async function failBudget(id: string, ambiguous: boolean) {
  await query(
    "UPDATE budget_reservations SET state=$2 WHERE id=$1 AND state=$3",
    [id, ambiguous ? "unknown" : "released", "active"],
  );
}
export async function usage(userId: string) {
  const period = budgetPeriod();
  const profile = (
    await query(
      "SELECT monthly_limit_cents,alert_cents FROM learner_profiles WHERE user_id=$1",
      [userId],
    )
  )[0];
  const totals = (
    await query(
      "SELECT coalesce(sum(amount_micros),0) AS micros FROM usage_events WHERE user_id=$1 AND period=$2",
      [userId, period],
    )
  )[0];
  const reserved = (
    await query(
      "SELECT coalesce(sum(amount_micros),0) AS micros FROM budget_reservations WHERE user_id=$1 AND state IN ('active','unknown')",
      [userId],
    )
  )[0];
  const rows = await query(
    "SELECT purpose,model,sum(input_tokens) AS input_tokens,sum(output_tokens) AS output_tokens,sum(amount_micros) AS micros FROM usage_events WHERE user_id=$1 AND period=$2 GROUP BY purpose,model",
    [userId, period],
  );
  return {
    period,
    confirmed: Number(totals.micros) / 1e6,
    reserved: Number(reserved.micros) / 1e6,
    limit: (profile?.monthly_limit_cents ?? 4000) / 100,
    alert: (profile?.alert_cents ?? 2500) / 100,
    rows,
    forecast: null,
  };
}

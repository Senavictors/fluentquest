import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { transaction } from "./db";
import { AppError } from "../domain/content";
export async function idempotent<T>(
  userId: string,
  scope: string,
  key: string | null,
  payload: unknown,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  if (!key || key.length > 128)
    throw new AppError(
      "IDEMPOTENCY_REQUIRED",
      "Esta ação precisa de uma chave idempotente.",
    );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return transaction(async (c) => {
    await c.query(
      "INSERT INTO idempotency(user_id,scope,key,fingerprint) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [userId, scope, key, fingerprint],
    );
    const row = (
      await c.query(
        "SELECT * FROM idempotency WHERE user_id=$1 AND scope=$2 AND key=$3 FOR UPDATE",
        [userId, scope, key],
      )
    ).rows[0];
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "A chave já foi usada em outra operação.",
        409,
      );
    if (row.response !== null) return row.response;
    const value = await fn(c);
    await c.query(
      "UPDATE idempotency SET response=$4 WHERE user_id=$1 AND scope=$2 AND key=$3",
      [userId, scope, key, JSON.stringify(value)],
    );
    return value;
  });
}

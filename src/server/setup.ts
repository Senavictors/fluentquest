import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../domain/content";
import { ownerSetupAuth } from "./auth";
import { pool, query } from "./db";

const SETUP_LOCK_KEY = 7340011;
const MIN_TOKEN_LENGTH = 16;

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const setupInput = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  password: z
    .string()
    .min(12, "A senha precisa ter pelo menos 12 caracteres.")
    .max(128),
  token: z.string().min(1, "Informe o código de configuração.").max(256),
});

const digest = (value: string) => createHash("sha256").update(value).digest();

function tokenMatches(input: string) {
  const expected = process.env.FQ_SETUP_TOKEN ?? "";
  return timingSafeEqual(digest(input), digest(expected));
}

const tokenConfigured = () =>
  (process.env.FQ_SETUP_TOKEN ?? "").length >= MIN_TOKEN_LENGTH;

const ownerExists = async () =>
  (await query('SELECT 1 FROM "user" LIMIT 1')).length > 0;

export async function setupOpen() {
  return tokenConfigured() && !(await ownerExists());
}

async function takeSetupSlot() {
  const rate = (
    await query(
      "INSERT INTO rate_limits(key,count,resets_at) VALUES('setup',1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.count+1 END,resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+interval '1 minute' ELSE rate_limits.resets_at END RETURNING count",
    )
  )[0];
  if (rate.count > 10)
    throw new AppError(
      "RATE_LIMIT",
      "Muitas tentativas. Aguarde um minuto.",
      429,
      true,
    );
}

async function createOwner(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !==
      new URL(process.env.BETTER_AUTH_URL || "http://localhost:3215").origin
  )
    throw new AppError(
      "INVALID_ORIGIN",
      "Origem da solicitação inválida.",
      403,
    );
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "Dados inválidos.");
  }
  await takeSetupSlot();
  const input = setupInput.parse(payload);
  if (!tokenConfigured())
    throw new AppError(
      "SETUP_DISABLED",
      "O primeiro acesso não está habilitado neste servidor.",
      403,
    );
  const client = await pool.connect();
  try {
    // Duas requisições simultâneas não podem criar dois proprietários.
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK_KEY]);
    try {
      if (await ownerExists())
        throw new AppError(
          "OWNER_EXISTS",
          "O proprietário já foi criado. Entre com a sua conta.",
          409,
        );
      if (!tokenMatches(input.token))
        throw new AppError(
          "INVALID_SETUP_TOKEN",
          "Código de configuração incorreto.",
          403,
        );
      const result = await ownerSetupAuth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: "Estudante",
        },
      });
      await query(
        "INSERT INTO learner_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [result.user.id],
      );
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SETUP_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

export async function handleSetup(request: Request) {
  const requestId = randomUUID();
  try {
    if (request.method === "GET") return json({ open: await setupOpen() });
    if (request.method === "POST") {
      await createOwner(request);
      return json({ created: true }, 201);
    }
    throw new AppError("NOT_FOUND", "Operação não encontrada.", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          code: "INVALID_INPUT",
          message: error.issues[0]?.message || "Revise os campos.",
          retryable: false,
          requestId,
        },
        422,
      );
    if (error instanceof AppError)
      return json(
        {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId,
        },
        error.status,
      );
    console.error(
      "SETUP_ERROR",
      requestId,
      error instanceof Error ? error.name : "Unknown",
    );
    return json(
      {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir. Tente novamente.",
        retryable: true,
        requestId,
      },
      500,
    );
  }
}

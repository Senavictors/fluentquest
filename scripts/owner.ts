import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
process.env.FQ_OWNER_SETUP = "true";
const ownerFile = await readFile(".env.owner", "utf8").catch((error) => {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
  throw error;
});
const ownerConfig = parseEnv(ownerFile);
const { auth } = await import("../src/server/auth");
const { pool, query } = await import("../src/server/db");
try {
  if ((await query('SELECT id FROM "user" LIMIT 1')).length)
    throw new Error(
      "O proprietário já existe. Cadastro adicional desabilitado.",
    );
  const email = process.env.OWNER_EMAIL || ownerConfig.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD || ownerConfig.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || ownerConfig.OWNER_NAME || "Estudante";
  if (!email || !password || password.length < 12)
    throw new Error(
      "Configure OWNER_EMAIL e OWNER_PASSWORD (12+ caracteres) no ambiente ou em .env.owner.",
    );
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });
  await query(
    "INSERT INTO learner_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING",
    [result.user.id],
  );
  console.log(
    "Proprietário criado. Entre com as credenciais configuradas localmente.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha ao criar proprietário.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

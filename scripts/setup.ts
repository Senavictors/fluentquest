import { readFile, writeFile, access } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import pg from "pg";
try {
  try {
    await access(".env.local");
    console.log(".env.local já existe; use npm run db:migrate.");
    process.exit(0);
  } catch {}
  const env = parseEnv(await readFile(".env.setup", "utf8"));
  if (!env.ADMIN_DATABASE_URL)
    throw new Error("Configure ADMIN_DATABASE_URL em .env.setup.");
  const adminUrl = new URL(env.ADMIN_DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname))
    throw new Error("Setup restrito ao PostgreSQL local.");
  const client = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
  await client.connect();
  const password = randomBytes(32).toString("hex");
  const exists = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname='fluentquest'",
  );
  const dbExists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname='fluentquest'",
  );
  if (exists.rowCount || dbExists.rowCount)
    throw new Error(
      "Recursos fluentquest já existem. Configure .env.local com a conexão existente; o setup não altera senhas ou bancos existentes.",
    );
  await client.query(
    `CREATE ROLE fluentquest LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  await client.query("CREATE DATABASE fluentquest OWNER fluentquest");
  await client.end();
  const appUrl = new URL(adminUrl);
  appUrl.username = "fluentquest";
  appUrl.password = password;
  appUrl.pathname = "/fluentquest";
  await writeFile(
    ".env.local",
    `DATABASE_URL=${appUrl}\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3215\nAI_ENABLED=false\nDATA_DIR=./data\nPG_BIN=C:/Program Files/PostgreSQL/18/bin\n`,
    { flag: "wx" },
  );
  console.log(
    "Banco e usuário exclusivos criados. Execute npm run db:migrate e npm run owner:create.",
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[conexão omitida]")
      : "Falha no setup.",
  );
  process.exitCode = 1;
}

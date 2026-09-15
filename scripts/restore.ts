import { readFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseEnv, promisify } from "node:util";
import { execFile } from "node:child_process";
import pg from "pg";
const dir = path.resolve(process.argv[2] || "");
const root = path.resolve("backups");
if (path.dirname(dir) !== root)
  throw new Error("Informe um backup dentro de backups/.");
const manifest = JSON.parse(
  await readFile(path.join(dir, "manifest.json"), "utf8"),
);
if (manifest.database !== "fluentquest") throw new Error("Backup inválido.");
const env = parseEnv(await readFile(".env.setup", "utf8"));
if (!env.ADMIN_DATABASE_URL)
  throw new Error("Configure ADMIN_DATABASE_URL em .env.setup.");
const adminUrl = new URL(env.ADMIN_DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname))
  throw new Error("Restauração somente local.");
const admin = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
await admin.connect();
try {
  if (
    (
      await admin.query(
        "SELECT 1 FROM pg_database WHERE datname='fluentquest_restore'",
      )
    ).rowCount
  )
    throw new Error("fluentquest_restore já existe. Não será sobrescrito.");
  await admin.query("CREATE DATABASE fluentquest_restore OWNER fluentquest");
} finally {
  await admin.end();
}
const url = new URL(process.env.DATABASE_URL!);
const run = promisify(execFile);
await run(
  path.join(
    process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin",
    "pg_restore.exe",
  ),
  [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    "fluentquest_restore",
    "--no-owner",
    "--no-acl",
    path.join(dir, "database.dump"),
  ],
  {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    windowsHide: true,
  },
);
const dataDir = path.resolve("data-restore");
await mkdir(dataDir, { recursive: true });
await cp(path.join(dir, "objects"), path.join(dataDir, "objects"), {
  recursive: true,
  errorOnExist: true,
  force: false,
}).catch((e: NodeJS.ErrnoException) => {
  if (e.code !== "ENOENT") throw e;
});
console.log(
  "Restaurado em fluentquest_restore e data-restore/. Valide antes de alterar DATABASE_URL e DATA_DIR. O banco original foi preservado.",
);

import { mkdir, cp, readdir, stat, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const root = path.resolve("backups"),
  dir = path.join(root, new Date().toISOString().replace(/[:.]/g, "-"));
const url = new URL(process.env.DATABASE_URL!);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/fluentquest"
)
  throw new Error("Backup restrito ao banco local fluentquest.");
await mkdir(dir, { recursive: true });
const bin = path.join(
  process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin",
  "pg_dump.exe",
);
await run(
  bin,
  [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    "fluentquest",
    "-Fc",
    "--no-owner",
    "--no-acl",
    "-f",
    path.join(dir, "database.dump"),
  ],
  {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    windowsHide: true,
  },
);
await cp(
  path.resolve(process.env.DATA_DIR || "data", "objects"),
  path.join(dir, "objects"),
  { recursive: true },
).catch((e: NodeJS.ErrnoException) => {
  if (e.code !== "ENOENT") throw e;
});
await writeFile(
  path.join(dir, "manifest.json"),
  JSON.stringify(
    {
      formatVersion: 1,
      database: "fluentquest",
      createdAt: new Date().toISOString(),
      retentionDays: 30,
    },
    null,
    2,
  ),
);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}T/.test(entry.name)) continue;
  const target = path.resolve(root, entry.name);
  if (path.dirname(target) !== root)
    throw new Error("Caminho de backup inválido.");
  if ((await stat(target)).mtimeMs < Date.now() - 30 * 86400000)
    await rm(target, { recursive: true, force: true });
}
console.log(
  `Backup criado em ${dir}. Objetos e banco devem ser restaurados juntos.`,
);

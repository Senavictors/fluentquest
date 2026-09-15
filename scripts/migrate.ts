import { readFile, readdir } from "node:fs/promises";
import { pool } from "../src/server/db";
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(843201)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS fq_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = new URL("../migrations/", import.meta.url);
    for (const file of (await readdir(dir))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort()) {
      const name = file.replace(/\.sql$/, "");
      if (
        (
          await client.query("SELECT name FROM fq_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query(await readFile(new URL(file, dir), "utf8"));
      await client.query("INSERT INTO fq_migrations(name) VALUES($1)", [name]);
    }
    await client.query("COMMIT");
    console.log("Migrações FluentQuest aplicadas.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
if (process.argv[1]?.endsWith("migrate.ts")) {
  await migrate();
  await pool.end();
}

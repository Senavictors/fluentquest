import { PgBoss } from "pg-boss";
import { query } from "./db";
let instance: Promise<PgBoss> | undefined;
export const QUEUE = "fluentquest-prepare";
export async function boss() {
  instance ??= (async () => {
    const b = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: "pgboss",
    });
    b.on("error", () => console.error("QUEUE_ERROR"));
    await b.start();
    await b.createQueue(QUEUE, { retryLimit: 0, expireInSeconds: 600 });
    return b;
  })();
  return instance;
}
export async function emitJob(id: string, data: unknown) {
  await query("INSERT INTO job_events(job_id,data) VALUES($1,$2)", [
    id,
    JSON.stringify(data),
  ]);
}
export async function dispatchJobs() {
  const jobs = await query(
    "SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 20",
  );
  const b = await boss();
  for (const job of jobs)
    await b.send(
      QUEUE,
      { id: job.id },
      { singletonKey: job.id, retryLimit: 0 },
    );
}

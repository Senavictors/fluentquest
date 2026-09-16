import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import pg from "pg";

// Refuse to replace a running app. All learning data below belongs to a disposable DB.
const probe = createServer();
await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(3215, "127.0.0.1", () => probe.close(() => resolve()));
});
const env = parseEnv(await readFile(".env.setup", "utf8"));
const admin = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
await admin.connect();
const dbName = `fluentquest_test_qa_${Date.now()}`;
if (!/^fluentquest_test_qa_\d+$/.test(dbName))
  throw new Error("Invalid test database");
await admin.query(`CREATE DATABASE ${dbName} OWNER fluentquest`);
const connection = new URL(process.env.DATABASE_URL!);
connection.pathname = `/${dbName}`;
process.env.DATABASE_URL = connection.toString();
process.env.DATA_DIR = `./data/tests/${dbName}`;
process.env.AI_ENABLED = "false";
delete process.env.GEMINI_API_KEY;
delete process.env.YOUTUBE_API_KEY;
process.env.BETTER_AUTH_URL = "http://localhost:3215";
process.env.FQ_OWNER_SETUP = "true";
process.env.FQ_QA_PASSWORD = randomBytes(20).toString("hex");
let server: ChildProcess | undefined;
let closePool: (() => Promise<void>) | undefined;
try {
  const { migrate } = await import("./migrate");
  await migrate();
  const { pool, query } = await import("../src/server/db");
  closePool = () => pool.end();
  const { auth } = await import("../src/server/auth");
  const { handle } = await import("../src/server/api");
  const owner = await auth.api.signUpEmail({
    body: {
      email: "estudante@fluentquest.local",
      password: process.env.FQ_QA_PASSWORD,
      name: "Estudante de teste",
    },
  });
  const login = await auth.api.signInEmail({
    body: {
      email: "estudante@fluentquest.local",
      password: process.env.FQ_QA_PASSWORD,
    },
    asResponse: true,
  });
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  for (const [path, method, body] of [
    ["example", "POST", {}],
    [
      "profile",
      "PATCH",
      {
        onboarded: true,
        goal: "Explicar um bloqueio sem roteiro",
        theme: "light",
      },
    ],
  ] as const) {
    const response = await handle(
      new Request(`http://localhost:3215/api/${path}`, {
        method,
        headers: {
          Cookie: cookie,
          Origin: "http://localhost:3215",
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      [path],
    );
    if (!response.ok) throw new Error(`Fixture setup failed: ${path}`);
    if (path === "example") {
      const { id } = await response.json();
      const session = await handle(
        new Request("http://localhost:3215/api/sessions", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "http://localhost:3215",
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify({ sourceId: id, duration: 25 }),
        }),
        ["sessions"],
      );
      if (!session.ok) throw new Error("Session fixture failed");
    }
  }
  const source = (
    await query(
      "INSERT INTO sources(user_id,kind,url,video_id,title,author,language,rights,status,duration_ms,transcription_mode) VALUES($1,'youtube','https://www.youtube.com/watch?v=mDxeUnbUOn0','mDxeUnbUOn0','Legenda de teste','Material autorizado de teste','en-US','public_link','no_transcript',495000,'ai') RETURNING id",
      [owner.user.id],
    )
  )[0];
  process.env.FQ_QA_SOURCE_ID = source.id;
  const aiSource = (
    await query(
      "INSERT INTO sources(user_id,kind,url,video_id,title,author,language,rights,status,duration_ms,transcription_mode,transcript_provider,transcript_model,transcript_reviewed,transcription_completed_at) VALUES($1,'youtube','https://www.youtube.com/watch?v=abcdefghijk','abcdefghijk','Transcrição automática de teste','Provedor de teste','en-US','public_link','text_ready',60000,'ai','gemini','fixture-model',false,now()) RETURNING id",
      [owner.user.id],
    )
  )[0];
  await query(
    "INSERT INTO segments(source_id,ordinal,start_ms,end_ms,text,origin,time_accuracy,quality_status) VALUES($1,0,0,12000,'A provider generated fixture for visual QA.','provider_video_url','approximate','ai_unreviewed')",
    [aiSource.id],
  );
  process.env.FQ_QA_AI_SOURCE_ID = aiSource.id;
  // Seed an inert recording row to exercise the external-send consent UI; no real voice.
  await query(
    "INSERT INTO recordings(user_id,file_key,mime_type,duration_ms,size_bytes,preserve,expires_at) VALUES($1,'fixture-missing.webm','audio/webm',1000,1,false,now()+interval '7 days')",
    [owner.user.id],
  );
  process.env.FQ_OWNER_SETUP = "false";
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3215",
    ],
    { env: process.env, stdio: "ignore", windowsHide: true },
  );
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("QA web server failed to start");
    try {
      if (
        (
          await fetch("http://localhost:3215", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        break;
    } catch {}
    if (i === 99) throw new Error("QA web server timed out");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const scripts = process.argv.includes("--source-only")
    ? ["scripts/source-qa.mjs"]
    : [
        "scripts/browser-qa.mjs",
        "scripts/accessibility-qa.mjs",
        "scripts/source-qa.mjs",
      ];
  for (const script of scripts) {
    const child = spawn(process.execPath, [script], {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    const [code] = await once(child, "exit");
    if (code !== 0) throw new Error(`${script} failed (${code})`);
  }
} finally {
  if (server && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
  await closePool?.();
  await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
  await admin.end();
}

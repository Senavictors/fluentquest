import { readFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
// This suite creates only a uniquely named, isolated FluentQuest test database.
const env = parseEnv(await readFile(".env.setup", "utf8"));
if (!env.ADMIN_DATABASE_URL)
  throw new Error("Configure .env.setup para testes isolados.");
const admin = new pg.Client({ connectionString: env.ADMIN_DATABASE_URL });
await admin.connect();
const dbName = `fluentquest_test_${Date.now()}`;
await admin.query(`CREATE DATABASE ${dbName} OWNER fluentquest`);
const connection = new URL(process.env.DATABASE_URL!);
connection.pathname = `/${dbName}`;
process.env.DATABASE_URL = connection.toString();
process.env.DATA_DIR = `./data/tests/${dbName}`;
process.env.AI_ENABLED = "false";
process.env.FQ_OWNER_SETUP = "true";
const { migrate } = await import("./migrate");
await migrate();
const { pool, query } = await import("../src/server/db");
const { auth } = await import("../src/server/auth");
const { handle } = await import("../src/server/api");
const { reserveBudget, settleBudget } = await import("../src/server/budget");
const { prepare, maintenance } = await import("../src/worker");
const { boss } = await import("../src/server/queue");
let passed = 0;
const ok = (label: string) => {
  passed++;
  console.log(`PASS ${label}`);
};
try {
  const password = randomBytes(20).toString("hex");
  const u = await auth.api.signUpEmail({
    body: {
      email: "qa@fluentquest.local",
      password,
      name: "Teste de integração",
    },
  });
  const response = await auth.api.signInEmail({
    body: { email: "qa@fluentquest.local", password },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const origin = process.env.BETTER_AUTH_URL || "http://localhost:3215";
  const request = async (
    path: string,
    method = "GET",
    payload?: unknown,
    key = randomUUID(),
    customCookie = cookie,
  ) => {
    const req = new Request(`${origin}/api/${path}`, {
      method,
      headers: {
        Cookie: customCookie,
        Origin: origin,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const r = await handle(req, path.split("?")[0].split("/"));
    const content = await r.json();
    return { status: r.status, data: content };
  };
  assert.equal((await request("bootstrap")).status, 200);
  ok("Login e perfil persistentes");
  assert.equal(
    (await request("bootstrap", "GET", undefined, randomUUID(), "")).status,
    401,
  );
  ok("Acesso anônimo bloqueado");
  const exampleKey = randomUUID();
  const examples = await Promise.all([
    request("example", "POST", {}, exampleKey),
    request("example", "POST", {}, exampleKey),
  ]);
  assert.equal(examples[0].data.id, examples[1].data.id);
  const sourceId = examples[0].data.id;
  assert.equal(
    (
      await query("SELECT count(*)::int AS n FROM sources WHERE user_id=$1", [
        u.user.id,
      ])
    )[0].n,
    1,
  );
  ok("Importação concorrente idempotente");
  const source = (await request(`sources/${sourceId}`)).data;
  assert.equal(source.segments.length, 6);
  assert.equal(source.units.length, 1);
  ok("Fonte com proveniência, trechos e atividade");
  assert.equal(
    (await request(`sources/${sourceId}/prepare`, "POST", {})).data.code,
    "INTEGRATION_NOT_CONFIGURED",
  );
  ok("IA desligada sem resposta simulada");
  const s = await request("sessions", "POST", { sourceId, duration: 25 });
  assert.equal(s.status, 200);
  await request(`sessions/${s.data.id}`, "PATCH", {
    stage: "recall",
    context: { tab: "activity", segment: source.segments[1].id },
  });
  assert.equal((await request("bootstrap")).data.session.stage, "recall");
  ok("Retomada da sessão e contexto");
  const cardData = {
    expression: "under load",
    meaning: "sob carga",
    example: "The service slows down under load.",
    sourceId,
    segmentId: source.segments[1].id,
    mode: "production",
    language: "en-US",
  };
  const card = (await request("cards", "POST", cardData)).data;
  const again = (
    await request("cards", "POST", { ...cardData, expression: " Under  LOAD " })
  ).data;
  assert.equal(card.id, again.id);
  ok("Cartões equivalentes não duplicam");
  const duplicateKey = randomUUID();
  const reviews = await Promise.all([
    request(
      `reviews/${card.id}/answer`,
      "POST",
      { rating: 3, version: 0 },
      duplicateKey,
    ),
    request(
      `reviews/${card.id}/answer`,
      "POST",
      { rating: 3, version: 0 },
      duplicateKey,
    ),
  ]);
  assert.equal(reviews[0].data.eventId, reviews[1].data.eventId);
  assert.equal((await request("progress")).data.xp, 5);
  assert.equal(
    (await query("SELECT version FROM cards WHERE id=$1", [card.id]))[0]
      .version,
    1,
  );
  ok("Duas abas: mesma revisão aplica FSRS e XP uma vez");
  assert.equal(
    (
      await request(`reviews/${card.id}/answer`, "POST", {
        rating: 4,
        version: 0,
      })
    ).status,
    409,
  );
  ok("Versão obsoleta retorna conflito");
  assert.equal(
    (await request(`reviews/${reviews[0].data.eventId}/undo`, "POST", {}))
      .status,
    200,
  );
  assert.equal((await request("progress")).data.xp, 0);
  ok("Correção da última resposta desfaz XP e restaura estado");
  const attempt = await request("attempts", "POST", {
    activityId: source.units[0].id,
    kind: "text",
    response: "I would isolate shared state.",
    helpUsed: false,
  });
  assert.equal(attempt.status, 201);
  assert.ok(attempt.data.feedback.reference);
  ok("Tentativa libera referência somente depois de responder");
  const audio = Buffer.alloc(44 + 16000 * 2);
  audio.write("RIFF", 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24);
  audio.writeUInt32LE(32000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(audio.length - 44, 40);
  const intent = (
    await request("recordings/upload-intent", "POST", {
      mime: "audio/wav",
      size: audio.length,
      durationMs: 1000,
      consent: true,
      preserve: false,
    })
  ).data;
  const uploadRequest = new Request(origin + intent.uploadUrl, {
    method: "PUT",
    headers: { Cookie: cookie, Origin: origin },
    body: new Uint8Array(audio),
  });
  const upload = await handle(uploadRequest, ["recordings", "upload"]);
  assert.equal(upload.status, 201);
  const rec = await upload.json();
  const oral = await request("attempts", "POST", {
    scenario: "daily",
    kind: "speaking",
    response: "QA audio fixture",
    recordingId: rec.id,
  });
  assert.equal(oral.status, 201);
  const media = await handle(
    new Request(`${origin}/api/recordings/${rec.id}/audio`, {
      headers: { Cookie: cookie, Range: "bytes=0-43" },
    }),
    ["recordings", rec.id, "audio"],
  );
  assert.equal(media.status, 206);
  assert.equal((await media.arrayBuffer()).byteLength, 44);
  ok("Upload validado, áudio privado e reprodução com Range");
  assert.equal(
    (await request(`recordings/${rec.id}/assess`, "POST", {})).data.code,
    "INTEGRATION_NOT_CONFIGURED",
  );
  ok("Fala não recebe avaliação fictícia");
  const retry = await request("attempts", "POST", {
    scenario: "daily",
    kind: "retry",
    response: "Second recording",
    recordingId: rec.id,
    retryOf: oral.data.id,
    reflection: "Vou explicar o sintoma antes da solução.",
  });
  assert.equal(retry.status, 201);
  const retryAgain = await request("attempts", "POST", {
    scenario: "daily",
    kind: "retry",
    response: "Third recording",
    recordingId: rec.id,
    retryOf: oral.data.id,
    reflection: "Vou falar com menos apoio.",
  });
  assert.equal(retryAgain.status, 201);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM xp_events WHERE user_id=$1 AND rule='retry_reflection'",
        [u.user.id],
      )
    )[0].n,
    1,
  );
  ok("Nova tentativa com reflexão não duplica recompensa");
  const weekly = await request("attempts", "POST", {
    scenario: "weekly",
    kind: "speaking",
    response: "Weekly challenge fixture",
    recordingId: rec.id,
  });
  const challenges = await Promise.all([
    request("challenges/weekly", "POST", {
      attemptId: weekly.data.id,
      reflection: "Eu comparei alternativas e reconheci uma limitação.",
    }),
    request("challenges/weekly", "POST", {
      attemptId: weekly.data.id,
      reflection: "Eu comparei alternativas e reconheci uma limitação.",
    }),
  ]);
  assert.equal(challenges[0].data.challengeId, challenges[1].data.challengeId);
  ok("Desafio semanal concede recompensa uma única vez");
  const outsider = await auth.api.signUpEmail({
    body: {
      email: "outsider@fluentquest.local",
      password,
      name: "Outro usuário de teste",
    },
  });
  const otherResponse = await auth.api.signInEmail({
    body: { email: "outsider@fluentquest.local", password },
    asResponse: true,
  });
  const otherCookie = otherResponse.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.equal(
    (
      await request(
        `sources/${sourceId}`,
        "GET",
        undefined,
        randomUUID(),
        otherCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        `recordings/${rec.id}`,
        "DELETE",
        undefined,
        randomUUID(),
        otherCookie,
      )
    ).status,
    404,
  );
  ok("Isolamento de fonte e gravação por proprietário");
  const workerJob = (
    await query(
      "INSERT INTO jobs(user_id,source_id,kind,status) VALUES($1,$2,'prepare','queued') RETURNING id",
      [u.user.id, sourceId],
    )
  )[0];
  await Promise.all([prepare(workerJob.id), prepare(workerJob.id)]);
  assert.equal(
    (await query("SELECT status FROM jobs WHERE id=$1", [workerJob.id]))[0]
      .status,
    "awaiting_configuration",
  );
  ok("Worker persiste falha sem IA e duas execuções não duplicam preparo");
  const interrupted = (
    await query(
      "INSERT INTO jobs(user_id,source_id,kind,status,updated_at) VALUES($1,$2,'prepare','processing',now()-interval '11 minutes') RETURNING id",
      [u.user.id, sourceId],
    )
  )[0];
  await query(
    "UPDATE recordings SET expires_at=now()-interval '1 day' WHERE id=$1",
    [rec.id],
  );
  await maintenance();
  assert.equal(
    (await query("SELECT status FROM jobs WHERE id=$1", [interrupted.id]))[0]
      .status,
    "needs_review",
  );
  assert.equal(
    (await query("SELECT 1 FROM recordings WHERE id=$1", [rec.id])).length,
    0,
  );
  ok("Recuperação após interrupção e expiração de áudio");
  await request("profile", "PATCH", { monthlyLimitCents: 1 });
  const budgetResults = await Promise.allSettled([
    reserveBudget(u.user.id, "test", 7000),
    reserveBudget(u.user.id, "test", 7000),
  ]);
  assert.equal(budgetResults.filter((r) => r.status === "fulfilled").length, 1);
  ok("Reserva atômica impede excedente por concorrência");
  const reservation = (
    budgetResults.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<string>
  ).value;
  await settleBudget(reservation, {
    model: "test",
    input: 10,
    output: 10,
    micros: 3000,
    priceVersion: "test",
    raw: {},
  });
  await settleBudget(reservation, {
    model: "test",
    input: 10,
    output: 10,
    micros: 3000,
    priceVersion: "test",
    raw: {},
  });
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM usage_events WHERE user_id=$1",
        [u.user.id],
      )
    )[0].n,
    1,
  );
  ok("Conciliação de custo idempotente");
  const exportResponse = await request("account/export");
  assert.equal(exportResponse.status, 200);
  assert.ok(exportResponse.data.segments.length);
  assert.equal(JSON.stringify(exportResponse.data).includes("password"), false);
  ok("Exportação sem credenciais");
  await query(
    "INSERT INTO jobs(user_id,source_id,kind,status) VALUES($1,$2,'prepare','queued')",
    [u.user.id, sourceId],
  );
  assert.equal(
    (await request("account", "DELETE", { confirm: "EXCLUIR" })).status,
    202,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM jobs WHERE user_id=$1 AND status='queued'",
        [u.user.id],
      )
    )[0].n,
    0,
  );
  assert.equal((await request("bootstrap")).status, 401);
  ok("Exclusão revoga sessão e cancela jobs pendentes");
  await maintenance();
  assert.equal(
    (await query('SELECT 1 FROM "user" WHERE id=$1', [u.user.id])).length,
    0,
  );
  assert.equal(
    (
      await query("SELECT state FROM deletion_requests WHERE user_id=$1", [
        u.user.id,
      ])
    )[0].state,
    "completed",
  );
  ok("Worker conclui exclusão e preserva tombstone");
  console.log(
    `${passed} cenários de integração passaram. Nenhuma chamada de IA.`,
  );
} finally {
  await (await boss()).stop({ graceful: true });
  await pool.end();
  // The generated name is validated before deleting this suite's disposable database.
  if (!/^fluentquest_test_\d+$/.test(dbName))
    throw new Error("Invalid disposable database name");
  await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
  await admin.end();
}

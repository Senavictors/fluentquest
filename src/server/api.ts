import { z } from "zod";
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, query, transaction } from "./db";
import { profiles } from "./schema";
import { idempotent } from "./idempotency";
import {
  AppError,
  sourceInput,
  cardInput,
  normalize,
  parseContent,
  MAX_VIDEO_TRANSCRIPTION_MS,
  validateVideoTranscriptionDuration,
  youtubeId,
  scenarios,
} from "../domain/content";
import {
  initialCard,
  scheduleCard,
  FSRS_CONFIG_VERSION,
  xpLevel,
  nextLevelXp,
} from "../domain/review";
import { exampleSegments, exampleVocabulary } from "./example";
import {
  integrationStatus,
  videoIntegrationStatus,
  requireAI,
  textAI,
  assessSpeech,
  streamTutor,
} from "./providers";
import { storage } from "./storage";
import { usage, videoTranscriptionEstimateMicros } from "./budget";
import { fileTypeFromBuffer } from "file-type";
import { inspectMedia } from "./media";
import type { PoolClient } from "pg";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(request: Request, limit = 600000) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "O arquivo ou texto excede o limite permitido.",
        413,
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("INVALID_JSON", "Dados inválidos.");
  }
}
async function owner(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    throw new AppError("UNAUTHENTICATED", "Entre para continuar.", 401);
  if (
    (
      await query("SELECT 1 FROM deletion_requests WHERE user_id=$1", [
        session.user.id,
      ])
    ).length
  )
    throw new AppError(
      "ACCOUNT_DELETING",
      "A exclusão desta conta está em andamento.",
      403,
    );
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
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
  }
  await query(
    "INSERT INTO learner_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING",
    [session.user.id],
  );
  const rate = (
    await query(
      "INSERT INTO rate_limits(key,count,resets_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.count+1 END,resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+interval '1 minute' ELSE rate_limits.resets_at END RETURNING count",
      [`api:${session.user.id}`],
    )
  )[0];
  if (rate.count > 180)
    throw new AppError(
      "RATE_LIMIT",
      "Muitas ações em pouco tempo. Aguarde um minuto.",
      429,
      true,
    );
  return session.user;
}
async function sourceFor(userId: string, id: string, c?: PoolClient) {
  z.string().uuid().parse(id);
  const rows = c
    ? (
        await c.query("SELECT * FROM sources WHERE id=$1 AND user_id=$2", [
          id,
          userId,
        ])
      ).rows
    : await query("SELECT * FROM sources WHERE id=$1 AND user_id=$2", [
        id,
        userId,
      ]);
  if (!rows[0]) throw new AppError("NOT_FOUND", "Fonte não encontrada.", 404);
  return rows[0];
}
async function award(
  c: PoolClient,
  userId: string,
  origin: string,
  rule: string,
  amount: number,
) {
  await c.query(
    "INSERT INTO xp_events(user_id,origin_id,rule,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [userId, origin, rule, amount],
  );
}
async function progress(userId: string) {
  const [xp] = await query(
    "SELECT coalesce(sum(amount),0)::int AS total FROM xp_events WHERE user_id=$1",
    [userId],
  );
  const evidence = await query(
    "SELECT * FROM skill_evidence WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
    [userId],
  );
  const [counts] = await query(
    "SELECT (SELECT count(*) FROM cards WHERE user_id=$1)::int AS cards,(SELECT count(*) FROM review_events WHERE user_id=$1 AND NOT undone)::int AS reviews,(SELECT count(*) FROM recordings WHERE user_id=$1)::int AS recordings,(SELECT count(*) FROM study_sessions WHERE user_id=$1 AND completed_at>=date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')::int AS weekly_sessions",
    [userId],
  );
  const level = xpLevel(xp.total);
  return {
    xp: xp.total,
    level,
    nextLevel: nextLevelXp(level),
    evidence,
    ...counts,
  };
}
async function importExample(userId: string, key: string | null) {
  return idempotent(userId, "example", key, {}, async (c) => {
    const existing = (
      await c.query("SELECT id FROM sources WHERE user_id=$1 AND is_example", [
        userId,
      ])
    ).rows[0];
    if (existing) return existing;
    const source = (
      await c.query(
        "INSERT INTO sources(user_id,kind,title,author,rights,status,is_example) VALUES($1,'text','Debugging a flaky test','Material de exemplo FluentQuest','owned','ready',true) RETURNING *",
        [userId],
      )
    ).rows[0];
    const ids = [];
    for (let i = 0; i < exampleSegments.length; i++) {
      const s = exampleSegments[i];
      ids.push(
        (
          await c.query(
            "INSERT INTO segments(source_id,ordinal,text,translation,origin,quality_status) VALUES($1,$2,$3,$4,'example','editorial_example') RETURNING id",
            [source.id, i, s.text, s.translation],
          )
        ).rows[0].id,
      );
    }
    await c.query(
      "INSERT INTO learning_units(user_id,source_id,title,objective,prompt,expected_answer,segment_ids,vocabulary,provenance) VALUES($1,$2,'Explique o próximo passo','Comunicar uma investigação de bug','Sem consultar o texto: por que testar com um único worker pode ajudar? Responda em inglês.','It helps isolate shared state or concurrency as the cause.', $3,$4,'editorial_example')",
      [
        userId,
        source.id,
        JSON.stringify(ids),
        JSON.stringify(exampleVocabulary),
      ],
    );
    return { id: source.id };
  });
}
async function uploadBytes(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("EMPTY_UPLOAD", "Selecione um arquivo.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "O arquivo deve ter até 25 MB.",
        413,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
const signed = (value: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(value)
    .digest("base64url");

export async function handle(request: Request, parts: string[]) {
  const requestId = randomUUID();
  try {
    const user = await owner(request),
      uid = user.id,
      method = request.method,
      [resource, id, action] = parts;
    const url = new URL(request.url),
      key = request.headers.get("Idempotency-Key");
    if (resource === "bootstrap" && method === "GET") {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, uid));
      const sources = await query(
        "SELECT s.*,(SELECT count(*)::int FROM segments WHERE source_id=s.id) AS segment_count FROM sources s WHERE user_id=$1 ORDER BY created_at DESC",
        [uid],
      );
      const session =
        (
          await query(
            "SELECT * FROM study_sessions WHERE user_id=$1 AND completed_at IS NULL",
            [uid],
          )
        )[0] ?? null;
      const [due] = await query(
        "SELECT count(*)::int AS count FROM cards WHERE user_id=$1 AND due<=now()",
        [uid],
      );
      return json({
        user: { id: uid, name: user.name, email: user.email },
        profile,
        sources,
        session,
        due: due.count,
        progress: await progress(uid),
        usage: await usage(uid),
        integrations: integrationStatus(),
        scenarios,
      });
    }
    if (resource === "profile" && method === "PATCH") {
      const input = z
        .object({
          interests: z.array(z.string().max(50)).max(12),
          goal: z.string().min(1).max(300),
          weeklyGoal: z.number().int().min(1).max(7),
          sessionMinutes: z.union([
            z.literal(10),
            z.literal(25),
            z.literal(45),
          ]),
          difficulty: z.enum(["A1", "A2", "B1", "B2", "C1"]),
          englishVariant: z.enum(["en-US", "en-GB"]),
          theme: z.enum(["system", "light", "dark"]),
          onboarded: z.boolean(),
          monthlyLimitCents: z.number().int().min(0).max(100000),
          alertCents: z.number().int().min(0).max(100000),
          shortcutsEnabled: z.boolean(),
        })
        .partial()
        .parse(await body(request));
      await db.update(profiles).set(input).where(eq(profiles.userId, uid));
      return json({ saved: true });
    }
    if (resource === "diagnostic" && method === "POST") {
      const input = z
        .object({ answer: z.enum(["isolate", "delete", "deploy"]) })
        .parse(await body(request));
      const diagnostic = {
        readingCorrect: input.answer === "isolate",
        readingTotal: 1,
        readingLabel: "Exercício inicial de leitura; não determina nível CEFR",
        speech: "not_assessed",
        listening: "not_assessed",
        evaluatedAt: new Date().toISOString(),
        version: "1",
      };
      await db
        .update(profiles)
        .set({ diagnostic })
        .where(eq(profiles.userId, uid));
      return json(diagnostic);
    }
    if (resource === "example" && method === "POST")
      return json(await importExample(uid, key), 201);
    if (resource === "media" && method === "POST") {
      const input = z
        .object({
          title: z.string().min(1).max(200),
          author: z.string().min(1).max(120),
          rights: z.enum(["owned", "licensed"]),
          consent: z.literal("true"),
        })
        .parse(Object.fromEntries(url.searchParams));
      const bytes = await uploadBytes(request, 25_000_000);
      const media = await inspectMedia(bytes, 1800);
      const fileKey = await storage.put(uid, bytes);
      try {
        const result = await idempotent(
          uid,
          "media",
          key,
          { ...input, size: bytes.length },
          async (c) => {
            const source = (
              await c.query(
                "INSERT INTO sources(user_id,kind,title,author,rights,status,file_key,duration_ms) VALUES($1,'media',$2,$3,$4,'no_transcript',$5,$6) RETURNING id",
                [
                  uid,
                  input.title,
                  input.author,
                  input.rights,
                  fileKey,
                  media.durationMs,
                ],
              )
            ).rows[0];
            return { sourceId: source.id, fileKey };
          },
        );
        if (result.fileKey !== fileKey) await storage.remove(fileKey);
        return json({ sourceId: result.sourceId }, 201);
      } catch (e) {
        await storage.remove(fileKey);
        throw e;
      }
    }
    if (resource === "sources" && !id && method === "POST") {
      const input = sourceInput.parse(await body(request));
      if (input.kind === "media")
        throw new AppError(
          "UPLOAD_REQUIRED",
          "Use o envio de arquivo para áudio ou vídeo.",
        );
      const videoId =
        input.kind === "youtube" ? youtubeId(input.url || "") : null;
      if (input.transcriptionMode === "ai") {
        requireAI();
        if (!videoId || input.rights !== "public_link" || input.text)
          throw new AppError(
            "INVALID_TRANSCRIPTION_INTENT",
            "A transcrição automática exige apenas um link público do YouTube.",
          );
      }
      if (input.text && input.rights === "public_link")
        throw new AppError(
          "RIGHTS_REQUIRED",
          "Para importar texto, confirme autoria ou licença.",
        );
      const segments = input.text ? parseContent(input.text) : [];
      if (input.kind === "text" && !segments.length)
        throw new AppError(
          "EMPTY_CONTENT",
          "Adicione o texto que deseja estudar.",
        );
      const result = await idempotent(uid, "source", key, input, async (c) => {
        const existing = videoId
          ? (
              await c.query(
                "SELECT id FROM sources WHERE user_id=$1 AND video_id=$2",
                [uid, videoId],
              )
            ).rows[0]
          : null;
        if (existing) return { sourceId: existing.id, existing: true };
        const source = (
          await c.query(
            "INSERT INTO sources(user_id,kind,title,author,language,url,video_id,rights,status,transcription_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
            [
              uid,
              input.kind,
              input.title,
              input.author,
              input.language,
              videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
              videoId,
              input.rights,
              segments.length ? "text_ready" : "no_transcript",
              input.transcriptionMode,
            ],
          )
        ).rows[0];
        for (let i = 0; i < segments.length; i++) {
          const s = segments[i];
          await c.query(
            "INSERT INTO segments(source_id,ordinal,start_ms,end_ms,text,origin,time_accuracy) VALUES($1,$2,$3,$4,$5,'user_upload',$6)",
            [source.id, i, s.startMs, s.endMs, s.text, s.timeAccuracy],
          );
        }
        const jobStatus =
          (videoId && integrationStatus().youtube) ||
          (integrationStatus().ai && segments.length)
            ? "queued"
            : segments.length
              ? "awaiting_configuration"
              : "no_transcript";
        const job = (
          await c.query(
            "INSERT INTO jobs(user_id,source_id,kind,status,error_message) VALUES($1,$2,'prepare',$3,$4) RETURNING id",
            [
              uid,
              source.id,
              jobStatus,
              jobStatus === "queued"
                ? null
                : jobStatus === "no_transcript"
                  ? "Adicione uma legenda autorizada para estudar os trechos."
                  : integrationStatus().message,
            ],
          )
        ).rows[0];
        await c.query("INSERT INTO job_events(job_id,data) VALUES($1,$2)", [
          job.id,
          JSON.stringify({
            status: jobStatus,
          }),
        ]);
        return { sourceId: source.id, jobId: job.id };
      });
      return json(result, 202);
    }
    if (resource === "sources" && id) {
      const source = await sourceFor(uid, id);
      if (method === "GET" && !action) {
        const segments = await query(
          "SELECT * FROM segments WHERE source_id=$1 ORDER BY ordinal LIMIT 100",
          [id],
        );
        const units = await query(
          "SELECT id,title,objective,prompt,kind,segment_ids,vocabulary,provenance FROM learning_units WHERE source_id=$1 AND user_id=$2 ORDER BY created_at",
          [id, uid],
        );
        const jobs = await query(
          "SELECT * FROM jobs WHERE source_id=$1 ORDER BY created_at DESC LIMIT 5",
          [id],
        );
        let transcriptionEstimate: {
          available: boolean;
          amount: number | null;
          remaining: number | null;
          durationLimitMs: number;
          reason: string | null;
        } = {
          available: false,
          amount: null,
          remaining: null,
          durationLimitMs: MAX_VIDEO_TRANSCRIPTION_MS,
          reason: integrationStatus().message,
        };
        if (source.kind === "youtube" && integrationStatus().ai) {
          const accountUsage = await usage(uid);
          const videoStatus = videoIntegrationStatus();
          const inputPrice = videoStatus.input;
          const outputPrice = videoStatus.output;
          const remaining = Math.max(
            0,
            accountUsage.limit - accountUsage.confirmed - accountUsage.reserved,
          );
          try {
            validateVideoTranscriptionDuration(Number(source.duration_ms));
            if (!videoStatus.ready)
              throw new AppError(
                "PRICES_REVIEW_REQUIRED",
                "Revise os preços do modelo de vídeo antes de transcrever.",
              );
            const amountMicros = videoTranscriptionEstimateMicros(
              Number(source.duration_ms),
              inputPrice,
              outputPrice,
            );
            const amount = amountMicros / 1e6;
            const reason =
              source.status === "unavailable"
                ? "O vídeo não está disponível para incorporação."
                : source.rights !== "public_link"
                  ? "Confirme o uso do link público."
                  : segments.length
                    ? "Esta fonte já possui uma transcrição."
                    : amount > remaining
                      ? "O limite mensal disponível é insuficiente."
                      : null;
            transcriptionEstimate = {
              available: !reason,
              amount,
              remaining,
              durationLimitMs: MAX_VIDEO_TRANSCRIPTION_MS,
              reason,
            };
          } catch (error) {
            transcriptionEstimate = {
              available: false,
              amount: null,
              remaining,
              durationLimitMs: MAX_VIDEO_TRANSCRIPTION_MS,
              reason:
                error instanceof AppError
                  ? error.message
                  : "Não foi possível estimar a transcrição.",
            };
          }
        }
        return json({ source, segments, units, jobs, transcriptionEstimate });
      }
      if (method === "GET" && action === "segments") {
        const cursor = Math.max(0, Number(url.searchParams.get("cursor") || 0));
        return json(
          await query(
            "SELECT * FROM segments WHERE source_id=$1 AND ordinal>=$2 ORDER BY ordinal LIMIT 100",
            [id, cursor],
          ),
        );
      }
      if (method === "PATCH" && !action) {
        const v = z
          .object({ positionMs: z.number().int().min(0).max(86400000) })
          .parse(await body(request));
        await query(
          "UPDATE sources SET position_ms=$3,updated_at=now() WHERE id=$1 AND user_id=$2",
          [id, uid, v.positionMs],
        );
        return json({ saved: true });
      }
      if (method === "POST" && action === "prepare") {
        if (source.status === "unavailable")
          throw new AppError(
            "SOURCE_UNAVAILABLE",
            "O vídeo não está disponível para incorporação.",
          );
        requireAI();
        if (
          !(
            await query("SELECT 1 FROM segments WHERE source_id=$1 LIMIT 1", [
              id,
            ])
          ).length
        )
          throw new AppError(
            "NO_TRANSCRIPT",
            "Adicione uma legenda autorizada antes de preparar uma atividade.",
          );
        return json(
          await idempotent(uid, "prepare", key, { id }, async (c) => {
            const j = (
              await c.query(
                "INSERT INTO jobs(user_id,source_id,kind) VALUES($1,$2,'prepare') RETURNING id",
                [uid, id],
              )
            ).rows[0];
            return { jobId: j.id };
          }),
          202,
        );
      }
      if (method === "POST" && action === "transcribe") {
        requireAI();
        z.object({ consent: z.literal(true) }).parse(await body(request));
        if (source.kind !== "youtube" || !source.video_id || !source.url)
          throw new AppError(
            "INVALID_VIDEO_SOURCE",
            "A transcrição por URL exige um vídeo válido do YouTube.",
          );
        if (source.status === "unavailable")
          throw new AppError(
            "SOURCE_UNAVAILABLE",
            "O vídeo não está disponível para incorporação.",
          );
        if (source.rights !== "public_link")
          throw new AppError(
            "RIGHTS_REQUIRED",
            "Confirme o uso do link público antes de transcrever.",
          );
        validateVideoTranscriptionDuration(Number(source.duration_ms));
        return json(
          await idempotent(uid, "transcribe", key, { id }, async (c) => {
            await sourceFor(uid, id, c);
            if (
              (
                await c.query(
                  "SELECT 1 FROM segments WHERE source_id=$1 LIMIT 1",
                  [id],
                )
              ).rowCount
            )
              throw new AppError(
                "TRANSCRIPT_EXISTS",
                "Esta fonte já possui uma transcrição.",
              );
            const active = (
              await c.query(
                "SELECT id FROM jobs WHERE source_id=$1 AND kind='transcribe' AND status IN ('queued','processing') ORDER BY created_at DESC LIMIT 1",
                [id],
              )
            ).rows[0];
            if (active) return { jobId: active.id, existing: true };
            const job = (
              await c.query(
                "INSERT INTO jobs(user_id,source_id,kind,status,total,payload) VALUES($1,$2,'transcribe','queued',3,$3) RETURNING id",
                [
                  uid,
                  id,
                  JSON.stringify({
                    videoId: source.video_id,
                    durationMs: source.duration_ms,
                    consentAt: new Date().toISOString(),
                  }),
                ],
              )
            ).rows[0];
            await c.query(
              "UPDATE sources SET status='transcribing',transcription_mode='ai',transcription_requested_at=now(),updated_at=now() WHERE id=$1",
              [id],
            );
            await c.query("INSERT INTO job_events(job_id,data) VALUES($1,$2)", [
              job.id,
              JSON.stringify({ status: "queued", completed: 0, total: 3 }),
            ]);
            return { jobId: job.id };
          }),
          202,
        );
      }
      if (method === "POST" && action === "segments") {
        // `public_link` entrou em 2026-09-17 (ADR-004). Antes só existiam
        // `owned` e `licensed`, então anexar a legenda automática de um vídeo
        // público exigia declarar que o material era do proprietário ou
        // licenciado para ele, e ainda carimbava os trechos como `user_upload`:
        // três afirmações falsas gravadas justamente nos campos que existem
        // para registrar a origem. O caso agora tem rótulo próprio, e o preço
        // de tê-lo é dizer o que ele é — legenda do provedor, não revisada.
        const v = z
          .object({
            text: z.string().max(500000),
            rights: z.enum(["owned", "licensed", "public_link"]),
          })
          .parse(await body(request));
        const publicCaption = v.rights === "public_link";
        // Não é um caminho para reclassificar fonte: só vale onde o link
        // público já era o direito declarado na criação da fonte.
        if (publicCaption && source.rights !== "public_link")
          throw new AppError(
            "RIGHTS_MISMATCH",
            "Legenda de vídeo público só pode ser anexada a uma fonte já registrada como link público.",
          );
        const parsed = parseContent(v.text);
        if (!parsed.length)
          throw new AppError(
            "EMPTY_CONTENT",
            "Adicione uma legenda com texto antes de salvar.",
          );
        return json(
          await idempotent(uid, "segments", key, { id, ...v }, async (c) => {
            await c.query("SELECT id FROM sources WHERE id=$1 FOR UPDATE", [
              id,
            ]);
            const next = Number(
              (
                await c.query(
                  "SELECT coalesce(max(ordinal),-1)+1 AS n FROM segments WHERE source_id=$1",
                  [id],
                )
              ).rows[0].n,
            );
            for (let i = 0; i < parsed.length; i++) {
              const s = parsed[i];
              await c.query(
                "INSERT INTO segments(source_id,ordinal,start_ms,end_ms,text,origin,time_accuracy,quality_status,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
                [
                  id,
                  next + i,
                  s.startMs,
                  s.endMs,
                  s.text,
                  publicCaption ? "public_caption" : "user_upload",
                  s.timeAccuracy,
                  // Legenda de provedor é transcrição de máquina: entra com o
                  // mesmo estado que a do Gemini, para não virar cartão sem
                  // alguém ter lido.
                  publicCaption ? "ai_unreviewed" : "user_supplied",
                  source.revision + 1,
                ],
              );
            }
            await c.query(
              "UPDATE sources SET revision=revision+1,rights=$2,status=CASE WHEN status='unavailable' THEN status ELSE 'text_ready' END WHERE id=$1",
              [id, v.rights],
            );
            return { saved: true };
          }),
        );
      }
      if (method === "GET" && action === "media" && source.file_key)
        return mediaResponse(request, source.file_key);
      if (method === "DELETE" && !action) {
        if (source.file_key) await storage.remove(source.file_key);
        await query("DELETE FROM sources WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
        return json({ deleted: true });
      }
    }
    if (resource === "jobs" && id) {
      z.string().uuid().parse(id);
      const job = (
        await query("SELECT * FROM jobs WHERE id=$1 AND user_id=$2", [id, uid])
      )[0];
      if (!job) throw new AppError("NOT_FOUND", "Preparo não encontrado.", 404);
      if (method === "DELETE") {
        await query(
          "UPDATE jobs SET status='cancelled',updated_at=now() WHERE id=$1",
          [id],
        );
        return json({ cancelled: true });
      }
      if (method === "GET" && action === "events") {
        const after = Number(
          request.headers.get("Last-Event-ID") ||
            url.searchParams.get("after") ||
            0,
        );
        const events = await query(
          "SELECT id,data FROM job_events WHERE job_id=$1 AND id>$2 ORDER BY id LIMIT 100",
          [id, Number.isSafeInteger(after) ? after : 0],
        );
        const stream =
          events
            .map((e) => `id: ${e.id}\ndata: ${JSON.stringify(e.data)}\n\n`)
            .join("") +
          `event: state\ndata: ${JSON.stringify(job)}\n\nretry: 5000\n\n`;
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      }
      if (method === "GET") return json(job);
    }
    if (resource === "sessions") {
      if (method === "POST" && !id) {
        const input = z
          .object({
            sourceId: z.string().uuid().optional(),
            duration: z
              .union([z.literal(10), z.literal(25), z.literal(45)])
              .default(25),
          })
          .parse(await body(request));
        if (input.sourceId) await sourceFor(uid, input.sourceId);
        const session = (
          await query(
            "INSERT INTO study_sessions(user_id,source_id,duration_minutes) VALUES($1,$2,$3) ON CONFLICT(user_id) WHERE completed_at IS NULL DO UPDATE SET source_id=coalesce(excluded.source_id,study_sessions.source_id) RETURNING *",
            [uid, input.sourceId || null, input.duration],
          )
        )[0];
        return json(session);
      }
      if (method === "PATCH" && id) {
        const input = z
          .object({
            stage: z
              .enum(["understand", "recall", "speak", "review", "close"])
              .optional(),
            context: z
              .object({
                tab: z.enum(["expression", "tutor", "activity"]).optional(),
                segment: z.string().uuid().optional(),
                immersion: z.boolean().optional(),
              })
              .optional(),
            complete: z.boolean().optional(),
          })
          .parse(await body(request));
        const result = await query(
          "UPDATE study_sessions SET stage=coalesce($3,stage),context=coalesce($4,context),completed_at=CASE WHEN $5 THEN coalesce(completed_at,now()) ELSE completed_at END WHERE id=$1 AND user_id=$2 RETURNING *",
          [
            id,
            uid,
            input.stage || null,
            input.context ? JSON.stringify(input.context) : null,
            input.complete || false,
          ],
        );
        if (!result[0])
          throw new AppError("NOT_FOUND", "Sessão não encontrada.", 404);
        return json(result[0]);
      }
    }
    if (resource === "cards" && !id && method === "POST") {
      const input = cardInput.parse(await body(request));
      if (input.sourceId) await sourceFor(uid, input.sourceId);
      if (
        input.segmentId &&
        !(
          await query(
            "SELECT 1 FROM segments s JOIN sources p ON p.id=s.source_id WHERE s.id=$1 AND p.user_id=$2 AND ($3::uuid IS NULL OR p.id=$3)",
            [input.segmentId, uid, input.sourceId || null],
          )
        ).length
      )
        throw new AppError("NOT_FOUND", "Trecho não encontrado.", 404);
      return json(
        await idempotent(uid, "card", key, input, async (c) => {
          const card = initialCard();
          const row = (
            await c.query(
              "INSERT INTO cards(user_id,source_id,segment_id,expression,normalized_expression,meaning,normalized_meaning,example,language,mode,fsrs_state,fsrs_version,due) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(user_id,language,normalized_expression,normalized_meaning,mode) DO UPDATE SET expression=cards.expression RETURNING *",
              [
                uid,
                input.sourceId || null,
                input.segmentId || null,
                input.expression,
                normalize(input.expression),
                input.meaning,
                normalize(input.meaning),
                input.example,
                input.language,
                input.mode,
                JSON.stringify(card),
                FSRS_CONFIG_VERSION,
                card.due,
              ],
            )
          ).rows[0];
          return row;
        }),
        201,
      );
    }
    if (resource === "cards" && id && method === "DELETE") {
      await query("DELETE FROM cards WHERE id=$1 AND user_id=$2", [id, uid]);
      return json({ deleted: true });
    }
    if (resource === "reviews" && !id && method === "GET") {
      const cards = await query(
        "SELECT c.*,s.title AS source_title FROM cards c LEFT JOIN sources s ON s.id=c.source_id WHERE c.user_id=$1 AND c.due<=now() ORDER BY c.due LIMIT 100",
        [uid],
      );
      const all = (
        await query(
          "SELECT count(*)::int AS count,min(due) AS next_due FROM cards WHERE user_id=$1",
          [uid],
        )
      )[0];
      return json({ cards, ...all });
    }
    if (
      resource === "reviews" &&
      id &&
      action === "answer" &&
      method === "POST"
    ) {
      const input = z
        .object({
          rating: z.number().int().min(1).max(4),
          version: z.number().int().min(0),
        })
        .parse(await body(request));
      return json(
        await idempotent(uid, "review", key, { id, ...input }, async (c) => {
          const card = (
            await c.query(
              "SELECT * FROM cards WHERE id=$1 AND user_id=$2 FOR UPDATE",
              [id, uid],
            )
          ).rows[0];
          if (!card)
            throw new AppError("NOT_FOUND", "Cartão não encontrado.", 404);
          if (card.version !== input.version)
            throw new AppError(
              "VERSION_CONFLICT",
              "Esta revisão mudou em outra aba. Atualize a fila.",
              409,
            );
          if (new Date(card.due) > new Date())
            throw new AppError(
              "NOT_DUE",
              "Este cartão ainda não está previsto para revisão.",
              409,
            );
          const next = scheduleCard(card.fsrs_state, input.rating);
          const event = (
            await c.query(
              "INSERT INTO review_events(user_id,card_id,rating,previous_state,next_state,review_log,version_before) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
              [
                uid,
                id,
                input.rating,
                JSON.stringify(card.fsrs_state),
                JSON.stringify(next.card),
                JSON.stringify(next.log),
                card.version,
              ],
            )
          ).rows[0];
          await c.query(
            "UPDATE cards SET fsrs_state=$3,due=$4,version=version+1 WHERE id=$1 AND user_id=$2",
            [id, uid, JSON.stringify(next.card), next.card.due],
          );
          await award(c, uid, event.id, "due_review", 5);
          return {
            eventId: event.id,
            due: next.card.due,
            version: card.version + 1,
          };
        }),
      );
    }
    if (resource === "reviews" && id && action === "undo" && method === "POST")
      return json(
        await idempotent(uid, "undo", key, { id }, async (c) => {
          const event = (
            await c.query(
              "SELECT * FROM review_events WHERE id=$1 AND user_id=$2 FOR UPDATE",
              [id, uid],
            )
          ).rows[0];
          if (!event || event.undone)
            throw new AppError(
              "UNDO_UNAVAILABLE",
              "Esta resposta já foi corrigida ou não existe.",
              409,
            );
          const card = (
            await c.query(
              "SELECT * FROM cards WHERE id=$1 AND user_id=$2 FOR UPDATE",
              [event.card_id, uid],
            )
          ).rows[0];
          if (card.version !== event.version_before + 1)
            throw new AppError(
              "VERSION_CONFLICT",
              "Há uma revisão mais recente deste cartão.",
              409,
            );
          await c.query(
            "UPDATE cards SET fsrs_state=$2,due=$3,version=version+1 WHERE id=$1",
            [
              card.id,
              JSON.stringify(event.previous_state),
              event.previous_state.due,
            ],
          );
          await c.query("UPDATE review_events SET undone=true WHERE id=$1", [
            id,
          ]);
          await award(c, uid, id, "review_undo", -5);
          return { saved: true };
        }),
      );
    if (resource === "attempts" && !id && method === "POST") {
      const input = z
        .object({
          activityId: z.string().uuid().optional(),
          scenario: z
            .enum(["daily", "debugging", "review", "everyday", "weekly"])
            .optional(),
          kind: z.enum(["text", "speaking", "retry"]),
          response: z.string().trim().min(1).max(8000),
          recordingId: z.string().uuid().optional(),
          helpUsed: z.boolean().default(false),
          retryOf: z.string().uuid().optional(),
          reflection: z.string().trim().max(1000).optional(),
        })
        .parse(await body(request));
      return json(
        await idempotent(uid, "attempt", key, input, async (c) => {
          const unit = input.activityId
            ? (
                await c.query(
                  "SELECT * FROM learning_units WHERE id=$1 AND user_id=$2",
                  [input.activityId, uid],
                )
              ).rows[0]
            : null;
          if (input.activityId && !unit)
            throw new AppError("NOT_FOUND", "Atividade não encontrada.", 404);
          if (!unit && !input.scenario)
            throw new AppError(
              "ACTIVITY_REQUIRED",
              "Escolha um cenário ou atividade.",
            );
          if (input.kind === "speaking" && !input.recordingId)
            throw new AppError(
              "RECORDING_REQUIRED",
              "Envie a gravação antes de registrar a tentativa.",
            );
          const previous = input.retryOf
            ? (
                await c.query(
                  "SELECT * FROM attempts WHERE id=$1 AND user_id=$2",
                  [input.retryOf, uid],
                )
              ).rows[0]
            : null;
          if (
            input.kind === "retry" &&
            (!previous || !input.recordingId || !input.reflection)
          )
            throw new AppError(
              "RETRY_REFLECTION_REQUIRED",
              "Antes de tentar novamente, registre o ponto que você quer melhorar.",
            );
          if (
            input.recordingId &&
            !(
              await c.query(
                "SELECT id FROM recordings WHERE id=$1 AND user_id=$2",
                [input.recordingId, uid],
              )
            ).rowCount
          )
            throw new AppError("NOT_FOUND", "Gravação não encontrada.", 404);
          const feedback =
            unit?.provenance === "editorial_example"
              ? {
                  reference: unit.expected_answer,
                  label:
                    "Resposta de referência do material de exemplo. Sua resposta não recebeu avaliação automática.",
                }
              : null;
          const attempt = (
            await c.query(
              "INSERT INTO attempts(user_id,activity_id,recording_id,kind,response,help_used,feedback,scenario,retry_of,reflection) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
              [
                uid,
                input.activityId || null,
                input.recordingId || null,
                input.kind,
                input.response,
                input.helpUsed,
                feedback ? JSON.stringify(feedback) : null,
                input.scenario || null,
                input.retryOf || null,
                input.reflection || null,
              ],
            )
          ).rows[0];
          const studyDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
          }).format(new Date());
          const origin = unit?.id || `${input.scenario}:${studyDay}`;
          if (input.kind === "speaking")
            await award(c, uid, origin, "oral_attempt", 10);
          else if (input.kind === "retry")
            await award(
              c,
              uid,
              previous.retry_of || previous.id,
              "retry_reflection",
              5,
            );
          else if (feedback)
            await award(c, uid, origin, "exercise_with_reference", 10);
          await c.query(
            "INSERT INTO skill_evidence(user_id,attempt_id,skill,description,provenance) VALUES($1,$2,$3,$4,$5)",
            [
              uid,
              attempt.id,
              input.recordingId ? "Expressão oral" : "Construção de frases",
              input.recordingId
                ? "Registrou uma tentativa de fala. Avaliação de autonomia ainda pendente."
                : "Produziu uma resposta escrita. Domínio ainda não avaliado.",
              "participation_only",
            ],
          );
          return attempt;
        }),
        201,
      );
    }
    if (resource === "challenges" && id === "weekly" && method === "POST") {
      const input = z
        .object({
          attemptId: z.string().uuid(),
          reflection: z.string().trim().min(10).max(1000),
        })
        .parse(await body(request));
      return json(
        await idempotent(uid, "weekly", key, input, async (c) => {
          const attempt = (
            await c.query(
              "SELECT * FROM attempts WHERE id=$1 AND user_id=$2 AND scenario='weekly' AND recording_id IS NOT NULL",
              [input.attemptId, uid],
            )
          ).rows[0];
          if (!attempt)
            throw new AppError(
              "ATTEMPT_REQUIRED",
              "Grave uma tentativa do desafio semanal antes de concluí-lo.",
            );
          const week = (
            await c.query(
              "SELECT date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS week",
            )
          ).rows[0].week;
          const challenge = (
            await c.query(
              "INSERT INTO weekly_challenges(user_id,week,attempt_id,reflection) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,week) DO UPDATE SET week=excluded.week RETURNING *",
              [uid, week, input.attemptId, input.reflection],
            )
          ).rows[0];
          await award(c, uid, challenge.id, "weekly_challenge", 30);
          return { saved: true, challengeId: challenge.id };
        }),
      );
    }
    if (
      resource === "recordings" &&
      id === "upload-intent" &&
      method === "POST"
    ) {
      const input = z
        .object({
          mime: z.string().max(100),
          size: z.number().int().positive().max(25_000_000),
          durationMs: z.number().int().positive().max(90000),
          consent: z.literal(true),
          preserve: z.boolean().default(false),
          activityId: z.string().uuid().optional(),
          sourceId: z.string().uuid().optional(),
        })
        .parse(await body(request));
      if (input.sourceId) await sourceFor(uid, input.sourceId);
      if (
        input.activityId &&
        !(
          await query(
            "SELECT 1 FROM learning_units WHERE id=$1 AND user_id=$2",
            [input.activityId, uid],
          )
        ).length
      )
        throw new AppError("NOT_FOUND", "Atividade não encontrada.", 404);
      const token = Buffer.from(
        JSON.stringify({
          ...input,
          userId: uid,
          id: randomUUID(),
          expires: Date.now() + 300000,
        }),
      ).toString("base64url");
      return json({
        uploadUrl: `/api/recordings/upload?token=${token}.${signed(token)}`,
      });
    }
    if (resource === "recordings" && id === "upload" && method === "PUT") {
      const [token, sig] = String(url.searchParams.get("token")).split(".");
      if (!token || sig !== signed(token))
        throw new AppError(
          "INVALID_UPLOAD",
          "Autorização de envio inválida.",
          403,
        );
      const info = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
      if (info.userId !== uid || info.expires < Date.now())
        throw new AppError(
          "UPLOAD_EXPIRED",
          "O envio expirou. Tente salvar novamente.",
          403,
        );
      if (
        (
          await query("SELECT id FROM recordings WHERE id=$1 AND user_id=$2", [
            info.id,
            uid,
          ])
        ).length
      )
        return json({ id: info.id });
      const bytes = await uploadBytes(request, info.size);
      if (bytes.length !== info.size)
        throw new AppError(
          "UPLOAD_SIZE",
          "O tamanho do arquivo não corresponde ao envio.",
        );
      const media = await inspectMedia(bytes, 90, true);
      const fileKey = await storage.put(uid, bytes);
      try {
        await query(
          "INSERT INTO recordings(id,user_id,source_id,activity_id,file_key,mime_type,size_bytes,duration_ms,preserve) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            info.id,
            uid,
            info.sourceId || null,
            info.activityId || null,
            fileKey,
            media.mime,
            bytes.length,
            media.durationMs,
            info.preserve,
          ],
        );
      } catch (e) {
        await storage.remove(fileKey);
        throw e;
      }
      return json({ id: info.id }, 201);
    }
    if (resource === "recordings" && !id && method === "GET")
      return json(
        await query(
          "SELECT id,source_id,activity_id,duration_ms,preserve,expires_at,created_at FROM recordings WHERE user_id=$1 ORDER BY created_at DESC",
          [uid],
        ),
      );
    if (resource === "recordings" && id) {
      const rec = (
        await query("SELECT * FROM recordings WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ])
      )[0];
      if (!rec)
        throw new AppError("NOT_FOUND", "Gravação não encontrada.", 404);
      if (method === "GET" && action === "audio")
        return mediaResponse(request, rec.file_key, rec.mime_type);
      if (method === "DELETE") {
        await storage.remove(rec.file_key);
        await query("DELETE FROM recordings WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
        return json({ deleted: true });
      }
      if (method === "PATCH") {
        const v = z
          .object({ preserve: z.boolean() })
          .parse(await body(request));
        await query(
          "UPDATE recordings SET preserve=$3,expires_at=now()+interval '7 days' WHERE id=$1 AND user_id=$2",
          [id, uid, v.preserve],
        );
        return json({ saved: true });
      }
      if (method === "POST" && action === "assess") {
        requireAI();
        const existing = (
          await query(
            "SELECT feedback FROM attempts WHERE recording_id=$1 AND user_id=$2 AND evaluator<>'self_recorded' LIMIT 1",
            [id, uid],
          )
        )[0];
        if (existing) return json(existing.feedback);
        const feedback = await assessSpeech(
          uid,
          await storage.get(rec.file_key),
          rec.mime_type,
          "Explain the situation and your next step.",
        );
        if (
          (
            await query("SELECT 1 FROM deletion_requests WHERE user_id=$1", [
              uid,
            ])
          ).length
        )
          throw new AppError("ACCOUNT_DELETING", "Exclusão em andamento.", 403);
        await query(
          "UPDATE attempts SET feedback=$3,evaluator=$4 WHERE recording_id=$1 AND user_id=$2",
          [id, uid, JSON.stringify(feedback), integrationStatus().model],
        );
        return json(feedback);
      }
    }
    if (
      resource === "lessons" &&
      id &&
      action === "tutor" &&
      method === "POST"
    ) {
      requireAI();
      const input = z
        .object({ question: z.string().min(1).max(2000) })
        .parse(await body(request));
      const unit = (
        await query("SELECT * FROM learning_units WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ])
      )[0];
      if (!unit)
        throw new AppError("NOT_FOUND", "Atividade não encontrada.", 404);
      const segs = await query(
        "SELECT text FROM segments WHERE source_id=$1 ORDER BY ordinal LIMIT 8",
        [unit.source_id],
      );
      let cancelled = false;
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          async start(controller) {
            const send = (event: string, value: unknown) => {
              if (!cancelled)
                controller.enqueue(
                  encoder.encode(
                    `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`,
                  ),
                );
            };
            try {
              const text = await streamTutor(
                uid,
                segs.map((s) => s.text).join("\n"),
                input.question,
                (chunk) => send("text", { text: chunk }),
              );
              await query(
                "INSERT INTO tutor_messages(user_id,unit_id,role,content) SELECT $1,$2,'assistant',$3 WHERE NOT EXISTS(SELECT 1 FROM deletion_requests WHERE user_id=$1)",
                [uid, id, text],
              );
              send("done", {});
            } catch (e) {
              send("error", {
                message:
                  e instanceof AppError
                    ? e.message
                    : "A resposta foi interrompida. Nenhuma avaliação foi salva.",
              });
            } finally {
              if (!cancelled) controller.close();
            }
          },
          cancel() {
            cancelled = true;
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        },
      );
    }
    if (
      resource === "segments" &&
      id &&
      action === "translate" &&
      method === "POST"
    ) {
      const segment = (
        await query(
          "SELECT s.* FROM segments s JOIN sources p ON p.id=s.source_id WHERE s.id=$1 AND p.user_id=$2",
          [id, uid],
        )
      )[0];
      if (!segment)
        throw new AppError("NOT_FOUND", "Trecho não encontrado.", 404);
      if (segment.support)
        return json({ support: segment.support, origin: segment.origin });
      // Apoio gerado antes da migração 005: texto corrido, sem os quatro
      // campos. Continua sendo devolvido como está — regenerar custaria uma
      // chamada de IA para cada trecho já traduzido.
      if (segment.translation)
        return json({
          legacyText: segment.translation,
          origin: segment.origin,
        });
      requireAI();
      const support = await textAI.support(uid, segment.text);
      await query("UPDATE segments SET support=$2 WHERE id=$1", [
        id,
        JSON.stringify(support),
      ]);
      return json({ support, origin: integrationStatus().provider });
    }
    if (resource === "usage" && method === "GET") return json(await usage(uid));
    if (resource === "progress" && method === "GET")
      return json(await progress(uid));
    if (
      resource === "account" &&
      action === undefined &&
      id === "export" &&
      method === "GET"
    ) {
      const tables = [
        "learner_profiles",
        "sources",
        "learning_units",
        "study_sessions",
        "cards",
        "review_events",
        "attempts",
        "skill_evidence",
        "xp_events",
        "weekly_challenges",
        "usage_events",
      ];
      const data: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        formatVersion: 1,
      };
      for (const table of tables)
        data[table] = await query(`SELECT * FROM ${table} WHERE user_id=$1`, [
          uid,
        ]);
      data.segments = await query(
        "SELECT s.* FROM segments s JOIN sources p ON p.id=s.source_id WHERE p.user_id=$1 AND (p.rights='owned' OR p.is_example)",
        [uid],
      );
      data.recordings = await query(
        "SELECT id,duration_ms,preserve,created_at FROM recordings WHERE user_id=$1",
        [uid],
      );
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="fluentquest-export.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (resource === "account" && method === "DELETE") {
      const input = z
        .object({ confirm: z.literal("EXCLUIR") })
        .parse(await body(request));
      void input;
      await transaction(async (c) => {
        await c.query(
          "INSERT INTO deletion_requests(user_id) VALUES($1) ON CONFLICT DO NOTHING",
          [uid],
        );
        await c.query("UPDATE jobs SET status='cancelled' WHERE user_id=$1", [
          uid,
        ]);
        await c.query('DELETE FROM "session" WHERE "userId"=$1', [uid]);
      });
      return json({ deleting: true, backupRetentionDays: 30 }, 202);
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
      "API_ERROR",
      requestId,
      error instanceof Error ? error.name : "Unknown",
    );
    return json(
      {
        code: "INTERNAL_ERROR",
        message:
          "Não foi possível concluir. Tente novamente; se persistir, verifique o banco e o worker.",
        retryable: true,
        requestId,
      },
      500,
    );
  }
}
async function mediaResponse(request: Request, key: string, mime?: string) {
  const bytes = await storage.get(key);
  const type =
    mime ||
    (await fileTypeFromBuffer(bytes))?.mime ||
    "application/octet-stream";
  const range = request.headers.get("range");
  const headers = {
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  };
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416 });
    const start = Number(match[1]),
      end = match[2]
        ? Math.min(Number(match[2]), bytes.length - 1)
        : bytes.length - 1;
    if (start > end || start >= bytes.length)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${bytes.length}` },
      });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(new Uint8Array(bytes), {
    headers: { ...headers, "Content-Length": String(bytes.length) },
  });
}

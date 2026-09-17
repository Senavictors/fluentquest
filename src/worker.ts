import { boss, dispatchJobs, emitJob, QUEUE } from "./server/queue";
import { pool, query, transaction } from "./server/db";
import {
  gemini,
  integrationStatus,
  textAI,
  videoIntegrationStatus,
  youtube,
} from "./server/providers";
import { refreshCredentials } from "./server/credentials";
import { AppError, validateVideoTranscriptionDuration } from "./domain/content";
import { removeUserObjects, storage } from "./server/storage";
export async function prepare(id: string) {
  const rows = await query(
    "UPDATE jobs SET status='processing',updated_at=now() WHERE id=$1 AND status='queued' AND NOT EXISTS(SELECT 1 FROM deletion_requests d WHERE d.user_id=jobs.user_id) RETURNING *",
    [id],
  );
  const job = rows[0];
  if (!job) return;
  // O worker é outro processo: uma chave cadastrada pela interface chega aqui
  // pelo banco, não por `process.env`. Carregar por job mantém o processo longo
  // acompanhando uma troca de chave sem reinício.
  await refreshCredentials(job.user_id);
  try {
    await emitJob(id, { status: "processing", completed: 0 });
    const source = (
      await query("SELECT * FROM sources WHERE id=$1 AND user_id=$2", [
        job.source_id,
        job.user_id,
      ])
    )[0];
    if (!source) return;
    let durationMs = source.duration_ms as number | null;
    if (source.video_id && integrationStatus().youtube) {
      const metadata = await youtube.get(source.video_id);
      durationMs = metadata.durationMs;
      await query(
        "UPDATE sources SET title=$2,author=$3,duration_ms=$4,metadata_updated_at=now(),status=$5 WHERE id=$1",
        [
          source.id,
          metadata.title,
          metadata.author,
          metadata.durationMs,
          metadata.available
            ? job.kind === "transcribe"
              ? "transcribing"
              : "processing"
            : "unavailable",
        ],
      );
      if (!metadata.available)
        throw new AppError(
          "SOURCE_UNAVAILABLE",
          "O vídeo não está disponível para incorporação.",
        );
    }
    if (job.kind === "transcribe") {
      if (!source.video_id || !source.url)
        throw new AppError(
          "INVALID_VIDEO_SOURCE",
          "A transcrição por URL exige um vídeo válido do YouTube.",
        );
      if (source.rights !== "public_link")
        throw new AppError(
          "RIGHTS_REQUIRED",
          "Confirme o uso do link público antes de transcrever.",
        );
      validateVideoTranscriptionDuration(Number(durationMs));
      if (
        (
          await query("SELECT 1 FROM segments WHERE source_id=$1 LIMIT 1", [
            source.id,
          ])
        ).length
      )
        throw new AppError(
          "TRANSCRIPT_EXISTS",
          "Esta fonte já possui uma transcrição.",
        );
      await emitJob(id, { status: "processing", completed: 1, total: 3 });
      const transcript = await gemini.transcribeVideo(
        job.user_id,
        source.url,
        Number(durationMs),
      );
      await emitJob(id, { status: "processing", completed: 2, total: 3 });
      await transaction(async (c) => {
        const current = (
          await c.query("SELECT status FROM jobs WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (
          !current ||
          current.status === "cancelled" ||
          (
            await c.query("SELECT 1 FROM deletion_requests WHERE user_id=$1", [
              job.user_id,
            ])
          ).rowCount
        )
          return;
        if (
          (
            await c.query("SELECT 1 FROM segments WHERE source_id=$1 LIMIT 1", [
              source.id,
            ])
          ).rowCount
        )
          throw new AppError(
            "TRANSCRIPT_CONFLICT",
            "Outra transcrição foi adicionada durante o processamento.",
          );
        for (let ordinal = 0; ordinal < transcript.segments.length; ordinal++) {
          const segment = transcript.segments[ordinal];
          await c.query(
            "INSERT INTO segments(source_id,ordinal,start_ms,end_ms,text,origin,time_accuracy,quality_status) VALUES($1,$2,$3,$4,$5,'provider_video_url','approximate','ai_unreviewed')",
            [source.id, ordinal, segment.startMs, segment.endMs, segment.text],
          );
        }
        await c.query(
          "UPDATE sources SET status='text_ready',transcription_mode='ai',transcript_provider='gemini',transcript_model=$2,transcript_reviewed=false,transcription_completed_at=now(),updated_at=now() WHERE id=$1",
          [source.id, videoIntegrationStatus().model],
        );
        await c.query(
          "UPDATE jobs SET status='ready',completed=3,total=3,updated_at=now() WHERE id=$1",
          [id],
        );
      });
      await emitJob(id, { status: "ready", completed: 3, total: 3 });
      return;
    }
    const segments = await query(
      "SELECT id,text FROM segments WHERE source_id=$1 ORDER BY ordinal LIMIT 8",
      [source.id],
    );
    if (!segments.length)
      throw new AppError(
        "NO_TRANSCRIPT",
        "Sem transcrição. Adicione uma legenda autorizada ou pratique com um cenário independente.",
      );
    const unit = await textAI.generate(
      job.user_id,
      segments as { id: string; text: string }[],
    );
    await transaction(async (c) => {
      const current = (
        await c.query("SELECT status FROM jobs WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (
        !current ||
        current.status === "cancelled" ||
        (
          await c.query("SELECT 1 FROM deletion_requests WHERE user_id=$1", [
            job.user_id,
          ])
        ).rowCount
      )
        return;
      await c.query(
        "INSERT INTO learning_units(user_id,source_id,title,objective,prompt,expected_answer,segment_ids,vocabulary,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          job.user_id,
          source.id,
          unit.title,
          unit.objective,
          unit.prompt,
          unit.expectedAnswer,
          JSON.stringify(unit.segmentIds),
          JSON.stringify(unit.vocabulary),
          `${integrationStatus().provider}_unreviewed`,
        ],
      );
      await c.query(
        "UPDATE jobs SET status='ready',completed=1,total=1,updated_at=now() WHERE id=$1",
        [id],
      );
      await c.query(
        "UPDATE sources SET status='partial_ready',updated_at=now() WHERE id=$1",
        [source.id],
      );
    });
    await emitJob(id, { status: "ready", completed: 1, total: 1 });
  } catch (error) {
    const e =
      error instanceof AppError
        ? error
        : new AppError(
            "PREPARATION_FAILED",
            "O preparo falhou. Seu material original foi preservado.",
            500,
          );
    const status =
      e.code === "BUDGET_EXCEEDED"
        ? "blocked_budget"
        : e.code === "INTEGRATION_NOT_CONFIGURED"
          ? "awaiting_configuration"
          : e.code === "NO_TRANSCRIPT"
            ? "no_transcript"
            : "needs_review";
    await query(
      "UPDATE jobs SET status=$2,error_code=$3,error_message=$4,updated_at=now() WHERE id=$1 AND status<>'cancelled'",
      [id, status, e.code, e.message],
    );
    await query(
      "UPDATE sources SET status=CASE WHEN $2='awaiting_configuration' AND EXISTS(SELECT 1 FROM segments WHERE source_id=sources.id) THEN 'text_ready' ELSE $2 END WHERE id=$1 AND status<>'unavailable'",
      [job.source_id, status],
    );
    await emitJob(id, { status, error: e.message });
  }
}
export async function maintenance() {
  for (const row of await query(
    "SELECT id,file_key FROM recordings WHERE expires_at<now() AND NOT preserve",
  )) {
    await storage.remove(row.file_key);
    await query("DELETE FROM recordings WHERE id=$1", [row.id]);
  }
  await query(
    "DELETE FROM tutor_messages WHERE created_at<now()-interval '30 days'",
  );
  await query("DELETE FROM rate_limits WHERE resets_at<now()-interval '1 day'");
  await query(
    "UPDATE sources SET title='Vídeo aguardando revalidação',author='YouTube',duration_ms=NULL,metadata_updated_at=NULL WHERE video_id IS NOT NULL AND metadata_updated_at<now()-interval '30 days'",
  );
  for (const row of await query(
    "SELECT user_id FROM deletion_requests WHERE state='pending'",
  )) {
    await removeUserObjects(row.user_id);
    await transaction(async (c) => {
      await c.query('DELETE FROM "user" WHERE id=$1', [row.user_id]);
      await c.query(
        "UPDATE deletion_requests SET state='completed',completed_at=now() WHERE user_id=$1",
        [row.user_id],
      );
    });
  }
  // An interrupted external call is never blindly retried.
  await query(
    "UPDATE jobs SET status='needs_review',error_code='INTERRUPTED',error_message='O processamento foi interrompido. Verifique o uso antes de tentar novamente.' WHERE status='processing' AND updated_at<now()-interval '10 minutes'",
  );
  await query(
    "UPDATE budget_reservations SET state='unknown' WHERE state='active' AND created_at<now()-interval '10 minutes'",
  );
  await dispatchJobs();
}
if (process.argv[1]?.replace(/\\/g, "/").endsWith("/worker.ts")) {
  const b = await boss();
  await b.work<{ id: string }>(QUEUE, { localConcurrency: 1 }, async (jobs) => {
    for (const job of jobs) await prepare(job.data.id);
  });
  await maintenance();
  let maintaining = false;
  const timer = setInterval(async () => {
    if (maintaining) return;
    maintaining = true;
    try {
      await maintenance();
    } catch {
      console.error("MAINTENANCE_ERROR");
    } finally {
      maintaining = false;
    }
  }, 15000);
  console.log(
    "FluentQuest worker pronto. IA " +
      (integrationStatus().ai ? "ativada" : "desativada") +
      ".",
  );
  async function stop() {
    clearInterval(timer);
    await b.stop({ graceful: true });
    await pool.end();
    process.exit(0);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

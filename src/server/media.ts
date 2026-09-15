import { mkdtemp, writeFile, unlink, rmdir, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../domain/content";
const run = promisify(execFile);
const ffprobe = createRequire(import.meta.url)("ffprobe-static") as {
  path: string;
};
export async function inspectMedia(
  bytes: Buffer,
  maxSeconds: number,
  audioOnly = false,
) {
  const type = await fileTypeFromBuffer(bytes);
  if (
    !type ||
    ![
      "audio/webm",
      "video/webm",
      "audio/ogg",
      "audio/wav",
      "audio/mpeg",
      "audio/mp4",
      "video/mp4",
      "audio/x-m4a",
      "audio/flac",
    ].includes(type.mime)
  )
    throw new AppError(
      "INVALID_MEDIA",
      "Use WebM, Ogg, WAV, MP3, MP4 ou FLAC.",
    );
  const tempRoot = path.resolve(process.env.DATA_DIR || "./data", "tmp");
  await mkdir(tempRoot, { recursive: true });
  const dir = await mkdtemp(path.join(tempRoot, "probe-"));
  const file = path.join(dir, `input.${type.ext}`);
  try {
    await writeFile(file, bytes);
    const { stdout } = await run(
      ffprobe.path,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_entries",
        "packet=pts_time,duration_time:stream=codec_type:format=duration",
        "-of",
        "json",
        file,
      ],
      { timeout: 20000, maxBuffer: 16_000_000, windowsHide: true },
    );
    const result = JSON.parse(stdout);
    const streams = result.streams as { codec_type: string }[];
    if (!streams?.some((s) => s.codec_type === "audio") && audioOnly)
      throw new AppError(
        "INVALID_MEDIA",
        "O arquivo não contém uma faixa de áudio.",
      );
    if (audioOnly && streams.some((s) => s.codec_type === "video"))
      throw new AppError(
        "INVALID_MEDIA",
        "Envie somente áudio nesta atividade.",
      );
    const packets = result.packets as
      { pts_time?: string; duration_time?: string }[] | undefined;
    const duration = (packets || []).reduce(
      (max, p) =>
        Math.max(max, Number(p.pts_time || 0) + Number(p.duration_time || 0)),
      Number(result.format?.duration) || 0,
    );
    if (!Number.isFinite(duration) || duration < 0.1)
      throw new AppError(
        "INVALID_DURATION",
        "Não foi possível medir a duração deste arquivo. Grave novamente ou use outro formato.",
      );
    if (duration > maxSeconds + 1)
      throw new AppError(
        "MEDIA_TOO_LONG",
        `O arquivo deve ter até ${maxSeconds < 120 ? `${maxSeconds} segundos` : `${maxSeconds / 60} minutos`}.`,
      );
    return { mime: type.mime, durationMs: Math.round(duration * 1000) };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "INVALID_MEDIA",
      "Não foi possível validar este arquivo de mídia. Tente outro formato.",
    );
  } finally {
    await unlink(file).catch(() => {});
    await rmdir(dir).catch(() => {});
  }
}

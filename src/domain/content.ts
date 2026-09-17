import { z } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    public retryable = false,
  ) {
    super(message);
  }
}
export const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export function youtubeId(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("INVALID_URL", "Informe uma URL válida do YouTube.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new AppError("INVALID_URL", "Use uma URL HTTPS do YouTube.");
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = /^\/(?:shorts|embed)\/([^/]+)$/.exec(url.pathname)?.[1] ?? null;
  }
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id))
    throw new AppError(
      "INVALID_URL",
      "Use um link de vídeo do YouTube, como youtube.com/watch?v=…",
    );
  return id;
}
export type SegmentInput = {
  startMs: number | null;
  endMs: number | null;
  text: string;
  timeAccuracy: "approximate" | "none";
};
function time(value: string) {
  const pieces = value.trim().replace(",", ".").split(":").map(Number);
  if (
    pieces.length < 2 ||
    pieces.length > 3 ||
    pieces.some((n) => !Number.isFinite(n) || n < 0)
  )
    throw new AppError("INVALID_CAPTION", "Timestamp inválido na legenda.");
  if (pieces.at(-1)! >= 60 || pieces.at(-2)! >= 60)
    throw new AppError(
      "INVALID_CAPTION",
      "Timestamp fora do intervalo permitido.",
    );
  return Math.round(pieces.reduce((n, part) => n * 60 + part, 0) * 1000);
}
export function parseContent(input: string): SegmentInput[] {
  if (input.length > 500_000)
    throw new AppError(
      "CONTENT_TOO_LARGE",
      "O texto deve ter até 500 mil caracteres.",
    );
  const clean = input
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim();
  if (!clean)
    throw new AppError(
      "EMPTY_CONTENT",
      "Adicione texto ou uma legenda para estudar.",
    );
  if (!clean.includes("-->"))
    return clean
      .split(/\n\s*\n|\n/)
      .filter(Boolean)
      .flatMap((p) => p.match(/.{1,1200}(?:\s|$)|.{1,1200}/g) ?? [p])
      .map((text) => ({
        startMs: null,
        endMs: null,
        text: text.trim(),
        timeAccuracy: "none",
      }));
  const segments: SegmentInput[] = [];
  for (const block of clean.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) continue;
    const match = lines[index].match(/^(\S+)\s+-->\s+(\S+)/);
    if (!match)
      throw new AppError(
        "INVALID_CAPTION",
        "Não foi possível ler um intervalo da legenda.",
      );
    const startMs = time(match[1]),
      endMs = time(match[2]);
    const text = lines
      .slice(index + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (
      !text ||
      endMs <= startMs ||
      (segments.length && startMs < segments.at(-1)!.startMs!)
    )
      throw new AppError(
        "INVALID_CAPTION",
        "Os intervalos devem estar ordenados e ter texto e duração positiva.",
      );
    segments.push({ startMs, endMs, text, timeAccuracy: "approximate" });
  }
  if (!segments.length || segments.length > 10000)
    throw new AppError(
      "INVALID_CAPTION",
      "A legenda não contém trechos válidos ou excede o limite.",
    );
  return segments;
}
export const MAX_VIDEO_TRANSCRIPTION_MS = 15 * 60 * 1000;
export function validateVideoTranscriptionDuration(durationMs: number) {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0)
    throw new AppError(
      "VIDEO_DURATION_REQUIRED",
      "Aguarde a duração do vídeo ser verificada antes de transcrever.",
    );
  if (durationMs > MAX_VIDEO_TRANSCRIPTION_MS)
    throw new AppError(
      "VIDEO_TOO_LONG",
      "A transcrição automática aceita vídeos de até 15 minutos neste piloto.",
    );
  return durationMs;
}
const videoTranscriptSegment = z.object({
  startMs: z.number().int().min(0),
  // Gemini structured output accepts `minimum`, but not JSON Schema's
  // `exclusiveMinimum`. `min(1)` preserves the same integer constraint.
  endMs: z.number().int().min(1),
  text: z.string().trim().min(1).max(1200),
});
export const videoTranscript = z
  .object({
    language: z.string().trim().min(2).max(20),
    segments: z.array(videoTranscriptSegment).min(1).max(240),
  })
  .superRefine((value, ctx) => {
    let previousStart = -1;
    let total = 0;
    value.segments.forEach((segment, index) => {
      total += segment.text.length;
      if (segment.endMs <= segment.startMs || segment.startMs < previousStart)
        ctx.addIssue({
          code: "custom",
          path: ["segments", index],
          message: "Os trechos devem estar ordenados e ter duração positiva.",
        });
      previousStart = segment.startMs;
    });
    if (total > 120000)
      ctx.addIssue({
        code: "custom",
        path: ["segments"],
        message: "A transcrição excede o limite de texto.",
      });
  });
// O Gemini estima os tempos do vídeo e acumula drift: numa medição de
// 2026-09-16, um vídeo de 837 s voltou com o trecho final em 936 s (~12% a
// mais), sendo que esse trecho é o encerramento real do vídeo. O drift é
// acumulativo e aproximadamente linear, então reescalar a linha do tempo
// inteira alinha melhor do que cortar a cauda. Acima de MAX_TIME_DRIFT o
// resultado deixa de ser drift e vira erro de unidade (segundos no lugar de
// milissegundos, por exemplo) — aí continua sendo recusado.
export const MAX_TIME_DRIFT = 1.5;
// Piso de cobertura. Uma resposta que descreve só o começo do vídeo é
// truncamento, não transcrição: em 2026-09-17 o Gemini devolveu 5 trechos
// cobrindo 111 s de um vídeo de 837 s (13%) — JSON válido, schema satisfeito,
// fonte marcada `text_ready`. Os 20% de folga absorvem encerramento sem fala
// (vinheta, tela final); truncamento real fica muito abaixo disso.
export const MIN_TRANSCRIPT_COVERAGE = 0.8;
const asClock = (ms: number) =>
  `${Math.floor(ms / 60000)}min ${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}s`;
// Medida na linha do tempo crua do modelo, antes de fitTranscriptToDuration:
// o reescalonamento só encolhe, então nunca transforma transcrição curta em
// completa, e checar antes evita depender dessa ordem.
export function assertTranscriptCoverage(
  segments: { endMs: number }[],
  durationMs: number,
) {
  const lastEnd = Math.max(...segments.map((segment) => segment.endMs));
  if (lastEnd >= durationMs * MIN_TRANSCRIPT_COVERAGE) return lastEnd;
  throw new AppError(
    "INCOMPLETE_TRANSCRIPT",
    `A transcrição parou em ${asClock(lastEnd)} de ${asClock(durationMs)} — ${Math.round((lastEnd / durationMs) * 100)}% do vídeo. Nenhum trecho foi salvo, porque texto parcial marcado como pronto vira estudo em cima de uma fonte falsa. Tente de novo ou importe uma legenda autorizada. Se o vídeo realmente termina sem fala, a cobertura acima diz quanto falta.`,
    422,
    true,
  );
}
export function fitTranscriptToDuration<
  T extends { startMs: number; endMs: number },
>(segments: T[], durationMs: number): T[] {
  const lastEnd = Math.max(...segments.map((segment) => segment.endMs));
  // Tolerância de 2 s absorve arredondamento sem reescalar à toa.
  if (lastEnd <= durationMs + 2000) return segments;
  if (lastEnd > durationMs * MAX_TIME_DRIFT)
    throw new AppError(
      "INVALID_TRANSCRIPT_TIME",
      "A transcrição retornou tempos incompatíveis com a duração do vídeo.",
    );
  const factor = durationMs / lastEnd;
  return segments.map((segment) => ({
    ...segment,
    startMs: Math.round(segment.startMs * factor),
    // Garante duração positiva mesmo se o arredondamento colapsar o trecho.
    endMs: Math.max(
      Math.round(segment.endMs * factor),
      Math.round(segment.startMs * factor) + 1,
    ),
  }));
}
// Apoio de estudo de um trecho. Quatro campos discretos em vez de um texto
// único: a interface precisa hierarquizar a tradução (o que se procura de
// relance) acima da explicação, e separar a pergunta, que é tarefa e não
// leitura. Campos curtos por contrato — este painel é consultado no meio da
// escuta, não lido como artigo.
export const segmentSupport = z.object({
  translation: z.string().trim().min(1).max(600),
  point: z.string().trim().min(1).max(600),
  example: z.string().trim().min(1).max(400),
  question: z.string().trim().min(1).max(400),
});
export const sourceInput = z.object({
  kind: z.enum(["youtube", "text", "media"]),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120).default("Material próprio"),
  url: z.string().max(500).optional(),
  text: z.string().max(500000).optional(),
  language: z.enum(["en-US", "en-GB"]).default("en-US"),
  rights: z.enum(["owned", "licensed", "public_link"]),
  transcriptionMode: z.enum(["manual", "ai"]).default("manual"),
  consent: z.literal(true),
});
export const cardInput = z.object({
  expression: z.string().trim().min(1).max(180),
  meaning: z.string().trim().min(1).max(500),
  example: z.string().trim().min(1).max(1200),
  sourceId: z.string().uuid().optional(),
  segmentId: z.string().uuid().optional(),
  language: z.enum(["en-US", "en-GB"]).default("en-US"),
  mode: z
    .enum(["production", "recognition", "listening"])
    .default("production"),
});
export const generatedUnit = z.object({
  title: z.string().min(1).max(150),
  objective: z.string().min(1).max(500),
  prompt: z.string().min(1).max(1500),
  expectedAnswer: z.string().max(1000).nullable(),
  segmentIds: z.array(z.string().uuid()).min(1).max(8),
  vocabulary: z
    .array(
      z.object({
        expression: z.string().min(1).max(180),
        meaning: z.string().min(1).max(500),
        example: z.string().min(1).max(1200),
      }),
    )
    .max(5),
});
export const speechFeedback = z.object({
  transcript: z.string().max(12000),
  strength: z.string().max(1000),
  correction: z.string().max(1000),
  retryPrompt: z.string().max(1000),
});
export const scenarios = [
  {
    id: "daily",
    title: "Explique um bloqueio sem roteiro",
    skill: "Comunicação profissional",
    prompt:
      "Conte o que você fez, qual problema encontrou e qual será seu próximo passo. Fale por até 90 segundos.",
  },
  {
    id: "debugging",
    title: "Explique um bug para um colega",
    skill: "Expressão oral",
    prompt:
      "Descreva o comportamento esperado, o que aconteceu e como você investigaria o problema.",
  },
  {
    id: "review",
    title: "Discorde com respeito em um code review",
    skill: "Comunicação profissional",
    prompt:
      "Um colega sugere remover todos os testes para acelerar a entrega. Explique sua preocupação e proponha uma alternativa.",
  },
  {
    id: "everyday",
    title: "Conte uma pequena descoberta",
    skill: "Expressão oral",
    prompt:
      "Conte algo interessante que você descobriu recentemente e explique por que isso chamou sua atenção.",
  },
  {
    id: "weekly",
    title: "Defenda uma escolha técnica",
    skill: "Comunicação profissional",
    prompt:
      "Em até 90 segundos, compare duas soluções para uma tarefa agendada. Depois responda: what would make you change your mind?",
  },
] as const;

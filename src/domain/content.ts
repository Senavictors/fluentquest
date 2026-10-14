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
// TASK-013 / ADR-006: lista única de idiomas suportados — vale tanto para o
// idioma de estudo (sourceInput/cardInput) quanto para a língua de
// explicação do perfil (`learner_profiles.locale`). RN-01: não pode existir
// uma segunda lista, em servidor ou cliente.
export const SUPPORTED_LANGUAGES = [
  "en-US",
  "en-GB",
  "es-ES",
  "es-AR",
  "es-CL",
  "es-MX",
  "it-IT",
  "fr-FR",
  "zh-CN",
  "ja-JP",
  "ru-RU",
  "pt-BR",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
// TASK-014 / ADR-006: nome em inglês de cada idioma da lista fechada, para
// compor prompt (o texto do prompt é em inglês). Não é uma segunda lista —
// é rótulo 1:1 da mesma `SUPPORTED_LANGUAGES` (RN-01).
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "es-ES": "Spanish (Spain)",
  "es-AR": "Spanish (Argentina)",
  "es-CL": "Spanish (Chile)",
  "es-MX": "Spanish (Mexico)",
  "it-IT": "Italian",
  "fr-FR": "French",
  "zh-CN": "Mandarin Chinese (Simplified)",
  "ja-JP": "Japanese",
  "ru-RU": "Russian",
  "pt-BR": "Portuguese (Brazil)",
};
// RN-05 (TASK-014): o provedor devolve `videoTranscript.language` como texto
// livre ("en", "English", "en-US"...). Comparar só a subtag primária evita
// falso positivo entre variantes do mesmo idioma (en-US declarado, "English"
// detectado) — divergência real é um idioma diferente, não uma variante.
export function languageDiverges(
  declared: SupportedLanguage,
  detected: string,
): boolean {
  const primary = declared.split("-")[0].toLowerCase();
  return !detected.toLowerCase().includes(primary);
}
// RN-03: o idioma passa a ser explícito por chamada — antes a regra de
// casing de inglês era aplicada até ao significado em português. `language`
// é `string`, não `SupportedLanguage`, porque a regra de casing do
// `Intl` não depende da política de idiomas do produto.
export const normalize = (value: string, language: string) =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(language);
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
// TASK-018 / ADR-009: LRC, o formato de letra sincronizada do LRCLIB. Uma
// linha por verso, prefixada pelo instante em que ele começa. A fração aceita
// `.` ou `:` (`[00:17.12]` e `[00:17:12]` circulam), então `time()` não serve:
// leria o segundo caso como hh:mm:ss.
const LRC_STAMP = String.raw`\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]`;
const LRC_LINE = new RegExp(`^${LRC_STAMP}`);
const LRC_STAMPS = new RegExp(`^((?:${LRC_STAMP}\\s*)+)(.*)$`);
const LRC_WORD_STAMP = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;
const LRC_META = /^\[([a-z]+):([^\]]*)\]$/i;
function lrcTime(value: string) {
  const match = /^(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?$/.exec(value.trim());
  if (!match || Number(match[2]) >= 60)
    throw new AppError(
      "INVALID_CAPTION",
      "Marca de tempo fora do intervalo permitido na letra.",
    );
  // A fração é decimal: `.1` é 100 ms, `.12` é 120 ms, `.123` é 123 ms.
  const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
  return Math.round(
    (Number(match[1]) * 60 + Number(match[2]) + fraction) * 1000,
  );
}
// RN-01: duas linhas com marca de tempo no início e nenhum `-->`. Uma linha
// só não basta — prosa com um "[00:10]" eventual não é letra sincronizada.
function looksLikeLrc(clean: string) {
  if (clean.includes("-->")) return false;
  let hits = 0;
  for (const line of clean.split("\n"))
    if (LRC_LINE.test(line.trim()) && ++hits >= 2) return true;
  return false;
}
function parseLrc(clean: string): SegmentInput[] {
  let offsetMs = 0;
  let lengthMs: number | null = null;
  const events: { startMs: number; text: string }[] = [];
  for (const raw of clean.split("\n")) {
    const line = raw.trim();
    const timed = LRC_STAMPS.exec(line);
    if (timed) {
      // RN-07: marcas por palavra saem do texto nesta versão.
      const text = timed[2]
        .replace(LRC_WORD_STAMP, "")
        .replace(/\s+/g, " ")
        .trim();
      // RN-04: uma linha com várias marcas vira um evento por marca.
      for (const stamp of timed[1].match(/\[[^\]]+\]/g)!)
        events.push({ startMs: lrcTime(stamp.slice(1, -1)), text });
      continue;
    }
    // RN-05: metadado não vira trecho; só offset e length mudam o resultado.
    const meta = LRC_META.exec(line);
    if (!meta) continue;
    const tag = meta[1].toLowerCase();
    if (tag === "offset" && /^\s*[+-]?\d+\s*$/.test(meta[2]))
      offsetMs = Number(meta[2]);
    else if (tag === "length") {
      try {
        lengthMs = lrcTime(meta[2]);
      } catch {
        // `length` malformado é só metadado ruim; a última linha fica sem fim.
      }
    }
  }
  // Positivo adianta a letra (convenção do formato): o verso aparece antes.
  const shift = (ms: number) => Math.max(0, ms - offsetMs);
  // Ordenação estável: versos com o mesmo instante mantêm a ordem do arquivo.
  const ordered = events
    .map((event) => ({ ...event, startMs: shift(event.startMs) }))
    .sort((a, b) => a.startMs - b.startMs);
  const segments: SegmentInput[] = [];
  ordered.forEach((event, index) => {
    // RN-06: pausa instrumental não vira trecho, mas encerra o anterior.
    if (!event.text) return;
    if (event.text.length > 1200)
      throw new AppError(
        "INVALID_CAPTION",
        "Um verso da letra passa de 1.200 caracteres.",
      );
    // RN-02: o fim de um verso é, por definição do formato, o início do
    // próximo instante declarado — não é interpolação.
    const next = ordered
      .slice(index + 1)
      .find((other) => other.startMs > event.startMs);
    const endMs =
      next?.startMs ??
      (lengthMs !== null && lengthMs > event.startMs ? lengthMs : null);
    // RN-03: tempo de comunidade, não alinhamento acústico.
    segments.push({
      startMs: event.startMs,
      endMs,
      text: event.text,
      timeAccuracy: "approximate",
    });
  });
  if (!segments.length || segments.length > 10000)
    throw new AppError(
      "INVALID_CAPTION",
      "A letra não contém versos com texto ou excede o limite.",
    );
  return segments;
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
  if (looksLikeLrc(clean)) return parseLrc(clean);
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
// TASK-019 / ADR-009: catálogo de letras LRCLIB por host fixo. O usuário só
// fornece termo de busca ou ID numérico; origem, protocolo e caminho são
// constantes daqui. Nenhum campo de entrada aceita URL (RN-01).
export const LRCLIB_ORIGIN = "https://lrclib.net";
export const lyricsSearchQuery = z
  .string("Informe o nome da música ou do artista.")
  .trim()
  .min(1, "Informe o nome da música ou do artista.")
  .max(200, "A busca aceita até 200 caracteres.");
export const lyricsCatalogId = z.coerce
  .number("Informe um ID numérico do LRCLIB.")
  .int("Informe um ID numérico do LRCLIB.")
  .positive("Informe um ID numérico do LRCLIB.")
  .max(Number.MAX_SAFE_INTEGER, "ID do LRCLIB fora do intervalo.");
export function lyricsSearchUrl(q: unknown) {
  const url = new URL("/api/search", LRCLIB_ORIGIN);
  url.searchParams.set("q", lyricsSearchQuery.parse(q));
  return url;
}
export function lyricsGetUrl(id: unknown) {
  return new URL(`/api/get/${lyricsCatalogId.parse(id)}`, LRCLIB_ORIGIN);
}
// RN-03: só o contrato usado é lido; o resto da resposta (inclusive o
// `lyricsfile`) é descartado pelo `z.object`.
export const lyricsRecord = z.object({
  id: z.number().int().positive(),
  trackName: z.string().trim().min(1).max(500),
  artistName: z.string().trim().min(1).max(500),
  albumName: z.string().trim().max(500).nullable(),
  // Segundos, às vezes com fração. Nulo quando o catálogo não sabe.
  duration: z.number().nonnegative().nullable(),
  instrumental: z.boolean(),
  plainLyrics: z.string().max(500000).nullable(),
  syncedLyrics: z.string().max(500000).nullable(),
});
export type LyricsRecord = z.infer<typeof lyricsRecord>;
export const MAX_LYRICS_RESULTS = 20;
export function lyricsSummary(record: LyricsRecord) {
  return {
    id: record.id,
    title: record.trackName,
    artist: record.artistName,
    album: record.albumName || null,
    durationMs:
      record.duration === null ? null : Math.round(record.duration * 1000),
    // RN-08: instrumental aparece marcado, não some.
    instrumental: record.instrumental,
    hasSynced: Boolean(record.syncedLyrics?.trim()),
    hasPlain: Boolean(record.plainLyrics?.trim()),
  };
}
export type LyricsSummary = ReturnType<typeof lyricsSummary>;
// TASK-020 / ADR-009: importar música. O cliente manda só o ID do catálogo —
// nunca o texto da letra —, então título, artista e trechos vêm do adaptador
// e a atribuição não pode ser forjada. `rights` não é campo de entrada: letra
// do catálogo é sempre `LYRICS_RIGHTS`.
export const LYRICS_RIGHTS = "third_party";
export const lyricsImportInput = z.object({
  catalogId: lyricsCatalogId,
  language: z.enum(SUPPORTED_LANGUAGES).default("en-US"),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});
// RN-01: tempo só quando a letra veio sincronizada; texto simples nunca ganha
// sincronização. Letra sincronizada que não passa no parser cai para o texto
// simples do mesmo registro, sem tempo, em vez de inventar alinhamento.
export function lyricsSegments(record: LyricsRecord): SegmentInput[] {
  const synced = record.syncedLyrics?.trim();
  const plain = record.plainLyrics?.trim();
  if (record.instrumental || (!synced && !plain))
    throw new AppError(
      "LYRICS_EMPTY",
      "Esse registro do LRCLIB não tem letra para estudar (instrumental ou vazio).",
    );
  if (synced)
    try {
      const segments = parseContent(synced);
      if (segments.every((s) => s.timeAccuracy === "approximate"))
        return segments;
    } catch (error) {
      if (!plain || !(error instanceof AppError)) throw error;
    }
  return parseContent(plain || synced!).map((segment) => ({
    ...segment,
    startMs: null,
    endMs: null,
    timeAccuracy: "none",
  }));
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
// inteira alinha melhor do que cortar a cauda.
//
// O teto separa drift de erro de unidade, e 1,5 não separava coisa nenhuma: um
// erro de unidade real é 1000× (segundos lidos como milissegundos) ou 60000×
// (minutos), não 1,6×. Em 2026-09-17 um vídeo de 636 s voltou acima de 1,5×
// cinco vezes seguidas — cinco chamadas pagas, cinco recusas, nenhum texto. O
// modelo simplesmente conta o tempo pior em alguns vídeos do que em outros, e
// isso é drift, não lixo. 10× deixa uma folga larga e inequívoca antes do erro
// de unidade.
export const MAX_TIME_DRIFT = 10;
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
  // A âncora é o fim do último trecho, não o maior endMs de todos. `startMs`
  // chega monotônico por contrato (videoTranscript), então o último trecho é o
  // encerramento real; já um endMs solto no meio da transcrição é defeito de um
  // trecho e não pode decidir a escala da linha do tempo inteira — muito menos
  // derrubar a transcrição toda, como acontecia com Math.max.
  const lastEnd = segments[segments.length - 1].endMs;
  if (lastEnd > durationMs * MAX_TIME_DRIFT)
    throw new AppError(
      "INVALID_TRANSCRIPT_TIME",
      `A transcrição retornou tempos ${Math.round(lastEnd / durationMs)}× maiores que a duração do vídeo. Isso é erro de unidade, não desvio de estimativa, e não há como reescalar.`,
    );
  // Tolerância de 2 s absorve arredondamento sem reescalar à toa.
  const factor = lastEnd > durationMs + 2000 ? durationMs / lastEnd : 1;
  return segments.map((segment) => {
    // O corte final mantém todo trecho dentro do vídeo mesmo quando o fator é 1
    // — é o que neutraliza um endMs isolado fora da curva sem descartar o resto.
    const startMs = Math.min(
      Math.round(segment.startMs * factor),
      durationMs - 1,
    );
    return {
      ...segment,
      startMs,
      // Garante duração positiva mesmo se o arredondamento colapsar o trecho.
      endMs: Math.min(
        Math.max(Math.round(segment.endMs * factor), startMs + 1),
        durationMs,
      ),
    };
  });
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
  language: z.enum(SUPPORTED_LANGUAGES).default("en-US"),
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
  language: z.enum(SUPPORTED_LANGUAGES).default("en-US"),
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

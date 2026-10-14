import { describe, it, expect } from "vitest";
import {
  youtubeId,
  parseContent,
  normalize,
  validateVideoTranscriptionDuration,
  videoTranscript,
  fitTranscriptToDuration,
  assertTranscriptCoverage,
  SUPPORTED_LANGUAGES,
  sourceInput,
  cardInput,
  languageDiverges,
  lyricsSearchUrl,
  lyricsGetUrl,
  lyricsRecord,
  lyricsSummary,
  lyricsImportInput,
  lyricsSegments,
  LYRICS_RIGHTS,
  songDuration,
  lyricsSegmentLabel,
} from "../src/domain/content";
import { initialCard, scheduleCard, xpLevel } from "../src/domain/review";
import { tokenCostMicros, budgetPeriod } from "../src/server/budget";
import { normalizeUsage } from "../src/server/providers";
describe("Fontes e proveniência", () => {
  it("normaliza hosts exatos, watch, shorts e links curtos", () => {
    expect(youtubeId("https://youtu.be/abcdefghijk?t=42")).toBe("abcdefghijk");
    expect(youtubeId("https://www.youtube.com/shorts/abcdefghijk")).toBe(
      "abcdefghijk",
    );
  });
  it("rejeita SSRF, credenciais, hosts parecidos e IDs inválidos", () => {
    for (const url of [
      "http://localhost/x",
      "https://youtube.com.evil.test/watch?v=abcdefghijk",
      "https://evil@youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/a",
      "https://youtube.com:8443/watch?v=abcdefghijk",
    ])
      expect(() => youtubeId(url)).toThrow();
  });
  it("preserva tempos aproximados de SRT sem inventar sincronização para texto", () => {
    expect(
      parseContent("1\n00:00:01,200 --> 00:00:03,500\nHello there.")[0],
    ).toMatchObject({
      startMs: 1200,
      endMs: 3500,
      text: "Hello there.",
      timeAccuracy: "approximate",
    });
    expect(parseContent("Hello.")[0].startMs).toBeNull();
  });
  it("rejeita intervalos invertidos, fora de ordem e texto vazio", () => {
    for (const value of [
      "",
      "1\n00:00:05,000 --> 00:00:03,000\nHello",
      "1\n00:00:02,000 --> 00:00:03,000\nFirst\n\n2\n00:00:01,000 --> 00:00:02,000\nSecond",
    ])
      expect(() => parseContent(value)).toThrow();
  });
  // TASK-018 / ADR-009. Letras autorais, escritas para o teste — nunca letra
  // real protegida.
  it("lê LRC com início declarado e fim no próximo verso, tempo aproximado (CA-01)", () => {
    expect(
      parseContent(
        "[00:01.50] The build is green again\n[00:04.25] Ship it before lunch\n[00:07.1] Nobody touch the cache",
      ),
    ).toEqual([
      {
        startMs: 1500,
        endMs: 4250,
        text: "The build is green again",
        timeAccuracy: "approximate",
      },
      {
        startMs: 4250,
        endMs: 7100,
        text: "Ship it before lunch",
        timeAccuracy: "approximate",
      },
      {
        startMs: 7100,
        endMs: null,
        text: "Nobody touch the cache",
        timeAccuracy: "approximate",
      },
    ]);
  });
  it("aceita fração com dois-pontos e milissegundos sem ler como hh:mm:ss", () => {
    const [first, second] = parseContent(
      "[01:02:30] Merge conflict blues\n[01:05.125] Rebase and pray",
    );
    expect(first.startMs).toBe(62300);
    expect(second.startMs).toBe(65125);
  });
  it("ignora metadados, aplica offset e fecha a última linha com length (CA-02)", () => {
    const segments = parseContent(
      [
        "[ti:Deploy Friday]",
        "[ar:The Linters]",
        "[al:Green Builds]",
        "[by:fixture]",
        "[re:editor]",
        "[ve:1.0]",
        "[length:00:12.00]",
        "[offset:+500]",
        "[00:02.00] Deploy on a Friday",
        "[00:06.00] Pager on my pillow",
      ].join("\n"),
    );
    expect(segments.map((s) => s.text)).toEqual([
      "Deploy on a Friday",
      "Pager on my pillow",
    ]);
    // Offset positivo adianta a letra: 2000 − 500 e 6000 − 500.
    expect(segments.map((s) => [s.startMs, s.endMs])).toEqual([
      [1500, 5500],
      [5500, 12000],
    ]);
    expect(
      parseContent(
        "[offset:-250]\n[00:01.00] Late by a beat\n[00:02.00] Still on time",
      )[0].startMs,
    ).toBe(1250);
  });
  it("gera um trecho por marca numa linha com várias marcas, ordenado (CA-03)", () => {
    const segments = parseContent(
      "[00:01.00][00:09.00] Rollback, rollback\n[00:05.00] Hotfix in the night\n[00:13.00]",
    );
    expect(segments.map((s) => [s.startMs, s.endMs, s.text])).toEqual([
      [1000, 5000, "Rollback, rollback"],
      [5000, 9000, "Hotfix in the night"],
      [9000, 13000, "Rollback, rollback"],
    ]);
  });
  it("pausa instrumental não vira trecho mas encerra o anterior; marca por palavra sai do texto", () => {
    const segments = parseContent(
      "[00:01.00] <00:01.00>Tests <00:01.40>are <00:01.80>passing\n[00:03.00]\n[00:08.00] Back to the chorus",
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      startMs: 1000,
      endMs: 3000,
      text: "Tests are passing",
    });
    expect(segments[1]).toMatchObject({ startMs: 8000, endMs: null });
  });
  it("recusa LRC sem versos, verso gigante e segundo fora do intervalo", () => {
    for (const value of [
      "[00:01.00]\n[00:02.00]",
      `[00:01.00] ${"a".repeat(1201)}\n[00:02.00] fim`,
      "[00:61.00] Too many seconds\n[00:62.00] Still wrong",
    ])
      expect(() => parseContent(value)).toThrow();
  });
  it("SRT, VTT e texto simples não mudam com a leitura de LRC (CA-04)", () => {
    expect(
      parseContent(
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n<v Ana>Hello [00:01.00] there\n\n00:00:03.000 --> 00:00:04.000\n[00:03.00] Second",
      ).map((s) => [s.startMs, s.endMs, s.text]),
    ).toEqual([
      [1000, 2500, "Hello [00:01.00] there"],
      [3000, 4000, "[00:03.00] Second"],
    ]);
    expect(parseContent("First line.\nSecond line.")).toEqual([
      { startMs: null, endMs: null, text: "First line.", timeAccuracy: "none" },
      {
        startMs: null,
        endMs: null,
        text: "Second line.",
        timeAccuracy: "none",
      },
    ]);
  });
  it("prosa com colchete eventual não é tratada como LRC (CA-05)", () => {
    for (const value of [
      "He wrote it wrong [sic] and shipped it.\n[Chorus] is not a timestamp.",
      "[00:10] A single timestamp in prose.\nThe rest is plain text.",
    ])
      for (const segment of parseContent(value))
        expect(segment).toMatchObject({ startMs: null, timeAccuracy: "none" });
  });
  it("deduplica expressão sem fundir sentidos diferentes", () => {
    expect(normalize("  Under   LOAD ", "en-US")).toBe("under load");
    expect(normalize("carga de trabalho", "pt-BR")).not.toBe(
      normalize("carregamento", "pt-BR"),
    );
  });
  it("normalize() usa o casing do idioma recebido, não uma regra fixa de inglês (CA-06)", () => {
    // "I" maiúsculo vira "i" em inglês, mas "ı" (sem ponto) em turco — a regra
    // de casing muda com o idioma, como o RN-03 exige. O turco não está na
    // lista fechada de idiomas de estudo: normalize() é utilitário puro de
    // Intl, não depende da política de idiomas do produto.
    expect(normalize("I", "en-US")).toBe("i");
    expect(normalize("I", "tr-TR")).not.toBe(normalize("I", "en-US"));
  });
  it("abre a lista fechada de idiomas de estudo além de inglês, com o mesmo default (CA-01, CA-05)", () => {
    expect(SUPPORTED_LANGUAGES).toContain("es-ES");
    expect(SUPPORTED_LANGUAGES).toContain("pt-BR");
    const base = {
      kind: "text" as const,
      title: "Teste",
      rights: "owned" as const,
      consent: true as const,
    };
    expect(sourceInput.parse(base).language).toBe("en-US");
    expect(sourceInput.parse({ ...base, language: "es-ES" }).language).toBe(
      "es-ES",
    );
    expect(() =>
      sourceInput.parse({ ...base, language: "xx-XX" }),
    ).toThrow();
  });
  it("cartão em idiomas diferentes com a mesma expressão e sentido não colide no contrato (CA-03)", () => {
    const base = {
      expression: "bajo carga",
      meaning: "sob carga",
      example: "El servicio se ralentiza bajo carga.",
    };
    const es = cardInput.parse({ ...base, language: "es-ES" });
    const en = cardInput.parse({ ...base, language: "en-US" });
    expect(es.language).not.toBe(en.language);
    // A chave única de `cards` já inclui `language` (migração 001); o
    // domínio só precisa deixar os dois parsear sem se recusar.
    expect(es.expression).toBe(en.expression);
  });
  it("limita a transcrição por URL a vídeos com duração conhecida de até 15 minutos", () => {
    expect(validateVideoTranscriptionDuration(15 * 60 * 1000)).toBe(900000);
    expect(() => validateVideoTranscriptionDuration(0)).toThrow(
      "Aguarde a duração",
    );
    expect(() => validateVideoTranscriptionDuration(900001)).toThrow(
      "até 15 minutos",
    );
  });
  it("aceita apenas uma transcrição ordenada e com intervalos positivos", () => {
    expect(
      videoTranscript.parse({
        language: "en",
        segments: [{ startMs: 0, endMs: 1000, text: "Hello." }],
      }).segments,
    ).toHaveLength(1);
    expect(() =>
      videoTranscript.parse({
        language: "en",
        segments: [
          { startMs: 2000, endMs: 3000, text: "Second" },
          { startMs: 1000, endMs: 1500, text: "First" },
        ],
      }),
    ).toThrow();
  });
});
describe("Revisão e recompensas", () => {
  it("agenda pelo FSRS e mantém estado completo restaurável", () => {
    const now = new Date("2026-09-14T12:00:00Z"),
      card = initialCard(now),
      next = scheduleCard(JSON.parse(JSON.stringify(card)), 3, now);
    expect(next.card.reps).toBe(1);
    expect(next.card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(next.log.rating).toBe(3);
  });
  it("rejeita notas inexistentes e separa nível cosmético", () => {
    expect(() => scheduleCard(initialCard(), 7)).toThrow();
    expect(xpLevel(0)).toBe(1);
    expect(xpLevel(100)).toBe(2);
  });
});
describe("Orçamento", () => {
  it("calcula em micros de dólar sem arredondar centavos por chamada", () => {
    expect(tokenCostMicros(1000000, 1000000, 0.3, 2.5)).toBe(2800000);
    expect(tokenCostMicros(1, 1, 0.3, 2.5)).toBe(3);
  });
  it("usa o mês do fuso de estudo", () => {
    expect(budgetPeriod(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09");
  });
  it("não conta thinking duas vezes quando total_output já inclui o total gerado", () => {
    expect(
      normalizeUsage({
        total_input_tokens: 100,
        total_output_tokens: 40,
        total_thought_tokens: 10,
        total_tokens: 140,
      }),
    ).toEqual({ input: 100, output: 40 });
    expect(
      normalizeUsage({
        total_input_tokens: 100,
        total_output_tokens: 30,
        total_thought_tokens: 10,
        total_tokens: 140,
      }),
    ).toEqual({ input: 100, output: 40 });
  });
  it("não trata medição ausente como chamada gratuita", () => {
    expect(() => normalizeUsage({ total_input_tokens: 10 })).toThrow();
  });
});

describe("Ajuste de tempo da transcrição de vídeo", () => {
  it("não mexe em trechos que já cabem na duração", () => {
    const segments = [
      { startMs: 0, endMs: 10000 },
      { startMs: 10000, endMs: 60000 },
    ];
    expect(fitTranscriptToDuration(segments, 60000)).toEqual(segments);
  });

  it("reescala proporcionalmente o drift do provedor e preserva a ordem", () => {
    // Caso real medido em 2026-09-16: vídeo de 837 s devolvido com o trecho
    // final em 936 s, sendo esse trecho o encerramento real do vídeo.
    const segments = [
      { startMs: 1099, endMs: 13999 },
      { startMs: 13999, endMs: 23999 },
      { startMs: 923999, endMs: 935999 },
    ];
    const fitted = fitTranscriptToDuration(segments, 837000);
    expect(fitted[fitted.length - 1].endMs).toBe(837000);
    expect(fitted.every((s) => s.endMs > s.startMs)).toBe(true);
    for (let i = 1; i < fitted.length; i++)
      expect(fitted[i].startMs).toBeGreaterThanOrEqual(fitted[i - 1].startMs);
  });

  it("preserva campos que não são de tempo", () => {
    const fitted = fitTranscriptToDuration(
      [{ startMs: 0, endMs: 120000, text: "hello" }],
      100000,
    );
    expect(fitted[0].text).toBe("hello");
    expect(fitted[0].endMs).toBe(100000);
  });

  it("recusa tempos que não são drift, mas erro de unidade", () => {
    // Segundos no lugar de milissegundos: 837 s viram 837000 s.
    expect(() =>
      fitTranscriptToDuration([{ startMs: 0, endMs: 837000000 }], 837000),
    ).toThrow();
  });

  it("reescala drift grande em vez de recusar a transcrição inteira", () => {
    // Caso real de 2026-09-17: 990 s para um vídeo de 636 s (1,56×). Com o teto
    // antigo de 1,5 isso era recusado, e a chamada paga voltava sem nada.
    const fitted = fitTranscriptToDuration(
      [
        { startMs: 0, endMs: 12000 },
        { startMs: 600000, endMs: 990000 },
      ],
      636000,
    );
    expect(fitted.at(-1)!.endMs).toBe(636000);
    expect(fitted.every((s) => s.endMs <= 636000 && s.startMs >= 0)).toBe(true);
  });

  it("ancora no fim do último trecho, não no maior endMs de todos", () => {
    // O trecho do meio está fora da curva. Ele é aparado na duração; os outros
    // dois, que já cabiam, ficam intactos — antes um deles derrubava tudo.
    const fitted = fitTranscriptToDuration(
      [
        { startMs: 0, endMs: 12000 },
        { startMs: 300000, endMs: 9990000 },
        { startMs: 600000, endMs: 630000 },
      ],
      636000,
    );
    expect(fitted[0]).toEqual({ startMs: 0, endMs: 12000 });
    expect(fitted[1].endMs).toBe(636000);
    expect(fitted[2]).toEqual({ startMs: 600000, endMs: 630000 });
  });
});

describe("Piso de cobertura da transcrição de vídeo", () => {
  it("recusa a resposta truncada de 2026-09-17 dizendo quanto foi coberto", () => {
    // Caso real: 5 trechos cobrindo 111 s de um vídeo de 837 s.
    const segments = [
      { startMs: 0, endMs: 11000 },
      { startMs: 58000, endMs: 111000 },
    ];
    expect(() => assertTranscriptCoverage(segments, 837000)).toThrow(
      "13% do vídeo",
    );
    try {
      assertTranscriptCoverage(segments, 837000);
    } catch (error) {
      expect(error).toMatchObject({ code: "INCOMPLETE_TRANSCRIPT" });
      expect((error as Error).message).toContain("1min 51s de 13min 57s");
    }
  });

  it("aceita transcrição completa e encerramento curto sem fala", () => {
    expect(assertTranscriptCoverage([{ endMs: 837000 }], 837000)).toBe(837000);
    // Vinheta final de 90 s: 89% do vídeo, dentro da folga do piso.
    expect(assertTranscriptCoverage([{ endMs: 747000 }], 837000)).toBe(747000);
  });

  it("não deixa a ordem de checagem depender do reescalonamento", () => {
    // Drift do provedor devolve tempos além da duração: cobertura sobra, e o
    // ajuste continua sendo quem cuida disso.
    const segments = [{ startMs: 0, endMs: 936000 }];
    expect(assertTranscriptCoverage(segments, 837000)).toBe(936000);
    expect(fitTranscriptToDuration(segments, 837000)[0].endMs).toBe(837000);
  });
});

describe("Divergência de idioma declarado × detectado (TASK-014, RN-05)", () => {
  it("não sinaliza divergência entre variantes do mesmo idioma", () => {
    expect(languageDiverges("en-US", "en")).toBe(false);
    expect(languageDiverges("en-US", "English")).toBe(false);
    expect(languageDiverges("pt-BR", "pt-PT")).toBe(false);
  });
  it("sinaliza divergência entre idiomas realmente diferentes", () => {
    expect(languageDiverges("es-ES", "en")).toBe(true);
    expect(languageDiverges("en-US", "japanese")).toBe(true);
  });
});

describe("Catálogo de letras LRCLIB (TASK-019)", () => {
  const record = {
    id: 42,
    trackName: "Green Build",
    artistName: "The Linters",
    albumName: "Fixtures",
    duration: 183.4,
    instrumental: false,
    plainLyrics: "The build is green again",
    syncedLyrics: "[00:01.50] The build is green again",
  };
  it("nenhuma entrada altera host, protocolo ou caminho (CA-04)", () => {
    for (const q of [
      "drake not you too",
      "https://evil.example/x",
      "//evil.example",
      "../../admin?x=1#frag",
      "@evil.example",
      "a&q=b&host=evil",
      "naïve café 日本",
    ]) {
      const url = lyricsSearchUrl(q);
      expect([url.protocol, url.host, url.pathname]).toEqual([
        "https:",
        "lrclib.net",
        "/api/search",
      ]);
      expect([...url.searchParams.keys()]).toEqual(["q"]);
      expect(url.searchParams.get("q")).toBe(q.trim());
      expect(url.username + url.password + url.port + url.hash).toBe("");
    }
    expect(lyricsGetUrl("123").href).toBe("https://lrclib.net/api/get/123");
    expect(lyricsGetUrl(7).href).toBe("https://lrclib.net/api/get/7");
    for (const id of [
      "../search",
      "1/../../x",
      "https://evil.example",
      "-1",
      "0",
      "1.5",
      "",
      "abc",
      "1e400",
    ])
      expect(() => lyricsGetUrl(id)).toThrow();
  });
  it("busca exige de 1 a 200 caracteres", () => {
    expect(() => lyricsSearchUrl("   ")).toThrow();
    expect(() => lyricsSearchUrl("a".repeat(201))).toThrow();
    expect(() => lyricsSearchUrl(undefined)).toThrow();
    expect(lyricsSearchUrl("a".repeat(200)).searchParams.get("q")).toHaveLength(
      200,
    );
  });
  it("registro descarta campo fora do contrato e resume sem a letra (RN-03)", () => {
    const parsed = lyricsRecord.parse({
      ...record,
      lyricsfile: "version: 1",
      name: "extra",
    });
    expect(parsed).not.toHaveProperty("lyricsfile");
    expect(lyricsSummary(parsed)).toEqual({
      id: 42,
      title: "Green Build",
      artist: "The Linters",
      album: "Fixtures",
      durationMs: 183400,
      instrumental: false,
      hasSynced: true,
      hasPlain: true,
    });
    expect(() => lyricsRecord.parse({ ...record, id: "42" })).toThrow();
    expect(() =>
      lyricsRecord.parse({ ...record, instrumental: undefined }),
    ).toThrow();
  });
  it("instrumental aparece marcado e sem letra, não some (RN-08)", () => {
    expect(
      lyricsSummary(
        lyricsRecord.parse({
          ...record,
          instrumental: true,
          plainLyrics: null,
          syncedLyrics: null,
          albumName: null,
          duration: null,
        }),
      ),
    ).toMatchObject({
      instrumental: true,
      hasSynced: false,
      hasPlain: false,
      album: null,
      durationMs: null,
    });
  });
});

describe("Música como fonte (TASK-020)", () => {
  const base = {
    id: 7,
    trackName: "Green Build",
    artistName: "The Linters",
    albumName: null,
    duration: 12,
    instrumental: false,
    plainLyrics: "The build is green again\nShip it before lunch",
    syncedLyrics:
      "[00:01.50] The build is green again\n[00:04.00] Ship it before lunch",
  };
  it("entrada aceita só ID do catálogo, idioma e link opcional; nunca texto nem direitos", () => {
    const parsed = lyricsImportInput.parse({
      catalogId: "7",
      text: "forjado",
      rights: "owned",
      videoUrl: "",
    });
    expect(parsed).toEqual({
      catalogId: 7,
      language: "en-US",
      videoUrl: undefined,
    });
    expect(LYRICS_RIGHTS).toBe("third_party");
    for (const catalogId of [0, -1, "x", "../1", 1.5])
      expect(() => lyricsImportInput.parse({ catalogId })).toThrow();
    expect(() =>
      lyricsImportInput.parse({ catalogId: 7, language: "xx-XX" }),
    ).toThrow();
  });
  it("letra sincronizada vira trechos com tempo aproximado (RN-01)", () => {
    expect(lyricsSegments(lyricsRecord.parse(base))).toEqual([
      {
        startMs: 1500,
        endMs: 4000,
        text: "The build is green again",
        timeAccuracy: "approximate",
      },
      {
        startMs: 4000,
        endMs: null,
        text: "Ship it before lunch",
        timeAccuracy: "approximate",
      },
    ]);
  });
  it("só texto simples entra sem tempo; sincronizada inválida cai para o texto simples (RN-01)", () => {
    for (const syncedLyrics of [null, "[00:61.00] bad\n[00:62.00] worse"])
      for (const segment of lyricsSegments(
        lyricsRecord.parse({ ...base, syncedLyrics }),
      ))
        expect(segment).toMatchObject({
          startMs: null,
          endMs: null,
          timeAccuracy: "none",
        });
  });
  it("instrumental ou sem letra é LYRICS_EMPTY (RN-06)", () => {
    for (const record of [
      { ...base, instrumental: true },
      { ...base, plainLyrics: null, syncedLyrics: null },
      { ...base, plainLyrics: "  ", syncedLyrics: "" },
    ])
      expect(() => lyricsSegments(lyricsRecord.parse(record))).toThrow(
        expect.objectContaining({ code: "LYRICS_EMPTY" }),
      );
  });
});

describe("Aba Música (TASK-021)", () => {
  it("formata duração de faixa como m:ss, arredondando ao segundo", () => {
    expect(songDuration(270000)).toBe("4:30");
    expect(songDuration(183400)).toBe("3:03");
    expect(songDuration(59600)).toBe("1:00");
    expect(songDuration(5000)).toBe("0:05");
    expect(songDuration(3723000)).toBe("62:03");
    expect(songDuration(null)).toBeNull();
    expect(songDuration(-1)).toBeNull();
  });
  it("rótulo de letra nunca fala em tempo quando a letra entrou sem sincronia (RN-03)", () => {
    expect(lyricsSegmentLabel("approximate")).toBe(
      "Letra da comunidade (LRCLIB), não revisada · tempo aproximado",
    );
    expect(lyricsSegmentLabel("none")).toBe(
      "Letra da comunidade (LRCLIB), não revisada · sem tempo",
    );
  });
});

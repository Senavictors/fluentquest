import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  openaiCreate: vi.fn(),
  reserve: vi.fn(),
  settle: vi.fn(),
  fail: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: mocks.create };
  },
}));
vi.mock("openai", () => ({
  default: class {
    responses = { create: mocks.openaiCreate };
  },
}));
vi.mock("../src/server/db", () => ({ query: mocks.query }));
vi.mock("../src/server/budget", () => ({
  reserveBudget: mocks.reserve,
  settleBudget: mocks.settle,
  failBudget: mocks.fail,
  tokenCostMicros: (i: number, o: number, ip: number, op: number) =>
    Math.ceil(i * ip + o * op),
  videoTranscriptionEstimateMicros: (
    durationMs: number,
    inputPrice: number,
    outputPrice: number,
  ) =>
    Math.ceil(
      (Math.ceil(durationMs / 1000) * 100 + 4096) * inputPrice * 1.25 +
        8000 * outputPrice * 1.25,
    ),
}));
import {
  gemini,
  integrationStatus,
  openai,
  requireAI,
  youtube,
} from "../src/server/providers";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "fixture-only");
  vi.stubEnv("AI_PRICES_REVIEWED_ON", new Date().toISOString().slice(0, 10));
  vi.stubEnv("GEMINI_INPUT_USD_PER_MILLION", "1");
  vi.stubEnv("GEMINI_OUTPUT_USD_PER_MILLION", "2");
  vi.stubEnv("OPENAI_API_KEY", "fixture-openai");
  vi.stubEnv(
    "OPENAI_PRICES_REVIEWED_ON",
    new Date().toISOString().slice(0, 10),
  );
  vi.stubEnv("OPENAI_INPUT_USD_PER_MILLION", "0.15");
  vi.stubEnv("OPENAI_OUTPUT_USD_PER_MILLION", "0.6");
  vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  // Cache sempre vazio, disjuntor sempre fechado. Responder por SQL em vez de
  // por ordem mantém o fixture válido para chamadas que pulam o cache (vídeo).
  mocks.query.mockImplementation(async (sql: string) =>
    sql.includes("result_cache") ? [] : [{ n: 0 }],
  );
  mocks.reserve.mockResolvedValue("reservation-fixture");
  mocks.create.mockResolvedValue({
    output_text: "Fixture response",
    status: "completed",
    usage: { total_input_tokens: 10, total_output_tokens: 5 },
  });
  mocks.openaiCreate.mockResolvedValue({
    output_text: "OpenAI fixture response",
    status: "completed",
    usage: { input_tokens: 10, output_tokens: 5 },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Configuração e inferência sem tráfego externo", () => {
  it.each([undefined, "", "NaN", "-1", "0"])(
    "recusa preço de entrada ausente ou inválido: %s",
    (value) => {
      vi.stubEnv("GEMINI_INPUT_USD_PER_MILLION", value);
      expect(integrationStatus().ai).toBe(false);
      expect(() => requireAI()).toThrow("Revise os preços");
    },
  );
  it.each(["2026-02-30", "2099-01-01", "2020-01-01", "invalid"])(
    "recusa revisão inválida, futura ou vencida: %s",
    (date) => {
      vi.stubEnv("AI_PRICES_REVIEWED_ON", date);
      expect(() => requireAI()).toThrow("Revise os preços");
    },
  );
  it("não reserva nem chama SDK quando IA está desligada", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    await expect(
      gemini.explain("user", "text", "question"),
    ).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONFIGURED" });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reserva antes da chamada, concilia e desliga retries do SDK", async () => {
    await expect(gemini.explain("user", "text", "question")).resolves.toBe(
      "Fixture response",
    );
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.create.mock.invocationCallOrder[0],
    );
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      maxRetries: 0,
    });
    expect(mocks.settle).toHaveBeenCalledWith(
      "reservation-fixture",
      expect.objectContaining({ input: 10, output: 5, micros: 20 }),
    );
  });
  it("mantém configurações e preços isolados por provedor", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(integrationStatus()).toMatchObject({ gemini: true, openai: false });
    vi.stubEnv("AI_TEXT_PROVIDER", "openai");
    expect(integrationStatus().ai).toBe(false);
    expect(() => requireAI()).toThrow("Integração não configurada");
  });
  it("usa OpenAI com reserva, cache e conciliação próprios", async () => {
    await expect(openai.explain("user", "text", "question")).resolves.toBe(
      "OpenAI fixture response",
    );
    expect(mocks.reserve).toHaveBeenCalledWith(
      "user",
      "Tutor contextual",
      expect.any(Number),
      "openai",
      "gpt-4o-mini",
    );
    expect(mocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        store: false,
        instructions: expect.any(String),
      }),
    );
    expect(mocks.settle).toHaveBeenCalledWith(
      "reservation-fixture",
      expect.objectContaining({
        model: "gpt-4o-mini",
        input: 10,
        output: 5,
        micros: 5,
      }),
    );
  });
  it.each([408, 500, undefined])(
    "mantém reserva em falha ambígua %s sem repetir",
    async (status) => {
      mocks.create.mockRejectedValue({ status });
      await expect(
        gemini.explain("user", "text", "question"),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
      expect(mocks.fail).toHaveBeenCalledWith("reservation-fixture", true);
      expect(mocks.create).toHaveBeenCalledTimes(1);
    },
  );
  it("libera reserva em 429 explícito sem repetir", async () => {
    mocks.create.mockRejectedValue({ status: 429 });
    await expect(gemini.explain("user", "text", "question")).rejects.toThrow();
    expect(mocks.fail).toHaveBeenCalledWith("reservation-fixture", false);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("explica quando o Gemini recusa um vídeo após recebê-lo", async () => {
    mocks.create.mockRejectedValue({ status: 400 });
    await expect(
      gemini.transcribeVideo(
        "user",
        "https://www.youtube.com/watch?v=abcdefghijk",
        60000,
      ),
    ).rejects.toMatchObject({ code: "VIDEO_PROVIDER_REJECTED" });
    expect(mocks.fail).toHaveBeenCalledWith("reservation-fixture", false);
  });
  it("explica alta demanda de vídeo sem liberar uma reserva ambígua", async () => {
    mocks.create.mockRejectedValue({
      status: 500,
      message: "500 gemini-3.8-flash is currently experiencing high demand",
    });
    await expect(
      gemini.transcribeVideo(
        "user",
        "https://www.youtube.com/watch?v=abcdefghijk",
        60000,
      ),
    ).rejects.toMatchObject({ code: "VIDEO_PROVIDER_BUSY" });
    expect(mocks.fail).toHaveBeenCalledWith("reservation-fixture", true);
  });
  it("concilia uso de saída truncada mas não salva resposta em cache", async () => {
    mocks.create.mockResolvedValue({
      output_text: "Partial",
      status: "incomplete",
      usage: { total_input_tokens: 10, total_output_tokens: 5 },
    });
    await expect(
      gemini.explain("user", "text", "question"),
    ).rejects.toMatchObject({ code: "INCOMPLETE_RESPONSE" });
    expect(mocks.settle).toHaveBeenCalledTimes(1);
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO result_cache"),
      ),
    ).toBe(false);
  });
  it("mantém reserva sem medição de uso e não salva resultado", async () => {
    mocks.create.mockResolvedValue({
      output_text: "Unmeasured",
      status: "completed",
    });
    await expect(
      gemini.explain("user", "text", "question"),
    ).rejects.toMatchObject({ code: "USAGE_UNKNOWN" });
    expect(mocks.fail).toHaveBeenCalledWith("reservation-fixture", true);
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO result_cache"),
      ),
    ).toBe(false);
  });
});

describe("Metadados YouTube com resposta controlada", () => {
  it("preserva duração acima de uma hora e disponibilidade real", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "fixture-only");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: { title: "Long video", channelTitle: "Fixture" },
              contentDetails: { duration: "PT1H2M3S" },
              status: { embeddable: false },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await youtube.get("abcdefghijk")).toEqual({
      title: "Long video",
      author: "Fixture",
      durationMs: 3723000,
      available: false,
    });
    expect(fetcher.mock.calls[0][0].origin).toBe("https://www.googleapis.com");
  });
  it("rejeita ID inválido antes do fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(youtube.get("abcdefghijk&extra=1")).rejects.toMatchObject({
      code: "INVALID_URL",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Transcrição de vídeo por URL sem tráfego externo", () => {
  it("reserva antes, envia a URL canônica pela Interactions API e valida os trechos", async () => {
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [
          { startMs: 0, endMs: 12000, text: "A faithful fixture." },
          { startMs: 480000, endMs: 495000, text: "And its ending." },
        ],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 50000,
        total_output_tokens: 1000,
        total_tokens: 51000,
      },
    });
    await expect(
      gemini.transcribeVideo(
        "user",
        "https://youtu.be/abcdefghijk?t=12",
        495000,
      ),
    ).resolves.toMatchObject({ language: "en" });
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.create.mock.invocationCallOrder[0],
    );
    expect(mocks.reserve).toHaveBeenCalledWith(
      "user",
      "Transcrição de vídeo por URL",
      expect.any(Number),
      "gemini",
      expect.any(String),
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({
            type: "video",
            uri: "https://www.youtube.com/watch?v=abcdefghijk",
          }),
        ]),
      }),
      { maxRetries: 0 },
    );
    // gemini-3.5-flash-lite falha sob processamento agêntico (400 "invalid JSON
    // syntax" / 500 "high demand"); o padrão estático transcreve o mesmo vídeo.
    expect(
      mocks.create.mock.calls[0][0].input.find(
        (block: { type: string }) => block.type === "video",
      ),
    ).not.toHaveProperty("processing");
    const request = mocks.create.mock.calls[0][0];
    const serializedSchema = JSON.stringify(request.response_format.schema);
    for (const unsupportedKeyword of [
      "$schema",
      "exclusiveMinimum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
    ])
      expect(serializedSchema).not.toContain(`"${unsupportedKeyword}"`);
  });

  it("rejeita duração excessiva antes de reservar ou chamar o provedor", async () => {
    await expect(
      gemini.transcribeVideo(
        "user",
        "https://www.youtube.com/watch?v=abcdefghijk",
        900001,
      ),
    ).rejects.toMatchObject({ code: "VIDEO_TOO_LONG" });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("usa modelo e preços de vídeo revisados separadamente quando configurados", async () => {
    vi.stubEnv("GEMINI_VIDEO_MODEL", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_VIDEO_INPUT_USD_PER_MILLION", "0.75");
    vi.stubEnv("GEMINI_VIDEO_OUTPUT_USD_PER_MILLION", "3.75");
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [{ startMs: 0, endMs: 60000, text: "Fixture." }],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 100,
        total_output_tokens: 20,
        total_tokens: 120,
      },
    });
    await gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 60000);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.8-flash",
        generation_config: expect.objectContaining({
          max_output_tokens: 8000,
        }),
      }),
      { maxRetries: 0 },
    );
    expect(mocks.create.mock.calls[0][0].generation_config).not.toHaveProperty(
      "thinking_level",
    );
    expect(
      mocks.create.mock.calls[0][0].input.find(
        (block: { type: string }) => block.type === "video",
      ),
    ).toMatchObject({ processing: "agentic" });
    expect(mocks.settle).toHaveBeenCalledWith(
      "reservation-fixture",
      expect.objectContaining({ model: "gemini-3.8-flash", micros: 150 }),
    );
  });

  it("recusa a resposta truncada de 2026-09-17 e mantém a conciliação", async () => {
    // 5 trechos até 111 s de um vídeo de 837 s: schema satisfeito, vídeo não.
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [
          { startMs: 0, endMs: 11000, text: "This here is a fixture." },
          { startMs: 58000, endMs: 111000, text: "Let's get to it." },
        ],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 76332,
        total_output_tokens: 378,
        total_tokens: 76710,
      },
    });
    await expect(
      gemini.transcribeVideo(
        "user",
        "https://www.youtube.com/watch?v=abcdefghijk",
        837000,
      ),
    ).rejects.toMatchObject({ code: "INCOMPLETE_TRANSCRIPT" });
    // A chamada aconteceu e foi cobrada; recusar o texto não desfaz isso.
    expect(mocks.settle).toHaveBeenCalledTimes(1);
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("registra a linha do tempo recusada em vez de perder a chamada paga", async () => {
    // Caso real de 2026-09-17: vídeo de 636 s recusado três vezes seguidas por
    // INVALID_TRANSCRIPT_TIME, sem que restasse um número para diagnosticar.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [
          { startMs: 0, endMs: 12000, text: "Opening." },
          { startMs: 600000, endMs: 990000, text: "Closing." },
        ],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 58032,
        total_output_tokens: 5158,
        total_tokens: 63190,
      },
    });
    await expect(
      gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 636000),
    ).rejects.toMatchObject({ code: "INVALID_TRANSCRIPT_TIME" });
    expect(logged).toHaveBeenCalledWith(
      "AI_REJECTED_TRANSCRIPT",
      expect.objectContaining({
        code: "INVALID_TRANSCRIPT_TIME",
        durationMs: 636000,
        segments: 2,
        lastEndMs: 990000,
        maxEndMs: 990000,
      }),
    );
    logged.mockRestore();
  });

  it("deixa visível que um único trecho absurdo derruba a transcrição inteira", async () => {
    // Math.max sobre todos os endMs: um trecho fora da curva decide sozinho.
    // Comportamento atual, registrado aqui para a decisão de MAX_TIME_DRIFT não
    // ser tomada sem enxergar esta sensibilidade.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [
          { startMs: 0, endMs: 12000, text: "Opening." },
          { startMs: 300000, endMs: 9990000, text: "Um tempo absurdo." },
          { startMs: 600000, endMs: 630000, text: "Closing." },
        ],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 100,
        total_output_tokens: 20,
        total_tokens: 120,
      },
    });
    await expect(
      gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 636000),
    ).rejects.toMatchObject({ code: "INVALID_TRANSCRIPT_TIME" });
    expect(logged).toHaveBeenCalledWith(
      "AI_REJECTED_TRANSCRIPT",
      // lastEndMs cabe na duração; só maxEndMs estoura. O log separa os dois.
      expect.objectContaining({ lastEndMs: 630000, maxEndMs: 9990000 }),
    );
    logged.mockRestore();
  });

  it("não guarda transcrição de vídeo em cache, para não prender a nova tentativa", async () => {
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [{ startMs: 0, endMs: 60000, text: "Fixture." }],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 100,
        total_output_tokens: 20,
        total_tokens: 120,
      },
    });
    await gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 60000);
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO result_cache"),
      ),
    ).toBe(false);
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("SELECT value FROM result_cache"),
      ),
    ).toBe(false);
  });
});

describe("Resposta cobrada que não passa na validação", () => {
  it("não chama de indisponibilidade do provedor um schema reprovado", async () => {
    mocks.create.mockResolvedValue({
      output_text: JSON.stringify({
        language: "en",
        segments: [
          { startMs: 20000, endMs: 30000, text: "Out of order." },
          { startMs: 1000, endMs: 5000, text: "Earlier." },
        ],
      }),
      status: "completed",
      usage: {
        total_input_tokens: 50,
        total_output_tokens: 10,
        total_tokens: 60,
      },
    });
    await expect(
      gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 60000),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_OUTPUT" });
    expect(mocks.settle).toHaveBeenCalledTimes(1);
  });

  it("separa resposta que não é JSON de falha de rede", async () => {
    mocks.create.mockResolvedValue({
      output_text: "Desculpe, não consegui transcrever este vídeo.",
      status: "completed",
      usage: {
        total_input_tokens: 50,
        total_output_tokens: 10,
        total_tokens: 60,
      },
    });
    await expect(
      gemini.transcribeVideo("user", "https://youtu.be/abcdefghijk", 60000),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_OUTPUT" });
  });

  it("não guarda em cache um resultado que reprovou na validação", async () => {
    mocks.create.mockResolvedValue({
      output_text: "{ não é json }",
      status: "completed",
      usage: {
        total_input_tokens: 50,
        total_output_tokens: 10,
        total_tokens: 60,
      },
    });
    await expect(
      gemini.support("user", "A sentence to support."),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_OUTPUT" });
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO result_cache"),
      ),
    ).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  youtubeId,
  parseContent,
  normalize,
  validateVideoTranscriptionDuration,
  videoTranscript,
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
  it("deduplica expressão sem fundir sentidos diferentes", () => {
    expect(normalize("  Under   LOAD ")).toBe("under load");
    expect(normalize("carga de trabalho")).not.toBe(normalize("carregamento"));
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

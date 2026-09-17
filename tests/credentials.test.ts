import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/server/db", () => ({ query: mocks.query }));
import {
  credential,
  credentialHint,
  credentialInput,
  credentialState,
  clearCredential,
  refreshCredentials,
  setCredential,
} from "../src/server/credentials";

// A chave cifrada só é legível de volta dentro do processo que tem o segredo.
// Os testes cobrem exatamente isso: o que entra pelo `setCredential` sai pelo
// `credential`, o banco nunca guarda o valor em claro, e um segredo trocado
// derruba a chave para "ausente" em vez de derrubar a aplicação.
const rows: Record<string, unknown>[] = [];
beforeEach(() => {
  rows.length = 0;
  process.env.BETTER_AUTH_SECRET = "x".repeat(40);
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  mocks.query.mockImplementation(async (text: string, values: unknown[]) => {
    if (text.startsWith("SELECT"))
      return rows.filter((r) => r.user_id === values[0]);
    if (text.startsWith("INSERT")) {
      const [user_id, provider, ciphertext, iv, tag, hint] = values as string[];
      const index = rows.findIndex(
        (r) => r.user_id === user_id && r.provider === provider,
      );
      const row = {
        user_id,
        provider,
        ciphertext,
        iv,
        tag,
        hint,
        updated_at: new Date("2026-09-17T12:00:00Z"),
      };
      if (index < 0) rows.push(row);
      else rows[index] = row;
      return [];
    }
    if (text.startsWith("DELETE")) {
      const index = rows.findIndex(
        (r) => r.user_id === values[0] && r.provider === values[1],
      );
      if (index >= 0) rows.splice(index, 1);
      return [];
    }
    return [];
  });
});
afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
});

describe("Chaves de integração", () => {
  it("devolve a chave cadastrada e nunca a guarda em claro", async () => {
    await setCredential("owner", "gemini", "AIzaSyTESTCHAVEDEEXEMPLO0001");
    expect(credential("gemini")).toBe("AIzaSyTESTCHAVEDEEXEMPLO0001");
    expect(JSON.stringify(rows)).not.toContain("AIzaSyTESTCHAVEDEEXEMPLO0001");
    expect(credentialState("gemini")).toMatchObject({
      configured: true,
      origin: "interface",
      hint: "••••0001",
    });
  });
  it("cai para a variável de ambiente quando não há chave cadastrada", async () => {
    process.env.YOUTUBE_API_KEY = "AIzaSyVINDADOAMBIENTE00009999";
    await refreshCredentials("owner", true);
    expect(credential("youtube")).toBe("AIzaSyVINDADOAMBIENTE00009999");
    expect(credentialState("youtube")).toMatchObject({
      configured: true,
      origin: "ambiente",
      hint: "••••9999",
    });
  });
  it("a chave cadastrada tem precedência sobre a do ambiente", async () => {
    process.env.GEMINI_API_KEY = "AIzaSyVELHADOAMBIENTE00001111";
    await setCredential("owner", "gemini", "AIzaSyNOVACADASTRADA00002222");
    expect(credential("gemini")).toBe("AIzaSyNOVACADASTRADA00002222");
    await clearCredential("owner", "gemini");
    expect(credential("gemini")).toBe("AIzaSyVELHADOAMBIENTE00001111");
    expect(credentialState("gemini").origin).toBe("ambiente");
  });
  it("segredo de assinatura trocado torna a chave ausente, não um erro", async () => {
    await setCredential("owner", "openai", "sk-proj-TESTECHAVEEXEMPLO3333");
    process.env.BETTER_AUTH_SECRET = "y".repeat(40);
    await refreshCredentials("owner", true);
    expect(credential("openai")).toBeUndefined();
    expect(credentialState("openai").configured).toBe(false);
  });
  it("recarrega ao trocar de usuário em vez de devolver a chave alheia", async () => {
    await setCredential("owner", "gemini", "AIzaSyDOPROPRIETARIO00004444");
    await refreshCredentials("outro", true);
    expect(credential("gemini")).toBeUndefined();
  });
  it("recusa entrada que não tem forma de chave", () => {
    expect(credentialInput.safeParse("curta").success).toBe(false);
    expect(credentialInput.safeParse("chave com espaco no meio").success).toBe(
      false,
    );
    expect(
      credentialInput.safeParse("AIzaSy_valida-0123456789ABC").success,
    ).toBe(true);
    expect(credentialHint("abcdefgh")).toBe("••••efgh");
  });
});

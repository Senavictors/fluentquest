import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { AppError } from "../domain/content";
import { query } from "./db";

export const CREDENTIAL_PROVIDERS = ["gemini", "openai", "youtube"] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];
export const credentialProvider = z.enum(CREDENTIAL_PROVIDERS);

// Uma chave vinda da interface tem exatamente o mesmo poder de gasto que a do
// ambiente, então vale a pena recusar cedo o que claramente não é uma chave:
// espaço, quebra de linha ou aspas coladas num copiar-e-colar. Formatos reais
// hoje: `AIza…` (Gemini e YouTube, 39 caracteres) e `sk-…` (OpenAI, com `-` e
// `_`). O limite superior é folgado de propósito — o formato do provedor muda
// sem avisar, e recusar uma chave válida é pior do que aceitar uma inválida,
// que o provedor rejeita na primeira chamada.
export const credentialInput = z
  .string()
  .trim()
  .min(16, "A chave informada é curta demais para ser válida.")
  .max(300, "A chave informada excede o tamanho aceito.")
  .regex(
    /^[A-Za-z0-9._\-]+$/,
    "A chave deve conter apenas letras, números e os sinais . _ -",
  );

const ENV_NAME: Record<CredentialProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  youtube: "YOUTUBE_API_KEY",
};

export type CredentialOrigin = "interface" | "ambiente";
export type CredentialState = {
  configured: boolean;
  origin: CredentialOrigin | null;
  hint: string | null;
  updatedAt: string | null;
};

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(
      "CREDENTIAL_KEY_MISSING",
      "Defina BETTER_AUTH_SECRET antes de guardar chaves pela interface.",
      503,
    );
  // Derivada, e não usada crua: a mesma string assina sessão em `auth.ts`, e
  // separar os usos evita que um valor cifrado aqui diga qualquer coisa sobre
  // a chave de assinatura.
  return createHash("sha256")
    .update(`fluentquest:credential:v1:${secret}`)
    .digest();
}

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function unseal(row: { ciphertext: string; iv: string; tag: string }) {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(row.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(row.tag, "base64"));
    return (
      decipher.update(
        Buffer.from(row.ciphertext, "base64"),
        undefined,
        "utf8",
      ) + decipher.final("utf8")
    );
  } catch {
    // BETTER_AUTH_SECRET trocado depois do cadastro: o registro existe mas não
    // abre mais. Devolver null faz a chave contar como ausente — "integração
    // não configurada", que é o estado verdadeiro — em vez de derrubar a tela
    // inteira de Ajustes.
    return null;
  }
}

export const credentialHint = (value: string) =>
  value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;

// Cache de processo. `providerConfig()` e `youtube.get()` são síncronos e são
// chamados de dentro dos adaptadores, longe de qualquer `userId`; carregar do
// banco ali dentro exigiria tornar assíncrona metade de `providers.ts`.
//
// O cache é global porque a instalação é de proprietário único por construção
// (`scripts/owner.ts` recusa criar um segundo) — e mesmo assim guarda o
// `userId` carregado, para que um segundo usuário hipotético force recarga em
// vez de ler a chave alheia. Todo ponto de entrada (`handle()` em `api.ts`,
// cada job do worker) chama `refreshCredentials()` para o seu usuário antes de
// qualquer caminho que possa chamar provedor.
const CACHE_TTL_MS = 10_000;
let cache: {
  userId: string;
  at: number;
  keys: Partial<Record<CredentialProvider, string>>;
  states: Record<CredentialProvider, CredentialState>;
} | null = null;

const emptyStates = (): Record<CredentialProvider, CredentialState> =>
  Object.fromEntries(
    CREDENTIAL_PROVIDERS.map((provider) => [
      provider,
      { configured: false, origin: null, hint: null, updatedAt: null },
    ]),
  ) as Record<CredentialProvider, CredentialState>;

export async function refreshCredentials(userId: string, force = false) {
  if (
    !force &&
    cache &&
    cache.userId === userId &&
    Date.now() - cache.at < CACHE_TTL_MS
  )
    return;
  const rows = await query<{
    provider: CredentialProvider;
    ciphertext: string;
    iv: string;
    tag: string;
    hint: string;
    updated_at: Date;
  }>(
    "SELECT provider,ciphertext,iv,tag,hint,updated_at FROM integration_credentials WHERE user_id=$1",
    [userId],
  );
  const keys: Partial<Record<CredentialProvider, string>> = {};
  const states = emptyStates();
  for (const row of rows) {
    const value = unseal(row);
    if (!value) continue;
    keys[row.provider] = value;
    states[row.provider] = {
      configured: true,
      origin: "interface",
      hint: row.hint,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
  cache = { userId, at: Date.now(), keys, states };
}

// A chave da interface vence a do ambiente: quem acabou de cadastrar espera que
// a próxima chamada use o que acabou de digitar, e não um valor esquecido em
// `.env.local`.
export function credential(provider: CredentialProvider): string | undefined {
  return cache?.keys[provider] || process.env[ENV_NAME[provider]] || undefined;
}

export function credentialState(provider: CredentialProvider): CredentialState {
  const stored = cache?.states[provider];
  if (stored?.configured) return stored;
  const fromEnv = process.env[ENV_NAME[provider]];
  return fromEnv
    ? {
        configured: true,
        origin: "ambiente",
        hint: credentialHint(fromEnv),
        updatedAt: null,
      }
    : { configured: false, origin: null, hint: null, updatedAt: null };
}

export const credentialStates = () =>
  Object.fromEntries(
    CREDENTIAL_PROVIDERS.map((provider) => [
      provider,
      credentialState(provider),
    ]),
  ) as Record<CredentialProvider, CredentialState>;

export const credentialEnvName = (provider: CredentialProvider) =>
  ENV_NAME[provider];

export async function setCredential(
  userId: string,
  provider: CredentialProvider,
  value: string,
) {
  const sealed = seal(value);
  await query(
    "INSERT INTO integration_credentials(user_id,provider,ciphertext,iv,tag,hint) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,provider) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,tag=EXCLUDED.tag,hint=EXCLUDED.hint,updated_at=now()",
    [
      userId,
      provider,
      sealed.ciphertext,
      sealed.iv,
      sealed.tag,
      credentialHint(value),
    ],
  );
  await refreshCredentials(userId, true);
}

export async function clearCredential(
  userId: string,
  provider: CredentialProvider,
) {
  await query(
    "DELETE FROM integration_credentials WHERE user_id=$1 AND provider=$2",
    [userId, provider],
  );
  await refreshCredentials(userId, true);
}

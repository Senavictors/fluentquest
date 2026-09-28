import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../domain/content";
export { SUPPORTED_LANGUAGES };
export type { SupportedLanguage };
// TASK-015 / ADR-006: rótulo em pt-BR de cada idioma da lista fechada, para
// a interface. `LANGUAGE_NAMES` em src/server/providers.ts é o rótulo em
// inglês da mesma lista, para prompt — duas traduções da mesma
// SUPPORTED_LANGUAGES (RN-01 de TASK-013), não duas listas.
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  "en-US": "inglês (EUA)",
  "en-GB": "inglês (Reino Unido)",
  "es-ES": "espanhol (Espanha)",
  "es-AR": "espanhol (Argentina)",
  "es-CL": "espanhol (Chile)",
  "es-MX": "espanhol (México)",
  "it-IT": "italiano",
  "fr-FR": "francês",
  "zh-CN": "mandarim (simplificado)",
  "ja-JP": "japonês",
  "ru-RU": "russo",
  "pt-BR": "português (Brasil)",
};
export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code as SupportedLanguage] ?? code;
}
// Idiomas de estudo oferecidos na importação — inglês entra como uma única
// entrada ("Inglês"); a variedade (en-US/en-GB) só aparece depois de
// escolhida, num controle próprio (RN-04/CA-06 de TASK-015, ADR-006:
// englishVariant não é o seletor de idioma).
export const STUDY_LANGUAGE_OPTIONS: {
  value: SupportedLanguage | "en";
  label: string;
}[] = [
  { value: "en", label: "Inglês" },
  { value: "es-ES", label: LANGUAGE_LABELS["es-ES"] },
  { value: "es-AR", label: LANGUAGE_LABELS["es-AR"] },
  { value: "es-CL", label: LANGUAGE_LABELS["es-CL"] },
  { value: "es-MX", label: LANGUAGE_LABELS["es-MX"] },
  { value: "it-IT", label: LANGUAGE_LABELS["it-IT"] },
  { value: "fr-FR", label: LANGUAGE_LABELS["fr-FR"] },
  { value: "zh-CN", label: LANGUAGE_LABELS["zh-CN"] },
  { value: "ja-JP", label: LANGUAGE_LABELS["ja-JP"] },
  { value: "ru-RU", label: LANGUAGE_LABELS["ru-RU"] },
  { value: "pt-BR", label: LANGUAGE_LABELS["pt-BR"] },
];
export function isEnglish(language: SupportedLanguage): boolean {
  return language === "en-US" || language === "en-GB";
}

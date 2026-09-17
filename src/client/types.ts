export interface Source {
  id: string;
  kind: string;
  title: string;
  author: string;
  language: string;
  status: string;
  is_example: boolean;
  video_id: string | null;
  position_ms: number;
  duration_ms: number | null;
  rights: string;
  transcription_mode?: "manual" | "ai";
  transcript_provider?: string | null;
  transcript_model?: string | null;
  transcript_reviewed?: boolean;
  segment_count?: number;
  file_key?: string;
}
export interface TranscriptionEstimate {
  available: boolean;
  amount: number | null;
  remaining: number | null;
  durationLimitMs: number;
  reason: string | null;
}
export interface SegmentSupport {
  translation: string;
  point: string;
  example: string;
  question: string;
}
export interface Segment {
  id: string;
  ordinal: number;
  text: string;
  support: SegmentSupport | null;
  // Apoio anterior à migração 005: texto corrido, sem os quatro campos.
  translation: string | null;
  start_ms: number | null;
  end_ms: number | null;
  time_accuracy: string;
  origin: string;
  quality_status: string;
}
export interface Vocabulary {
  expression: string;
  meaning: string;
  example: string;
}
export interface Unit {
  id: string;
  title: string;
  objective: string;
  prompt: string;
  kind: string;
  vocabulary: Vocabulary[];
  provenance: string;
}
export interface Profile {
  interests: string[];
  goal: string;
  weeklyGoal: number;
  sessionMinutes: 10 | 25 | 45;
  difficulty: string;
  theme: "system" | "light" | "dark";
  onboarded: boolean;
  englishVariant: string;
  monthlyLimitCents: number;
  alertCents: number;
  diagnostic: Record<string, unknown>;
  shortcutsEnabled: boolean;
}
export interface Evidence {
  id: string;
  skill: string;
  description: string;
  provenance: string;
  created_at: string;
}
export interface Progress {
  xp: number;
  level: number;
  nextLevel: number;
  cards: number;
  reviews: number;
  recordings: number;
  weekly_sessions: number;
  evidence: Evidence[];
}
export interface Usage {
  confirmed: number;
  reserved: number;
  limit: number;
  alert: number;
  period: string;
  forecast: number | null;
  rows: {
    purpose: string;
    model: string;
    input_tokens: string;
    output_tokens: string;
    micros: string;
  }[];
}
export interface Session {
  id: string;
  source_id: string | null;
  stage: string;
  duration_minutes: number;
  context: { tab?: string; segment?: string; immersion?: boolean };
  started_at: string;
}
export interface Bootstrap {
  user: { id: string; name: string; email: string };
  profile: Profile;
  sources: Source[];
  session: Session | null;
  due: number;
  progress: Progress;
  usage: Usage;
  integrations: Integrations;
  scenarios: { id: string; title: string; skill: string; prompt: string }[];
}
export type CredentialProvider = "gemini" | "openai" | "youtube";
export interface CredentialState {
  configured: boolean;
  // `ambiente` é chave vinda de .env.local; `interface` é chave cadastrada em
  // Ajustes, que tem precedência sobre a do ambiente.
  origin: "interface" | "ambiente" | null;
  hint: string | null;
  updatedAt: string | null;
}
export interface ProviderDetail {
  ready: boolean;
  key: boolean;
  prices: boolean;
  model: string;
  priceReviewedOn: string;
}
export interface Integrations {
  ai: boolean;
  provider: "gemini" | "openai";
  youtube: boolean;
  gemini: boolean;
  openai: boolean;
  message: string;
  model: string;
  videoModel: string;
  enabled: boolean;
  keys: Record<CredentialProvider, CredentialState>;
  detail: Record<"gemini" | "openai", ProviderDetail>;
}
export interface Recording {
  id: string;
  duration_ms: number;
  preserve: boolean;
  expires_at: string;
  created_at: string;
}
export interface ReviewCard {
  id: string;
  expression: string;
  meaning: string;
  example: string;
  mode: string;
  due: string;
  version: number;
  source_title: string | null;
  fsrs_state: Record<string, unknown>;
}

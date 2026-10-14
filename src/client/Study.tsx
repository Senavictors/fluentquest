"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  Play,
  Search,
  X,
  Check,
  Repeat2,
  RectangleHorizontal,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Send,
  LoaderCircle,
  ExternalLink,
  Upload,
  Trash2,
} from "lucide-react";
import { PageHead, Empty, useApp } from "./App";
import { api, clock, HttpError } from "./http";
import type {
  LyricsResult,
  Source,
  Segment,
  SegmentSupport,
  TranscriptionEstimate,
  Unit,
  Vocabulary,
} from "./types";
import {
  languageLabel,
  isEnglish,
  STUDY_LANGUAGE_OPTIONS,
  type SupportedLanguage,
} from "./languages";
import {
  activeSegmentIndex,
  followsPlayback,
  formatTimeOffset,
  lyricsSegmentLabel,
  songDuration,
  stepTimeOffset,
  TIME_OFFSET_LIMIT_MS,
} from "../domain/content";
// Apoio de um trecho. Quatro blocos que servem momentos diferentes, então
// descem em ordem de uso: a tradução é o que se procura de relance e vem
// primeiro; ponto e exemplo explicam; a pergunta é tarefa, não leitura, e por
// isso fica separada por um fio. Sem caixa própria — o painel já vive dentro
// da linha selecionada, e aninhar mais uma superfície só adicionaria moldura.
function SegmentSupport({
  support,
  legacyText,
  loading,
  aiReady,
  language,
}: {
  support: SegmentSupport | null;
  legacyText: string | null;
  loading: boolean;
  aiReady: boolean;
  language: string;
}) {
  if (support)
    return (
      <dl className="support-body">
        <div className="support-block support-lead">
          <dt>Tradução</dt>
          <dd>{support.translation}</dd>
        </div>
        <div className="support-block">
          <dt>Ponto</dt>
          <dd>{support.point}</dd>
        </div>
        <div className="support-block support-example">
          <dt>Exemplo</dt>
          <dd lang={language}>{support.example}</dd>
        </div>
        <div className="support-block support-task">
          <dt>Sua vez</dt>
          <dd>{support.question}</dd>
        </div>
      </dl>
    );
  if (legacyText)
    return (
      <div className="support-body">
        <div className="support-block support-lead">
          <p>{legacyText}</p>
        </div>
        <small className="quiet">
          Apoio gerado no formato antigo, em texto corrido.
        </small>
      </div>
    );
  if (loading)
    return (
      <div className="support-body" aria-busy="true">
        <span className="sr-only">Carregando o apoio deste trecho…</span>
        <div className="support-skeleton" aria-hidden="true">
          <span style={{ width: "88%" }} />
          <span style={{ width: "64%" }} />
          <span style={{ width: "79%" }} />
        </div>
      </div>
    );
  return (
    <div className="support-body">
      <p className="support-state">
        {aiReady
          ? "Não foi possível gerar o apoio deste trecho. Tente novamente."
          : "Apoio automático: integração não configurada."}
      </p>
    </div>
  );
}
const statuses: Record<string, string> = {
  ready: "Pronto",
  text_ready: "Texto disponível",
  no_transcript: "Sem transcrição",
  requested: "Solicitado",
  queued: "Na fila",
  processing: "Preparando",
  transcribing: "Transcrevendo",
  partial_ready: "Parcialmente pronto",
  awaiting_configuration: "Aguardando configuração",
  needs_review: "Requer revisão",
  blocked_budget: "Orçamento atingido",
  unavailable: "Indisponível",
  cancelled: "Cancelado",
};
export function Library() {
  const { data, refresh, run, busy } = useApp(),
    router = useRouter();
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState("");
  const list = data.sources.filter((s) =>
    `${s.title} ${s.author}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page">
      <PageHead
        title="Biblioteca"
        subtitle="Conteúdo que faz sentido para você. Prática que fica."
        action={
          <button className="primary" onClick={() => setAdding(!adding)}>
            {adding ? <X size={17} /> : <Plus size={17} />}{" "}
            {adding ? "Fechar" : "Adicionar conteúdo"}
          </button>
        }
      />
      {adding && (
        <ImportForm
          onDone={async (id) => {
            setAdding(false);
            await refresh();
            router.push(`/estudar/${id}`);
          }}
        />
      )}
      <div className="library-toolbar">
        <span>
          {data.sources.length} {data.sources.length === 1 ? "fonte" : "fontes"}{" "}
          <span className="quiet">· sua biblioteca pessoal</span>
        </span>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Buscar na biblioteca"
            placeholder="Encontrar conteúdo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {!list.length ? (
        <Empty
          title={
            search
              ? "Nenhum conteúdo encontrado."
              : "Uma boa conversa começa com algo interessante."
          }
        >
          <p>
            {search
              ? "Experimente buscar por outro título."
              : "Adicione um vídeo, uma legenda ou um texto que você queira entender melhor."}
          </p>
          {!search && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const item = await api<{ id: string }>("example", "POST", {});
                  await refresh();
                  router.push(`/estudar/${item.id}`);
                })
              }
            >
              Experimentar com um texto de exemplo <ArrowRight size={17} />
            </button>
          )}
        </Empty>
      ) : (
        <div className="source-list">
          {list.map((source, i) => (
            <article key={source.id} className="source-row">
              <div className={`source-cover cover-${i % 3}`} aria-hidden="true">
                {source.kind === "youtube" ? (
                  <Play size={32} strokeWidth={1.3} />
                ) : (
                  <FileText size={34} strokeWidth={1.2} />
                )}
                <span>
                  {source.kind === "youtube"
                    ? "YOUTUBE"
                    : source.kind === "media"
                      ? "ARQUIVO PRÓPRIO"
                      : "LEITURA"}
                </span>
                {source.duration_ms && (
                  <small>{clock(source.duration_ms)}</small>
                )}
              </div>
              <div className="source-info">
                <div className="source-tags">
                  <span
                    className={`status ${source.status === "ready" ? "good" : ""}`}
                  >
                    {statuses[source.status] || source.status}
                  </span>
                  {source.is_example && (
                    <span className="example-tag">Material de exemplo</span>
                  )}
                </div>
                <h2>
                  <Link href={`/estudar/${source.id}`}>{source.title}</Link>
                </h2>
                <p>
                  {source.author} <span>·</span> {languageLabel(source.language)}
                  {source.catalog_provider === "lrclib" && (
                    <>
                      {" "}
                      <span>·</span> Letra (LRCLIB)
                    </>
                  )}
                </p>
                <span className="small quiet">
                  {source.segment_count
                    ? `${source.segment_count} trechos disponíveis`
                    : "Adicione uma transcrição autorizada para estudar o texto"}
                  {source.position_ms > 0
                    ? ` · última posição ${clock(source.position_ms)}`
                    : ""}
                </span>
              </div>
              <Link
                className="source-open"
                href={`/estudar/${source.id}`}
                aria-label={`Estudar ${source.title}`}
              >
                Estudar <ArrowUpRight size={19} />
              </Link>
            </article>
          ))}
        </div>
      )}
      <p className="library-footnote">
        Sua biblioteca é privada. A origem e as permissões acompanham cada
        fonte.
      </p>
    </div>
  );
}
function ImportForm({ onDone }: { onDone: (id: string) => Promise<void> }) {
  const { run, busy, data } = useApp();
  const [kind, setKind] = useState("youtube"),
    [title, setTitle] = useState(""),
    [author, setAuthor] = useState("Material próprio"),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [rights, setRights] = useState("owned"),
    [transcriptionMode, setTranscriptionMode] = useState<"manual" | "ai">(
      "manual",
    ),
    [consent, setConsent] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [language, setLanguage] = useState<SupportedLanguage>("en-US"),
    // TASK-021 / ADR-009: "song" é só estado de tela; a fonte gravada é
    // `text` (só letra) ou `youtube` (letra + clipe).
    [songId, setSongId] = useState<number | null>(null),
    [clipUrl, setClipUrl] = useState("");
  const english = isEnglish(language);
  const song = kind === "song";
  return (
    <form
      className="import-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          if (song) {
            if (!songId) throw new Error("Escolha uma versão da letra.");
            try {
              const value = await api<{ sourceId: string }>(
                "sources/lyrics",
                "POST",
                {
                  catalogId: songId,
                  language,
                  videoUrl: clipUrl.trim() || undefined,
                },
              );
              await onDone(value.sourceId);
            } catch (error) {
              // A letra (ou o clipe) já está na biblioteca: abre a fonte que
              // existe em vez de mostrar um erro sem saída.
              const existing =
                error instanceof HttpError && error.code === "SOURCE_EXISTS"
                  ? error.details.sourceId
                  : null;
              if (typeof existing !== "string") throw error;
              await onDone(existing);
            }
          } else if (kind === "media") {
            if (!file)
              throw new Error("Selecione um arquivo de áudio ou vídeo.");
            const params = new URLSearchParams({
              title,
              author,
              rights,
              consent: String(consent),
            });
            const r = await fetch(`/api/media?${params}`, {
              method: "POST",
              headers: {
                "Content-Type": file.type,
                "Idempotency-Key": crypto.randomUUID(),
              },
              body: file,
            });
            const value = await r.json();
            if (!r.ok) throw new Error(value.message);
            await onDone(value.sourceId);
          } else {
            const value = await api<{ sourceId: string }>("sources", "POST", {
              kind,
              title,
              author,
              url: kind === "youtube" ? url : undefined,
              text:
                kind === "youtube" && transcriptionMode === "ai"
                  ? undefined
                  : text || undefined,
              rights:
                kind === "youtube" && (transcriptionMode === "ai" || !text)
                  ? "public_link"
                  : rights,
              transcriptionMode:
                kind === "youtube" ? transcriptionMode : "manual",
              consent,
              language,
            });
            await onDone(value.sourceId);
          }
        });
      }}
    >
      <h2>O que você quer estudar?</h2>
      <div className="tabs" role="group" aria-label="Tipo de conteúdo">
        {[
          ["youtube", "Vídeo do YouTube"],
          ["text", "Texto ou legenda"],
          ["media", "Arquivo próprio"],
          ["song", "Música"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={kind === value}
            className={kind === value ? "active" : ""}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {song ? (
        // Título e artista vêm do catálogo, não de campo digitado.
        <SongSearch
          selected={songId}
          onSelect={setSongId}
          onUseText={() => setKind("text")}
        />
      ) : (
        <div className="form-grid">
          <label>
            Título
            <input
              required
              maxLength={200}
              placeholder="Um assunto que desperta sua curiosidade"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Autor ou canal
            <input
              required
              maxLength={120}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
        </div>
      )}
      {song && data.integrations.lyrics && (
        <label>
          Link do clipe oficial no YouTube (opcional)
          <input
            type="url"
            maxLength={500}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-describedby="clip-help"
            value={clipUrl}
            onChange={(e) => setClipUrl(e.target.value)}
          />
        </label>
      )}
      {song && data.integrations.lyrics && (
        <p id="clip-help" className="small quiet">
          Com o clipe, a letra acompanha o vídeo no player oficial. Sem ele,
          você estuda a letra como texto.
        </p>
      )}
      <div className="form-grid">
        <label>
          Idioma do conteúdo
          <select
            value={english ? "en" : language}
            onChange={(e) => {
              const value = e.target.value;
              setLanguage(
                value === "en"
                  ? ((data.profile.englishVariant || "en-US") as SupportedLanguage)
                  : (value as SupportedLanguage),
              );
            }}
          >
            {STUDY_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {english && (
          <label>
            Variedade do inglês
            <select
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as SupportedLanguage)
              }
            >
              <option value="en-US">Americano</option>
              <option value="en-GB">Britânico</option>
            </select>
          </label>
        )}
      </div>
      {!english && (
        <p className="small quiet">
          O pacote de exemplo, os cenários de prática e o diagnóstico inicial
          existem só em inglês, independente do idioma que você escolher
          aqui.
        </p>
      )}
      {kind === "youtube" && (
        <>
          <label>
            Link do YouTube
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <fieldset className="transcription-choice">
            <legend>Como obter o texto</legend>
            <label>
              <input
                type="radio"
                name="transcription-mode"
                checked={transcriptionMode === "manual"}
                onChange={() => setTranscriptionMode("manual")}
              />
              <span>
                <strong>Colar legenda autorizada</strong>
                <small>Sem custo de IA.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="transcription-mode"
                checked={transcriptionMode === "ai"}
                disabled={!data.integrations.ai}
                onChange={() => setTranscriptionMode("ai")}
              />
              <span>
                <strong>Transcrever com Gemini</strong>
                <small>
                  {data.integrations.ai
                    ? "Você verá o custo máximo antes de confirmar."
                    : "Integração não configurada."}
                </small>
              </span>
            </label>
          </fieldset>
        </>
      )}
      {kind !== "media" &&
        !song &&
        !(kind === "youtube" && transcriptionMode === "ai") && (
          <>
            <label>
              {kind === "youtube"
                ? "Legenda autorizada (opcional)"
                : `Texto ou legenda em ${languageLabel(language)}`}
              <textarea
                rows={5}
                required={kind === "text"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole seu texto, uma legenda SRT ou VTT, ou uma letra LRC…"
                maxLength={500000}
              />
            </label>
            <label className="file-label">
              <Upload size={16} /> Carregar TXT, SRT, VTT ou LRC
              <input
                type="file"
                accept=".txt,.srt,.vtt,.lrc"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 600000) return;
                    setText(await f.text());
                  }
                }}
              />
            </label>
          </>
        )}
      {kind === "media" && (
        <label>
          Áudio ou vídeo próprio (até 25 MB e 30 minutos)
          <input
            type="file"
            required
            accept="audio/*,video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      )}
      {song && (
        // RN-06: o direito é fixo (third_party) e não se escolhe aqui.
        <p className="small quiet">
          A letra é obra de terceiros, vinda de um catálogo comunitário. Ela
          fica só na sua biblioteca, para estudo pessoal, marcada como não
          revisada, e não entra na exportação da conta.
        </p>
      )}
      {!song && (kind !== "youtube" || text) && (
        <label>
          Permissão de uso
          <select value={rights} onChange={(e) => setRights(e.target.value)}>
            <option value="owned">Eu sou o autor</option>
            <option value="licensed">Tenho licença ou autorização</option>
          </select>
        </label>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {song
            ? "Entendo que a letra é de terceiros e que vou usá-la só para estudo pessoal."
            : kind === "youtube" && !text
            ? transcriptionMode === "ai"
              ? "Entendo que o link público será verificado agora. Antes da transcrição, confirmarei o envio ao Gemini e o custo máximo."
              : "Entendo que o vídeo será reproduzido pelo player oficial e não será baixado."
            : "Confirmo que posso utilizar este conteúdo na minha biblioteca pessoal."}
        </span>
      </label>
      <div className="form-footer">
        <p className="small quiet">
          {song
            ? "O FluentQuest consulta só o LRCLIB e não baixa áudio nem vídeo."
            : kind === "youtube" && transcriptionMode === "ai"
              ? "O vídeo não será baixado pelo FluentQuest. A URL pública será processada pelo Gemini somente após sua confirmação."
              : "Texto e reprodução continuam disponíveis sem IA."}
        </p>
        <button
          className="primary"
          disabled={busy || (song && (!data.integrations.lyrics || !songId))}
        >
          {busy ? "Adicionando…" : "Adicionar à biblioteca"}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
// TASK-021 / ADR-009: busca de letra no LRCLIB. Debounce de 450 ms e uma
// requisição por vez — a anterior é cancelada quando a busca muda. Erro (429,
// indisponível) vira mensagem e espera o proprietário: nada tenta de novo
// sozinho. Resultados são radios nativos num fieldset, o que já dá navegação
// por setas e anúncio de "1 de 20" ao leitor de tela.
function SongSearch({
  selected,
  onSelect,
  onUseText,
}: {
  selected: number | null;
  onSelect: (id: number | null) => void;
  onUseText: () => void;
}) {
  const { data } = useApp();
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<LyricsResult[] | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  // Enter e o debounce podem pedir o mesmo termo; só a primeira vai à rede.
  const lastQuery = useRef("");
  const search = useCallback(async (q: string) => {
    if (q === lastQuery.current) return;
    lastQuery.current = q;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/lyrics/search?${new URLSearchParams({ q })}`,
        { signal: controller.signal },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.message || "Não foi possível buscar a letra.");
      setResults(value.results);
    } catch (e) {
      if (controller.signal.aborted) return;
      // Depois de um erro, repetir o mesmo termo é permitido — por ação do
      // proprietário, nunca automática.
      lastQuery.current = "";
      setResults(null);
      setError(e instanceof Error ? e.message : "Não foi possível buscar.");
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      inFlight.current?.abort();
      inFlight.current = null;
      lastQuery.current = "";
      setLoading(false);
      setResults(null);
      return;
    }
    const timer = setTimeout(() => void search(q), 450);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => () => inFlight.current?.abort(), []);
  if (!data.integrations.lyrics)
    return (
      <div className="notice" role="status">
        <p>
          Integração não configurada: a busca de letras (LRCLIB) está
          desligada nesta instalação.
        </p>
        <p>
          Se você já tem a letra em formato <code>.lrc</code>, cole-a em
          “Texto ou legenda” — o tempo de cada verso é aproveitado.
        </p>
        <button type="button" onClick={onUseText}>
          Ir para Texto ou legenda
        </button>
      </div>
    );
  const status = loading
    ? "Buscando no LRCLIB…"
    : results
      ? results.length
        ? `${results.length} ${results.length === 1 ? "versão encontrada" : "versões encontradas"}.`
        : "Nenhuma letra encontrada para essa busca."
      : "";
  return (
    <div className="song-search">
      <label>
        Buscar música
        <span className="song-search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            maxLength={200}
            placeholder="Nome da música e do artista"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSelect(null);
            }}
            onKeyDown={(e) => {
              // Enter busca na hora em vez de enviar o formulário.
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (query.trim().length >= 2) void search(query.trim());
            }}
          />
        </span>
      </label>
      <p className="small quiet" role="status">
        {status}
      </p>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {results && results.length > 0 && (
        <fieldset className="transcription-choice song-results">
          <legend>Escolha a versão da letra</legend>
          {results.map((result) => {
            const unusable =
              result.instrumental || (!result.hasSynced && !result.hasPlain);
            return (
              <label
                key={result.id}
                className={unusable ? "song-option unusable" : "song-option"}
              >
                <input
                  type="radio"
                  name="song"
                  value={result.id}
                  disabled={unusable}
                  checked={selected === result.id}
                  onChange={() => onSelect(result.id)}
                />
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {[result.artist, result.album, songDuration(result.durationMs)]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <small>
                    {result.instrumental
                      ? "Instrumental — sem letra para estudar"
                      : result.hasSynced
                        ? "Letra sincronizada"
                        : result.hasPlain
                          ? "Só texto, sem tempo"
                          : "Sem letra"}
                  </small>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (n: number, allow: boolean) => void;
  getCurrentTime: () => number;
  setPlaybackRate: (n: number) => void;
  getAvailablePlaybackRates: () => number[];
  destroy: () => void;
};
type YTApi = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let youtubeReady: Promise<void> | undefined;
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve();
  youtubeReady ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return youtubeReady;
}
function Player({
  source,
  selected,
  playerRef,
  onTime,
  onFollow,
  onPlay,
}: {
  source: Source;
  selected: Segment | null;
  playerRef: React.RefObject<YTPlayer | null>;
  onTime: (n: number) => void;
  // TASK-022 / ADR-009: só para letra que acompanha a música. Presente, o
  // player consulta o tempo a cada 200 ms enquanto toca — o 1 s de sempre é
  // lento demais para versos de 2–3 s. Ausente, nada muda.
  onFollow?: (n: number) => void;
  onPlay?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null),
    onTimeRef = useRef(onTime),
    onFollowRef = useRef(onFollow),
    onPlayRef = useRef(onPlay);
  onTimeRef.current = onTime;
  onFollowRef.current = onFollow;
  onPlayRef.current = onPlay;
  const [error, setError] = useState("");
  useEffect(() => {
    if (source.kind !== "media") return;
    playerRef.current = {
      playVideo: () => {
        void video.current?.play();
      },
      pauseVideo: () => video.current?.pause(),
      seekTo: (n) => {
        if (video.current) video.current.currentTime = n;
      },
      getCurrentTime: () => video.current?.currentTime || 0,
      setPlaybackRate: (n) => {
        if (video.current) video.current.playbackRate = n;
      },
      getAvailablePlaybackRates: () => [0.5, 0.75, 1, 1.25, 1.5],
      destroy: () => {},
    };
    return () => {
      playerRef.current = null;
    };
  }, [source.id, source.kind, playerRef]);
  useEffect(() => {
    if (!source.video_id || source.status === "unavailable") return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let fastTimer: ReturnType<typeof setInterval> | undefined;
    let settled = -1;
    void loadYouTube().then(() => {
      if (!active || !host.current) return;
      const el = document.createElement("div");
      host.current.replaceChildren(el);
      const player = new window.YT!.Player(el, {
        videoId: source.video_id,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
          start: Math.floor(source.position_ms / 1000),
          playsinline: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            timer = setInterval(
              () =>
                onTimeRef.current(Math.floor(player.getCurrentTime() * 1000)),
              1000,
            );
          },
          // 1 = tocando (YT.PlayerState.PLAYING). A consulta rápida só existe
          // durante a reprodução de música; pausado, sobra o 1 s de sempre.
          onStateChange: (event: { data: number }) => {
            // 3 = carregando: um salto no meio da reprodução passa por ele e
            // volta a 1 sem ser "uma nova reprodução".
            const restarted = event.data === 1 && settled !== 1;
            if (event.data !== 3) settled = event.data;
            if (event.data === 3) return;
            clearInterval(fastTimer);
            fastTimer = undefined;
            if (event.data !== 1) return;
            if (restarted) onPlayRef.current?.();
            if (!onFollowRef.current) return;
            fastTimer = setInterval(
              () =>
                onFollowRef.current?.(
                  Math.floor(player.getCurrentTime() * 1000),
                ),
              200,
            );
          },
          onError: () =>
            setError(
              "Não foi possível reproduzir este vídeo. Abra a fonte original ou continue com o texto.",
            ),
        },
      });
    });
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(fastTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [source.id, source.video_id, source.status, playerRef]);
  if (source.status === "unavailable")
    return (
      <div className="notice" role="status">
        <p>
          Este vídeo não está disponível para reprodução incorporada. Escolha
          outra fonte para estudar.
        </p>
        <Link href="/biblioteca">Escolher outra fonte</Link>
      </div>
    );
  if (source.video_id)
    return (
      <div className="player-area">
        <div ref={host} className="youtube-host" />
        {error && (
          <div className="notice">
            {error}
            <a
              href={`https://www.youtube.com/watch?v=${source.video_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no YouTube <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    );
  if (source.kind === "media")
    return (
      <video
        ref={video}
        controls
        className="local-video"
        src={`/api/sources/${source.id}/media`}
        onLoadedMetadata={() => {
          if (video.current)
            video.current.currentTime = source.position_ms / 1000;
        }}
        onTimeUpdate={() =>
          onTimeRef.current(
            Math.floor((video.current?.currentTime || 0) * 1000),
          )
        }
      />
    );
  return (
    <div className="reading-feature">
      <BookOpen size={25} strokeWidth={1.3} />
      <span>
        {source.is_example ? "Leitura de exemplo" : "Seu material de leitura"}
      </span>
      <p lang={source.language}>
        {selected?.text || "Escolha um trecho para começar."}
      </p>
      <span className="small">
        Leia. Faça uma pausa. Diga com suas palavras.
      </span>
    </div>
  );
}
export function Study({ sourceId }: { sourceId: string }) {
  const { data, run, refresh, notify, busy } = useApp(),
    router = useRouter(),
    params = useSearchParams();
  const savedContext =
    data.session?.source_id === sourceId ? data.session.context : {};
  const [lesson, setLesson] = useState<{
      source: Source;
      segments: Segment[];
      units: Unit[];
      jobs: {
        id: string;
        kind: string;
        status: string;
        error_message: string | null;
        completed: number;
        total: number | null;
      }[];
      transcriptionEstimate: TranscriptionEstimate;
    } | null>(null),
    [selectedId, setSelectedId] = useState(
      params.get("segment") || savedContext.segment || "",
    ),
    [tab, setTab] = useState(
      params.get("tab") || savedContext.tab || "expression",
    ),
    [cinema, setCinema] = useState(false),
    [wide, setWide] = useState(false),
    [reveal, setReveal] = useState(false),
    [draft, setDraft] = useState<Vocabulary | null>(null),
    [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState(""),
    [question, setQuestion] = useState(""),
    [tutor, setTutor] = useState(""),
    [time, setTime] = useState(0),
    [loop, setLoop] = useState(false),
    [caption, setCaption] = useState(""),
    [captionRights, setCaptionRights] = useState<"owned" | "licensed">(
      "licensed",
    ),
    [captionOpen, setCaptionOpen] = useState(false),
    [transcriptionConsent, setTranscriptionConsent] = useState(false),
    [fatal, setFatal] = useState(""),
    [page, setPage] = useState(0),
    [cardMode, setCardMode] = useState("production"),
    // TASK-022 / ADR-009: modo karaokê. `playingId` é o verso que está
    // tocando — separado da seleção, para o acompanhamento não fechar o apoio
    // nem apagar o rascunho de cartão a cada verso.
    [follow, setFollow] = useState(true),
    [followHold, setFollowHold] = useState(false),
    [playingId, setPlayingId] = useState(""),
    [offsetMs, setOffsetMs] = useState(0),
    [offsetError, setOffsetError] = useState("");
  const playerRef = useRef<YTPlayer | null>(null),
    lastSaved = useRef(0),
    lastPosition = useRef(0),
    [saved, setSaved] = useState(true);
  const selected =
      lesson?.segments.find((s) => s.id === selectedId) ||
      lesson?.segments[0] ||
      null,
    unit = lesson?.units[0];
  // RN-01: só letra do catálogo, com tempo e com clipe. Fora disso o
  // deslocamento é zero e a sala se comporta como sempre (CA-04).
  const karaoke =
    Boolean(lesson?.source.video_id) &&
    followsPlayback(lesson?.segments ?? []);
  const shift = karaoke ? offsetMs : 0;
  const seekSegment = (startMs: number) =>
    playerRef.current?.seekTo(Math.max(0, startMs + shift) / 1000, true);
  const load = useCallback(async () => {
    try {
      const value = await api<NonNullable<typeof lesson>>(
        `sources/${sourceId}`,
      );
      setLesson(value);
      setFatal("");
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Erro ao abrir material.");
    }
  }, [sourceId]);
  useEffect(() => {
    void load();
    setFeedback("");
    setSelectedId(params.get("segment") || savedContext.segment || "");
  }, [load]);
  useEffect(() => {
    const selected = params.get("segment");
    if (selected) setSelectedId(selected);
    const currentTab = params.get("tab");
    if (currentTab) setTab(currentTab);
  }, [params]);
  useEffect(() => {
    const job = lesson?.jobs.find((j) =>
      ["queued", "processing"].includes(j.status),
    );
    if (!job) return;
    const sse = new EventSource(`/api/jobs/${job.id}/events`);
    sse.onmessage = () => void load();
    sse.addEventListener("state", (e) => {
      const j = JSON.parse((e as MessageEvent).data);
      if (!["queued", "processing"].includes(j.status)) {
        sse.close();
        void load();
      }
    });
    return () => sse.close();
  }, [lesson?.jobs[0]?.id, lesson?.jobs[0]?.status, load]);
  useEffect(() => {
    setReveal(false);
    setDraft(null);
  }, [selected?.id]);
  useEffect(
    () => () => {
      if (lastPosition.current > 0)
        void fetch(`/api/sources/${sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionMs: lastPosition.current }),
          keepalive: true,
        });
    },
    [sourceId],
  );
  // RN-03: último verso cujo início deslocado já passou.
  const followAt = useCallback(
    (n: number) => {
      if (!karaoke || !follow || followHold || loop || !lesson) return;
      const index = activeSegmentIndex(
        lesson.segments.map((segment) => segment.start_ms),
        n,
        offsetMs,
      );
      const id = index < 0 ? "" : lesson.segments[index].id;
      setPlayingId((current) => (current === id ? current : id));
    },
    [karaoke, follow, followHold, loop, lesson, offsetMs],
  );
  const onTime = useCallback(
    (n: number) => {
      setTime(n);
      lastPosition.current = n;
      if (loop && selected?.end_ms && n >= selected.end_ms + shift) {
        playerRef.current?.seekTo(
          Math.max(0, (selected.start_ms || 0) + shift) / 1000,
          true,
        );
      }
      followAt(n);
      if (Date.now() - lastSaved.current > 10000) {
        lastSaved.current = Date.now();
        setSaved(false);
        void api(`sources/${sourceId}`, "PATCH", { positionMs: n })
          .then(() => setSaved(true))
          .catch(() => setSaved(false));
      }
    },
    [loop, selected?.id, sourceId, shift, followAt],
  );
  useEffect(() => {
    setOffsetMs(lesson?.source.time_offset_ms ?? 0);
  }, [lesson?.source.id, lesson?.source.time_offset_ms]);
  // Acompanhamento desligado, pausado por clique ou preso no A–B: nenhum
  // verso fica aceso por engano.
  useEffect(() => {
    if (!karaoke || !follow || followHold || loop) setPlayingId("");
  }, [karaoke, follow, followHold, loop]);
  // A lista vai até o verso — trocando de página se preciso — e rola sem
  // animação quando o sistema pede movimento reduzido (RN-05).
  useEffect(() => {
    if (!playingId || !lesson) return;
    const index = lesson.segments.findIndex((s) => s.id === playingId);
    const target = Math.floor(index / 30);
    if (index >= 0 && target !== page) {
      setPage(target);
      return;
    }
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-segment-id="${playingId}"]`)
        ?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [playingId, page]);
  useEffect(() => {
    try {
      setFollow(localStorage.getItem("fq-karaoke") !== "0");
    } catch {
      // Sem armazenamento: acompanhar fica ligado, o padrão.
    }
  }, []);
  const applyFollow = useCallback((next: boolean) => {
    setFollow(next);
    setFollowHold(false);
    try {
      localStorage.setItem("fq-karaoke", next ? "1" : "0");
    } catch {
      // Preferência não persiste, mas a sessão atual respeita a escolha.
    }
  }, []);
  // RN-04: o ajuste é da fonte e persiste; `start_ms` não muda.
  function changeOffset(direction: 1 | -1) {
    const next = stepTimeOffset(offsetMs, direction);
    if (next === offsetMs) return;
    setOffsetMs(next);
    setOffsetError("");
    api(`sources/${sourceId}`, "PATCH", { timeOffsetMs: next }).catch(() =>
      setOffsetError("Não foi possível salvar o ajuste. Ele vale só nesta visita."),
    );
  }
  // Lido depois da montagem: ler no initializer divergiria do HTML do servidor.
  useEffect(() => {
    try {
      setCinema(localStorage.getItem("fq-cinema") === "1");
    } catch {
      // Navegador sem armazenamento: a sala abre no arranjo padrão.
    }
  }, []);
  // A barra lateral vive fora desta árvore, então o modo precisa de uma marca
  // no documento para alcançá-la — mesmo caminho que o tema já usa. Quem decide
  // se a marca vale é o CSS, dentro do mesmo limiar de largura; assim não há
  // piscada entre o primeiro quadro e o efeito.
  useEffect(() => {
    document.documentElement.dataset.cinema = cinema ? "1" : "";
    return () => {
      document.documentElement.dataset.cinema = "";
    };
  }, [cinema]);
  // Mesmo limiar do CSS. O atalho e a dica de rodapé só existem onde o arranjo
  // existe: anunciar uma tecla que não faz nada no celular seria mentira.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1240px)");
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const applyCinema = useCallback((next: boolean) => {
    setCinema(next);
    try {
      localStorage.setItem("fq-cinema", next ? "1" : "0");
    } catch {
      // Preferência não persiste, mas a sessão atual respeita a escolha.
    }
  }, []);
  // Uma superfície que toma a janela inteira precisa da saída que todo mundo
  // tenta primeiro.
  useEffect(() => {
    if (!cinema) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") applyCinema(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cinema, applyCinema]);
  useEffect(() => {
    if (!data.profile.shortcutsEnabled) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (e.target instanceof HTMLElement &&
          (e.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)))
      )
        return;
      if (e.key.toLowerCase() === "r" && selected?.start_ms != null) {
        e.preventDefault();
        seekSegment(selected.start_ms);
        playerRef.current?.playVideo();
      }
      if (e.key.toLowerCase() === "k" && karaoke) {
        e.preventDefault();
        applyFollow(!follow);
      }
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        void revealTranslation();
      }
      if (e.key.toLowerCase() === "c" && wide) {
        e.preventDefault();
        applyCinema(!cinema);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    data.profile.shortcutsEnabled,
    selected?.id,
    reveal,
    cinema,
    wide,
    applyCinema,
    karaoke,
    follow,
    shift,
    applyFollow,
  ]);
  function context(next: { tab?: string; segment?: string }) {
    const t = next.tab || tab,
      s = next.segment || selected?.id;
    const p = new URLSearchParams({
      tab: t,
      ...(s ? { segment: s } : {}),
    });
    window.history.replaceState(null, "", `/estudar/${sourceId}?${p}`);
    if (data.session?.source_id === sourceId)
      void api(`sessions/${data.session.id}`, "PATCH", {
        context: { tab: t, segment: s },
      }).catch(() => {});
  }
  async function revealTranslation() {
    if (reveal) {
      setReveal(false);
      return;
    }
    if (!selected) return;
    if (selected.support || selected.translation) {
      setReveal(true);
      return;
    }
    // Abre antes de buscar: o esqueleto aparece no lugar onde o conteúdo vai
    // entrar, em vez de a linha ficar parada sem resposta ao clique.
    setReveal(true);
    await run(async () => {
      const result = await api<{
        support?: SegmentSupport;
        legacyText?: string;
      }>(`segments/${selected.id}/translate`, "POST", {});
      setLesson((old) =>
        old
          ? {
              ...old,
              segments: old.segments.map((s) =>
                s.id === selected.id
                  ? {
                      ...s,
                      support: result.support ?? s.support,
                      translation: result.legacyText ?? s.translation,
                    }
                  : s,
              ),
            }
          : old,
      );
    });
  }
  if (fatal)
    return (
      <div className="page">
        <Empty title="Não foi possível abrir este conteúdo.">
          <p>{fatal}</p>
          <Link href="/biblioteca">Voltar para a biblioteca</Link>
        </Empty>
      </div>
    );
  if (!lesson)
    return (
      <div className="page">
        <p className="loading">
          <LoaderCircle className="spin" size={20} /> Abrindo seu material…
        </p>
      </div>
    );
  return (
    <div className={`study ${cinema ? "cinema" : ""}`}>
      <div className="study-heading">
        <div>
          <Link href="/biblioteca" className="back-link">
            <ChevronLeft size={14} /> Biblioteca
          </Link>
          <h1>{lesson.source.title}</h1>
          <span className="small quiet">
            {lesson.source.author} · {languageLabel(lesson.source.language)}
            {lesson.source.is_example ? " · Material de exemplo" : ""}
            {/* TASK-021 RN-03: a origem da letra fica visível o tempo todo,
                não só no trecho selecionado. */}
            {lesson.source.catalog_provider === "lrclib"
              ? " · Letra da comunidade (LRCLIB), não revisada"
              : ""}
          </span>
        </div>
        {/* Mora no cabeçalho, não entre os controles de reprodução: o modo
            troca a sala inteira, não o player. É também a única largura que
            comporta o rótulo — na barra do vídeo ele quebrava a linha. No modo
            cinema este cabeçalho vira a faixa fina da superfície, e o botão
            passa a ser o fechar dela. O CSS remove os dois abaixo de 1240px,
            e com eles o alvo de foco. */}
        {lesson.source.kind !== "text" && (
          <button
            className={`cinema-toggle ${cinema ? "selected" : ""}`}
            aria-pressed={cinema}
            title={
              cinema
                ? "Voltar ao arranjo com painel de ferramentas"
                : "Ampliar o vídeo e manter só a transcrição ao lado"
            }
            onClick={() => applyCinema(!cinema)}
          >
            {cinema ? <X size={16} /> : <RectangleHorizontal size={16} />}
            {cinema ? "Sair do cinema" : "Modo cinema"}
          </button>
        )}
      </div>
      {!lesson.source.is_example && (
        <div className="notice" role="status">
          <p>
            {lesson.jobs[0]?.status === "processing"
              ? lesson.jobs[0]?.kind === "transcribe"
                ? "O Gemini está transcrevendo o vídeo. Os trechos serão salvos juntos ao concluir."
                : "Verificando a fonte e preparando os trechos disponíveis…"
              : lesson.jobs[0]?.status === "queued"
                ? lesson.jobs[0]?.kind === "transcribe"
                  ? "Transcrição na fila. O worker continuará mesmo se você sair desta tela."
                  : "Preparo na fila. O worker continuará mesmo se você sair desta tela."
                : unit
                  ? "Atividade disponível para este material. Você pode continuar estudando os demais trechos."
                  : lesson.jobs[0]?.error_message ||
                    "Atividades automáticas: integração não configurada. Você pode selecionar expressões, criar cartões e praticar por conta própria."}
          </p>
          {data.integrations.ai &&
            lesson.source.status !== "unavailable" &&
            lesson.segments.length > 0 && (
              <button
                className="text-button"
                disabled={
                  busy ||
                  lesson.jobs.some((j) =>
                    ["queued", "processing"].includes(j.status),
                  )
                }
                onClick={() =>
                  void run(async () => {
                    await api(`sources/${sourceId}/prepare`, "POST", {});
                    await load();
                  })
                }
              >
                {unit ? "Preparar novamente" : "Preparar atividade"}
              </button>
            )}
        </div>
      )}
      <div className="study-flow">
        <span>Entender → recuperar → falar → revisar</span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (data.session)
                await api(`sessions/${data.session.id}`, "PATCH", {
                  stage: "recall",
                });
              // O painel de ferramentas está oculto no modo cinema: mandar o
              // foco para a atividade sem devolver o painel seria um clique
              // que não mostra nada.
              applyCinema(false);
              setTab("activity");
              context({ tab: "activity" });
              await refresh();
            })
          }
        >
          Recuperar sem consulta <ArrowRight size={15} />
        </button>
      </div>
      <div className="study-grid">
        <section className="study-content">
          <div className="study-media">
            <Player
              source={lesson.source}
              selected={selected}
              playerRef={playerRef}
              onTime={onTime}
              onFollow={karaoke ? followAt : undefined}
              onPlay={karaoke ? () => setFollowHold(false) : undefined}
            />
            {lesson.source.kind !== "text" && (
              <div className="player-toolbar">
                <button
                  className="secondary"
                  disabled={selected?.start_ms == null}
                  onClick={() => {
                    if (selected?.start_ms != null) {
                      seekSegment(selected.start_ms);
                      playerRef.current?.playVideo();
                    }
                  }}
                >
                  <Repeat2 size={16} /> Repetir trecho
                </button>
                {lesson.source.video_id && (
                  <>
                    <button
                      className={loop ? "selected" : ""}
                      disabled={selected?.end_ms == null}
                      aria-pressed={loop}
                      onClick={() => setLoop(!loop)}
                    >
                      A–B
                    </button>
                    <select
                      aria-label="Velocidade de reprodução"
                      onChange={(e) =>
                        playerRef.current?.setPlaybackRate(
                          Number(e.target.value),
                        )
                      }
                      defaultValue="1"
                    >
                      <option value="0.5">0,5×</option>
                      <option value="0.75">0,75×</option>
                      <option value="1">1×</option>
                      <option value="1.25">1,25×</option>
                      <option value="1.5">1,5×</option>
                    </select>
                  </>
                )}
                <span>
                  {clock(time)}{" "}
                  <small className="quiet">
                    · {saved ? "salvo" : "salvando…"}
                  </small>
                </span>
              </div>
            )}
            {karaoke && (
              <div
                className="karaoke-toolbar"
                role="group"
                aria-label="Acompanhamento da letra"
              >
                <button
                  className={follow ? "selected" : ""}
                  aria-pressed={follow}
                  onClick={() => applyFollow(!follow)}
                >
                  Acompanhar a letra
                </button>
                <span className="karaoke-offset">
                  <span id="offset-label">Ajuste da letra</span>
                  <button
                    aria-describedby="offset-label offset-help"
                    disabled={offsetMs <= -TIME_OFFSET_LIMIT_MS}
                    onClick={() => changeOffset(-1)}
                  >
                    −0,5 s
                  </button>
                  <button
                    aria-describedby="offset-label offset-help"
                    disabled={offsetMs >= TIME_OFFSET_LIMIT_MS}
                    onClick={() => changeOffset(1)}
                  >
                    +0,5 s
                  </button>
                  <output aria-live="polite">
                    {formatTimeOffset(offsetMs)}
                  </output>
                </span>
                <small
                  id="offset-help"
                  className={followHold ? "quiet hold" : "quiet"}
                >
                  {followHold
                    ? "Acompanhamento pausado no trecho que você escolheu; volta quando você der play."
                    : "Tempo aproximado, da comunidade. Positivo: a letra acende depois; negativo, antes."}
                </small>
                {offsetError && (
                  <small className="error-text" role="alert">
                    {offsetError}
                  </small>
                )}
              </div>
            )}
          </div>
          <div className="study-reading">
            <div className="transcript-heading">
              <h2>
                {lesson.source.kind === "text"
                  ? "Leia o contexto"
                  : "Transcrição"}
              </h2>
              <span className="small quiet">
                {lesson.segments.length
                  ? `${lesson.segments.length} trechos carregados`
                  : "Sem texto disponível"}
              </span>
            </div>
            {!lesson.segments.length ? (
              <div className="notice">
                <p>
                  Este conteúdo ainda não tem transcrição. Você pode colar uma
                  legenda autorizada ou, em vídeos elegíveis, pedir uma
                  transcrição automática.
                </p>
                {lesson.source.kind === "youtube" && (
                  <div className="ai-transcription">
                    <h3>Transcrever o vídeo com Gemini</h3>
                    {lesson.transcriptionEstimate.amount != null && (
                      <p>
                        Reserva máxima estimada:{" "}
                        <strong>
                          US$ {lesson.transcriptionEstimate.amount.toFixed(2)}
                        </strong>
                        . Saldo disponível no limite do app: US${" "}
                        {lesson.transcriptionEstimate.remaining?.toFixed(2)}.
                      </p>
                    )}
                    <p className="small quiet">
                      A URL pública do YouTube será enviada ao Gemini. Os
                      trechos gerados terão tempos aproximados e ficarão
                      marcados como não revisados.
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={transcriptionConsent}
                        disabled={!lesson.transcriptionEstimate.available}
                        onChange={(e) =>
                          setTranscriptionConsent(e.target.checked)
                        }
                      />
                      Confirmo este envio e o custo máximo estimado.
                    </label>
                    <button
                      className="secondary"
                      disabled={
                        busy ||
                        !transcriptionConsent ||
                        !lesson.transcriptionEstimate.available ||
                        lesson.jobs.some((job) =>
                          ["queued", "processing"].includes(job.status),
                        )
                      }
                      onClick={() =>
                        void run(async () => {
                          await api(`sources/${sourceId}/transcribe`, "POST", {
                            consent: true,
                          });
                          setTranscriptionConsent(false);
                          await load();
                        })
                      }
                    >
                      Transcrever com Gemini
                    </button>
                    {!lesson.transcriptionEstimate.available && (
                      <p className="small error-text">
                        {lesson.transcriptionEstimate.reason}
                      </p>
                    )}
                  </div>
                )}
                <button
                  className="text-button"
                  aria-expanded={captionOpen}
                  aria-controls="caption-form"
                  onClick={() => setCaptionOpen(!captionOpen)}
                >
                  Adicionar legenda
                </button>
                <Link href="/praticar">
                  Praticar com um cenário independente
                </Link>
              </div>
            ) : (
              <div className="transcript" aria-label="Trechos do conteúdo">
                {lesson.segments
                  .slice(page * 30, page * 30 + 30)
                  .map((seg, i) => (
                    <div
                      key={seg.id}
                      data-segment-id={seg.id}
                      className={`segment ${seg.id === selected?.id ? "active" : ""} ${seg.id === playingId ? "playing" : ""}`}
                    >
                      <button
                        className="segment-select"
                        aria-current={seg.id === playingId ? "time" : undefined}
                        onClick={() => {
                          setSelectedId(seg.id);
                          context({ segment: seg.id });
                          // RN-03: escolher um trecho pausa o acompanhamento
                          // até a próxima reprodução.
                          if (karaoke) setFollowHold(true);
                          if (seg.start_ms != null) seekSegment(seg.start_ms);
                        }}
                      >
                        <span className="segment-time">
                          {seg.start_ms == null
                            ? String(page * 30 + i + 1).padStart(2, "0")
                            : clock(seg.start_ms)}
                        </span>
                        <span lang={lesson.source.language}>{seg.text}</span>
                      </button>
                      {seg.id === selected?.id && (
                        <div className="segment-support">
                          <button
                            className="text-button support-toggle"
                            aria-expanded={reveal}
                            onClick={() => void revealTranslation()}
                          >
                            {reveal ? "Ocultar apoio" : "Entender este trecho"}
                            <ChevronRight size={13} />
                          </button>
                          {reveal && (
                            <SegmentSupport
                              support={seg.support}
                              legacyText={seg.translation}
                              loading={busy}
                              aiReady={data.integrations.ai}
                              language={lesson.source.language}
                            />
                          )}
                          {seg.origin === "lyrics_catalog" ? (
                            // TASK-021 RN-03: letra sempre rotulada, com ou
                            // sem tempo.
                            <small className="quiet">
                              {lyricsSegmentLabel(seg.time_accuracy)}
                            </small>
                          ) : seg.time_accuracy === "approximate" && (
                            <small className="quiet">
                              {seg.origin === "provider_video_url"
                                ? "Transcrição automática não revisada · tempo aproximado"
                                : seg.origin === "public_caption"
                                  ? "Legenda automática do vídeo público, não revisada · tempo aproximado"
                                  : "Tempo aproximado · legenda fornecida"}
                            </small>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {lesson.segments.length > 30 && (
              <div className="pagination">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <span>
                  {page + 1} / {Math.ceil(lesson.segments.length / 30)}
                </span>
                <button
                  disabled={(page + 1) * 30 >= lesson.segments.length}
                  onClick={() => setPage(page + 1)}
                >
                  Próximos
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            {lesson.segments.length >= 100 && (
              <button
                className="text-button"
                onClick={() =>
                  void run(async () => {
                    const extra = await api<Segment[]>(
                      `sources/${sourceId}/segments?cursor=${lesson.segments.length}`,
                    );
                    setLesson({
                      ...lesson,
                      segments: [...lesson.segments, ...extra],
                    });
                  })
                }
              >
                Carregar próximos trechos
              </button>
            )}
            {captionOpen && (
              <form
                id="caption-form"
                className="caption-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api(`sources/${sourceId}/segments`, "POST", {
                      text: caption,
                      rights: captionRights,
                    });
                    setCaption("");
                    setCaptionOpen(false);
                    await load();
                  });
                }}
              >
                <label>
                  SRT ou VTT autorizado
                  <textarea
                    required
                    rows={5}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </label>
                <label>
                  Direito de uso da legenda
                  <select
                    value={captionRights}
                    onChange={(e) =>
                      setCaptionRights(e.target.value as "owned" | "licensed")
                    }
                  >
                    <option value="licensed">
                      Tenho autorização ou licença
                    </option>
                    <option value="owned">Sou o autor da legenda</option>
                  </select>
                </label>
                <label className="check-label">
                  <input type="checkbox" required />
                  Confirmo autoria ou autorização para usar a legenda.
                </label>
                <button
                  className="secondary"
                  disabled={busy || !caption.trim()}
                >
                  Salvar legenda
                </button>
              </form>
            )}
            <div className="study-bottom">
              <span className="small quiet">
                {lesson.source.is_example
                  ? "Texto autoral de demonstração, sem vídeo associado."
                  : "A origem acompanha cada expressão que você salvar."}
                {data.profile.shortcutsEnabled
                  ? ` · R: repetir · T: apoio${karaoke ? " · K: acompanhar" : ""}${wide ? " · C: cinema" : ""}`
                  : ""}
              </span>
              <Link href="/praticar">
                Praticar falando <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <aside className="study-panel">
          <div
            className="tabs"
            role="tablist"
            aria-label="Ferramentas de estudo"
          >
            {[
              ["expression", "Expressão"],
              ["tutor", "Tutor"],
              ["activity", "Atividade"],
            ].map(([value, label]) => (
              <button
                role="tab"
                aria-selected={tab === value}
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => {
                  setTab(value);
                  context({ tab: value });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="panel-body" role="tabpanel">
            {tab === "expression" ? (
              <>
                <h2>Palavras que você vai usar.</h2>
                <p className="quiet">
                  Escolha uma expressão do trecho ou salve a sua.
                </p>
                {unit && unit.vocabulary.length > 0 && (
                  <div className="expression-options">
                    {unit.vocabulary.map((v) => (
                      <button
                        key={v.expression}
                        className={
                          draft?.expression === v.expression ? "selected" : ""
                        }
                        onClick={() => setDraft(v)}
                        lang={lesson.source.language}
                      >
                        {v.expression}
                      </button>
                    ))}
                  </div>
                )}
                {!draft ? (
                  <div className="expression-preview">
                    <span lang={lesson.source.language}>
                      {unit?.vocabulary?.[0]?.expression ||
                        "Sua próxima expressão"}
                    </span>
                    <p>
                      {unit?.vocabulary?.[0]?.meaning ||
                        "Registre o sentido neste contexto e um exemplo que ajude você a lembrar."}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setDraft(
                          unit?.vocabulary?.[0] || {
                            expression:
                              window
                                .getSelection()
                                ?.toString()
                                .trim()
                                .slice(0, 180) || "",
                            meaning: "",
                            example: selected?.text || "",
                          },
                        )
                      }
                    >
                      <Plus size={16} /> Preparar cartão
                    </button>
                  </div>
                ) : (
                  <form
                    className="card-editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await api("cards", "POST", {
                          ...draft,
                          sourceId,
                          segmentId: selected?.id,
                          language: lesson.source.language,
                          mode: cardMode,
                        });
                        notify(
                          "Expressão salva. Sua primeira revisão já está disponível.",
                        );
                        setDraft(null);
                        await refresh();
                      });
                    }}
                  >
                    <label>
                      {`Expressão em ${languageLabel(lesson.source.language)}`}
                      <input
                        required
                        maxLength={180}
                        lang={lesson.source.language}
                        value={draft.expression}
                        onChange={(e) =>
                          setDraft({ ...draft, expression: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Sentido neste contexto
                      <textarea
                        required
                        rows={2}
                        value={draft.meaning}
                        onChange={(e) =>
                          setDraft({ ...draft, meaning: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {`Exemplo em ${languageLabel(lesson.source.language)}`}
                      <textarea
                        required
                        rows={3}
                        lang={lesson.source.language}
                        value={draft.example}
                        onChange={(e) =>
                          setDraft({ ...draft, example: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Como revisar
                      <select
                        value={cardMode}
                        onChange={(e) => setCardMode(e.target.value)}
                      >
                        <option value="production">
                          Produção: lembrar como dizer
                        </option>
                        <option value="recognition">
                          Reconhecimento: lembrar o sentido
                        </option>
                        <option value="listening">
                          Escuta com voz do navegador
                        </option>
                      </select>
                    </label>
                    <button className="primary full" disabled={busy}>
                      Salvar no meu baralho <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setDraft(null)}
                    >
                      Cancelar
                    </button>
                  </form>
                )}
                <p className="panel-footnote">
                  Nada entra no baralho sem sua confirmação.
                </p>
              </>
            ) : tab === "tutor" ? (
              <>
                <h2>Uma dúvida de cada vez.</h2>
                <p className="quiet">
                  Pergunte sobre o trecho e experimente construir uma frase
                  nova.
                </p>
                {!data.integrations.ai && (
                  <div className="notice">
                    Integração não configurada. Conecte a IA nas configurações
                    locais para conversar com o tutor.
                    <Link href="/configuracoes">
                      Ver integrações <ArrowUpRight size={14} />
                    </Link>
                  </div>
                )}
                {tutor && <div className="tutor-response">{tutor}</div>}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      if (!unit)
                        throw new Error(
                          "Prepare uma atividade deste conteúdo para usar o tutor.",
                        );
                      const response = await fetch(
                        `/api/lessons/${unit.id}/tutor`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ question }),
                        },
                      );
                      if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.message);
                      }
                      setTutor("");
                      const reader = response.body!.getReader(),
                        decoder = new TextDecoder();
                      let pending = "";
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        pending += decoder.decode(value, { stream: true });
                        const events = pending.split("\n\n");
                        pending = events.pop() || "";
                        for (const event of events) {
                          const line = event
                            .split("\n")
                            .find((l) => l.startsWith("data: "));
                          if (!line) continue;
                          const payload = JSON.parse(line.slice(6));
                          if (event.startsWith("event: error"))
                            throw new Error(payload.message);
                          if (payload.text)
                            setTutor((old) => old + payload.text);
                        }
                      }
                    });
                  }}
                >
                  <label>
                    Sua pergunta
                    <textarea
                      rows={4}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Como eu usaria essa expressão em uma daily?"
                      required
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={!data.integrations.ai || busy}
                  >
                    Perguntar <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2>{unit?.title || "Diga com suas palavras."}</h2>
                <p>
                  {unit?.prompt ||
                    "Sem consultar o trecho: explique em inglês a ideia principal e dê um exemplo seu."}
                </p>
                {unit?.provenance?.endsWith("_unreviewed") && (
                  <p className="small quiet">
                    Atividade gerada por IA, sem validação humana.
                  </p>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const result = await api<{
                        feedback: { reference?: string; label?: string } | null;
                      }>("attempts", "POST", {
                        activityId: unit?.id,
                        scenario: unit ? undefined : "daily",
                        kind: "text",
                        response: answer,
                        helpUsed: false,
                      });
                      if (data.session)
                        await api(`sessions/${data.session.id}`, "PATCH", {
                          stage: "speak",
                        });
                      setFeedback(
                        result.feedback?.reference
                          ? `${result.feedback.reference}\n\n${result.feedback.label}`
                          : "Tentativa registrada. Avaliação automática ainda não configurada.",
                      );
                      await refresh();
                    });
                  }}
                >
                  <label>
                    {`Sua resposta em ${languageLabel(lesson.source.language)}`}
                    <textarea
                      lang={lesson.source.language}
                      required
                      minLength={3}
                      maxLength={8000}
                      rows={6}
                      placeholder={
                        isEnglish(lesson.source.language as SupportedLanguage)
                          ? "I would start by…"
                          : undefined
                      }
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Registrar tentativa <ArrowRight size={16} />
                  </button>
                </form>
                {feedback && (
                  <div className="feedback-reference">
                    <h3>Depois da sua tentativa</h3>
                    <p>{feedback}</p>
                    <Link href="/praticar">
                      Agora, pratique falando <MicIcon />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="panel-bottom">
            <span className="small quiet">
              Um trecho. Uma expressão.
              <br />
              Uma ideia nas suas palavras.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
function MicIcon() {
  return <Volume2 size={15} />;
}

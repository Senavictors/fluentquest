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
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Send,
  LoaderCircle,
  ExternalLink,
  Upload,
  Trash2,
} from "lucide-react";
import { PageHead, Empty, useApp } from "./App";
import { api, clock } from "./http";
import type {
  Source,
  Segment,
  SegmentSupport,
  TranscriptionEstimate,
  Unit,
  Vocabulary,
} from "./types";
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
}: {
  support: SegmentSupport | null;
  legacyText: string | null;
  loading: boolean;
  aiReady: boolean;
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
          <dd lang="en">{support.example}</dd>
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
                  {source.author} <span>·</span> {source.language}
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
    [file, setFile] = useState<File | null>(null);
  return (
    <form
      className="import-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          if (kind === "media") {
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
              language: "en-US",
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
        !(kind === "youtube" && transcriptionMode === "ai") && (
          <>
            <label>
              {kind === "youtube"
                ? "Legenda autorizada (opcional)"
                : "Texto ou legenda em inglês"}
              <textarea
                rows={5}
                required={kind === "text"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole seu texto, uma legenda SRT ou VTT…"
                maxLength={500000}
              />
            </label>
            <label className="file-label">
              <Upload size={16} /> Carregar TXT, SRT ou VTT
              <input
                type="file"
                accept=".txt,.srt,.vtt"
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
      {(kind !== "youtube" || text) && (
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
          {kind === "youtube" && !text
            ? transcriptionMode === "ai"
              ? "Entendo que o link público será verificado agora. Antes da transcrição, confirmarei o envio ao Gemini e o custo máximo."
              : "Entendo que o vídeo será reproduzido pelo player oficial e não será baixado."
            : "Confirmo que posso utilizar este conteúdo na minha biblioteca pessoal."}
        </span>
      </label>
      <div className="form-footer">
        <p className="small quiet">
          {kind === "youtube" && transcriptionMode === "ai"
            ? "O vídeo não será baixado pelo FluentQuest. A URL pública será processada pelo Gemini somente após sua confirmação."
            : "Texto e reprodução continuam disponíveis sem IA."}
        </p>
        <button className="primary" disabled={busy}>
          {busy ? "Adicionando…" : "Adicionar à biblioteca"}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
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
}: {
  source: Source;
  selected: Segment | null;
  playerRef: React.RefObject<YTPlayer | null>;
  onTime: (n: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null),
    onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;
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
      <p lang="en">{selected?.text || "Escolha um trecho para começar."}</p>
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
    [immersed, setImmersed] = useState(
      params.has("mode")
        ? params.get("mode") === "immersion"
        : savedContext.immersion || false,
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
    [cardMode, setCardMode] = useState("production");
  const playerRef = useRef<YTPlayer | null>(null),
    lastSaved = useRef(0),
    lastPosition = useRef(0),
    [saved, setSaved] = useState(true);
  const selected =
      lesson?.segments.find((s) => s.id === selectedId) ||
      lesson?.segments[0] ||
      null,
    unit = lesson?.units[0];
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
  const onTime = useCallback(
    (n: number) => {
      setTime(n);
      lastPosition.current = n;
      if (loop && selected?.end_ms && n >= selected.end_ms) {
        playerRef.current?.seekTo((selected.start_ms || 0) / 1000, true);
      }
      if (Date.now() - lastSaved.current > 10000) {
        lastSaved.current = Date.now();
        setSaved(false);
        void api(`sources/${sourceId}`, "PATCH", { positionMs: n })
          .then(() => setSaved(true))
          .catch(() => setSaved(false));
      }
    },
    [loop, selected?.id, sourceId],
  );
  // Lido depois da montagem: ler no initializer divergiria do HTML do servidor.
  useEffect(() => {
    try {
      setCinema(localStorage.getItem("fq-cinema") === "1");
    } catch {
      // Navegador sem armazenamento: a sala abre no arranjo padrão.
    }
  }, []);
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
        playerRef.current?.seekTo(selected.start_ms / 1000, true);
        playerRef.current?.playVideo();
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
  ]);
  function context(next: {
    tab?: string;
    segment?: string;
    immersion?: boolean;
  }) {
    const t = next.tab || tab,
      s = next.segment || selected?.id,
      im = next.immersion ?? immersed;
    const p = new URLSearchParams({
      tab: t,
      ...(s ? { segment: s } : {}),
      ...(im ? { mode: "immersion" } : {}),
    });
    window.history.replaceState(null, "", `/estudar/${sourceId}?${p}`);
    if (data.session?.source_id === sourceId)
      void api(`sessions/${data.session.id}`, "PATCH", {
        context: { tab: t, segment: s, immersion: im },
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
    <div
      className={`study ${immersed ? "immersed" : ""} ${cinema ? "cinema" : ""}`}
    >
      <div className="study-heading">
        <div>
          <Link href="/biblioteca" className="back-link">
            <ChevronLeft size={14} /> Biblioteca
          </Link>
          <h1>{lesson.source.title}</h1>
          <span className="small quiet">
            {lesson.source.author} · {lesson.source.language}
            {lesson.source.is_example ? " · Material de exemplo" : ""}
          </span>
        </div>
        <button
          className="icon-button"
          title="Alternar modo imersão"
          aria-label="Alternar modo imersão"
          aria-pressed={immersed}
          onClick={() => {
            setImmersed(!immersed);
            context({ immersion: !immersed });
          }}
        >
          <Maximize2 size={19} />
        </button>
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
            />
            {lesson.source.kind !== "text" && (
              <div className="player-toolbar">
                <button
                  className="secondary"
                  disabled={selected?.start_ms == null}
                  onClick={() => {
                    if (selected?.start_ms != null) {
                      playerRef.current?.seekTo(selected.start_ms / 1000, true);
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
                {/* Só aparece onde há largura para o arranjo — o CSS o remove
                    abaixo de 1240px, e com ele o alvo de foco. */}
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
                  <RectangleHorizontal size={16} />{" "}
                  {cinema ? "Sair do cinema" : "Modo cinema"}
                </button>
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
                      className={`segment ${seg.id === selected?.id ? "active" : ""}`}
                    >
                      <button
                        className="segment-select"
                        onClick={() => {
                          setSelectedId(seg.id);
                          context({ segment: seg.id });
                          if (seg.start_ms != null)
                            playerRef.current?.seekTo(
                              seg.start_ms / 1000,
                              true,
                            );
                        }}
                      >
                        <span className="segment-time">
                          {seg.start_ms == null
                            ? String(page * 30 + i + 1).padStart(2, "0")
                            : clock(seg.start_ms)}
                        </span>
                        <span lang="en">{seg.text}</span>
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
                            />
                          )}
                          {seg.time_accuracy === "approximate" && (
                            <small className="quiet">
                              {seg.origin === "provider_video_url"
                                ? "Transcrição automática não revisada · tempo aproximado"
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
                  ? ` · R: repetir · T: apoio${wide ? " · C: cinema" : ""}`
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
                        lang="en"
                      >
                        {v.expression}
                      </button>
                    ))}
                  </div>
                )}
                {!draft ? (
                  <div className="expression-preview">
                    <span lang="en">
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
                      Expressão em inglês
                      <input
                        required
                        maxLength={180}
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
                      Exemplo em inglês
                      <textarea
                        required
                        rows={3}
                        lang="en"
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
                    Sua resposta em inglês
                    <textarea
                      lang="en"
                      required
                      minLength={3}
                      maxLength={8000}
                      rows={6}
                      placeholder="I would start by…"
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

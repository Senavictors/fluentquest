"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  Square,
  Play,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Headphones,
  Volume2,
  ChevronRight,
} from "lucide-react";
import { useApp, PageHead, Empty } from "./App";
import { api, clock, date } from "./http";
import type { Recording, ReviewCard } from "./types";
export function Practice() {
  const { data, run, refresh, notify, busy } = useApp();
  const params = useSearchParams();
  const [scenario, setScenario] = useState(params.get("scenario") || "daily"),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState<Blob | null>(null),
    [preview, setPreview] = useState(""),
    [consent, setConsent] = useState(false),
    [aiConsent, setAiConsent] = useState(false),
    [preserve, setPreserve] = useState(false),
    [records, setRecords] = useState<Recording[]>([]),
    [feedback, setFeedback] = useState<{
      strength: string;
      correction: string;
      retryPrompt: string;
      transcript: string;
    } | null>(null),
    [text, setText] = useState(""),
    [textMode, setTextMode] = useState(false),
    [retryOf, setRetryOf] = useState<string | null>(null),
    [reflection, setReflection] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    started = useRef(0),
    chunks = useRef<Blob[]>([]),
    urlRef = useRef("");
  const selected =
    data.scenarios.find((s) => s.id === scenario) || data.scenarios[0];
  const load = async () => setRecords(await api<Recording[]>("recordings"));
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    setSeconds(
      Math.min(
        90,
        Math.max(1, Math.round((Date.now() - started.current) / 1000)),
      ),
    );
  }
  async function start() {
    await run(async () => {
      if ((retryOf || scenario === "weekly") && reflection.trim().length < 10)
        throw new Error(
          "Escolha um ponto de melhoria para sua nova tentativa.",
        );
      if (!consent)
        throw new Error("Confirme a gravação antes de abrir o microfone.");
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Este navegador não oferece gravação. Tente Chrome, Edge ou Safari atualizado, ou responda por texto.",
        );
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch {
        throw new Error(
          "Microfone não autorizado. Permita o acesso nas configurações do navegador ou responda por texto.",
        );
      }
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const audio = new Blob(chunks.current, { type: rec.mimeType });
        setBlob(audio);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(audio);
        setPreview(urlRef.current);
      };
      rec.onerror = () => {
        stop();
        notify(
          "A gravação foi interrompida. Confira o microfone e tente novamente.",
        );
      };
      rec.start(1000);
      started.current = Date.now();
      setSeconds(0);
      setBlob(null);
      setPreview("");
      setRecording(true);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(Math.min(90, elapsed));
        if (elapsed >= 90) stop();
      }, 250);
    });
  }
  async function save() {
    if (!blob) return;
    await run(async () => {
      if ((retryOf || scenario === "weekly") && reflection.trim().length < 10)
        throw new Error(
          "Escreva o ponto que você quer melhorar antes de salvar uma nova tentativa.",
        );
      const intent = await api<{ uploadUrl: string }>(
        "recordings/upload-intent",
        "POST",
        {
          mime: blob.type,
          size: blob.size,
          durationMs: seconds * 1000,
          consent: true,
          preserve,
        },
      );
      const response = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      const attempt = await api<{ id: string }>("attempts", "POST", {
        scenario,
        kind: retryOf ? "retry" : "speaking",
        response: selected.title,
        recordingId: result.id,
        helpUsed: false,
        retryOf: retryOf || undefined,
        reflection: reflection || undefined,
      });
      if (scenario === "weekly")
        await api("challenges/weekly", "POST", {
          attemptId: attempt.id,
          reflection,
        });
      if (data.session)
        await api(`sessions/${data.session.id}`, "PATCH", { stage: "review" });
      setRetryOf(attempt.id);
      setReflection("");
      setBlob(null);
      setPreview("");
      notify("Gravação salva. Sua tentativa já faz parte da jornada.");
      await load();
      await refresh();
    });
  }
  return (
    <div className="page practice">
      <PageHead
        title="Encontre suas palavras."
        subtitle="Um cenário, uma tentativa. Você pode começar de novo."
      />
      <div className="scenario-picker">
        <label>
          O que você quer praticar?
          <select
            value={scenario}
            disabled={recording}
            onChange={(e) => {
              setScenario(e.target.value);
              setFeedback(null);
              setRetryOf(null);
              setReflection("");
            }}
          >
            {data.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <span className="quiet small">{selected.skill} · até 90 segundos</span>
      </div>
      <div className="practice-grid">
        <section className="speaking-task">
          <h2>{selected.title}</h2>
          <p className="scenario-prompt">{selected.prompt}</p>
          <div className="recorder">
            <div className={`mic-circle ${recording ? "recording" : ""}`}>
              <Mic size={36} strokeWidth={1.4} />
            </div>
            <div className="recording-time" aria-live="off">
              {clock(seconds * 1000)} <span>/ 01:30</span>
            </div>
            <p
              aria-live="polite"
              className={recording ? "record-status" : "quiet"}
            >
              {recording
                ? "Gravando. Diga uma ideia de cada vez."
                : blob
                  ? "Sua tentativa está pronta para ouvir."
                  : "Seu microfone está fechado."}
            </p>
            {recording ? (
              <button className="primary danger" onClick={stop}>
                <Square size={17} fill="currentColor" /> Parar gravação
              </button>
            ) : (
              <>
                {preview ? (
                  <>
                    <audio controls src={preview} />
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        Salvar tentativa <Check size={17} />
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setBlob(null);
                          setPreview("");
                          setSeconds(0);
                        }}
                      >
                        <Trash2 size={16} /> Descartar
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="primary"
                    disabled={busy || !consent}
                    onClick={() => void start()}
                  >
                    <Mic size={17} /> Gravar minha resposta
                  </button>
                )}
              </>
            )}
            {!recording && (
              <div className="record-consent">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    Permito gravar minha voz nesta atividade. Vou ouvir antes de
                    salvar.
                  </span>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={preserve}
                    onChange={(e) => setPreserve(e.target.checked)}
                  />
                  <span>Preservar como amostra da minha jornada.</span>
                </label>
              </div>
            )}
            <p className="small quiet">
              O microfone fecha ao parar. Áudio salvo é apagado em 7 dias,
              exceto amostras que você escolher preservar.
            </p>
          </div>
          {(retryOf || scenario === "weekly") && (
            <label>
              O que você quer melhorar na próxima tentativa?
              <input
                maxLength={1000}
                placeholder="Ex.: explicar o sintoma antes de propor a solução"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </label>
          )}
          <div className="button-row">
            <button
              className="text-button"
              disabled={recording}
              onClick={() => setTextMode(!textMode)}
            >
              {textMode
                ? "Fechar resposta escrita"
                : "Sem microfone? Responda por texto."}
            </button>
            {records.length > 0 && (
              <Link className="text-link" href="/revisar">
                Continuar para revisão <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {textMode && (
            <form
              className="text-attempt"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("attempts", "POST", {
                    scenario,
                    kind: "text",
                    response: text,
                    helpUsed: false,
                  });
                  setText("");
                  notify(
                    "Resposta escrita registrada. Ela não é uma avaliação de fala.",
                  );
                  await refresh();
                });
              }}
            >
              <label>
                Sua resposta em inglês
                <textarea
                  lang="en"
                  rows={5}
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <button className="secondary" disabled={busy}>
                Registrar resposta <Check size={15} />
              </button>
            </form>
          )}
        </section>
        <aside className="practice-feedback">
          <h2>Depois de falar</h2>
          {feedback ? (
            <>
              <section>
                <span className="small-label">Ponto forte</span>
                <p>{feedback.strength}</p>
              </section>
              <section>
                <span className="small-label">Uma correção prioritária</span>
                <p>{feedback.correction}</p>
              </section>
              <section>
                <span className="small-label">Sua próxima tentativa</span>
                <p>{feedback.retryPrompt}</p>
              </section>
              <details>
                <summary>Ver transcrição automática</summary>
                <p lang="en">{feedback.transcript}</p>
              </details>
            </>
          ) : (
            <>
              <div className="feedback-step">
                <span>1</span>
                <div>
                  <h3>Ouça sua tentativa</h3>
                  <p>Você conseguiu transmitir a ideia principal?</p>
                </div>
              </div>
              <div className="feedback-step">
                <span>2</span>
                <div>
                  <h3>Escolha um ponto para melhorar</h3>
                  <p>Uma frase mais clara já é um próximo passo.</p>
                </div>
              </div>
              <div className="feedback-step">
                <span>3</span>
                <div>
                  <h3>Tente novamente</h3>
                  <p>Use uma situação diferente e menos apoio.</p>
                </div>
              </div>
              {!data.integrations.ai && (
                <div className="notice">
                  Feedback de IA ainda não configurado. Nenhuma nota automática
                  será atribuída.
                  <Link href="/configuracoes">
                    Ver integrações <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </>
          )}
          <p className="panel-footnote">
            Pronúncia acústica: não avaliada nesta versão.
          </p>
        </aside>
      </div>
      <section className="recordings">
        <div className="section-head">
          <h2>Suas tentativas</h2>
          <span className="quiet small">{records.length} gravações</span>
        </div>
        {records.length > 0 && (
          <div className="notice">
            <p>
              O feedback envia sua gravação ao Gemini. No tier gratuito, o
              provedor pode usar o conteúdo para melhorar seus modelos. Salvar e
              ouvir a gravação aqui mantém o áudio local.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
                disabled={!data.integrations.ai}
              />
              Autorizo enviar minhas gravações ao Gemini para receber feedback
              nesta sessão.
            </label>
            {!data.integrations.ai && <p>Integração não configurada.</p>}
          </div>
        )}
        {!records.length ? (
          <p className="quiet">
            Suas gravações salvas vão aparecer aqui, com a opção de ouvir e
            excluir.
          </p>
        ) : (
          records.map((rec) => (
            <article key={rec.id} className="recording-row">
              <Headphones size={22} />
              <div>
                <strong>Tentativa de {date(rec.created_at)}</strong>
                <span className="small quiet">
                  {clock(rec.duration_ms)} ·{" "}
                  {rec.preserve
                    ? "amostra preservada"
                    : `expira em ${date(rec.expires_at)}`}
                </span>
              </div>
              <audio
                controls
                preload="none"
                src={`/api/recordings/${rec.id}/audio`}
              />
              <button
                className="text-button"
                disabled={!data.integrations.ai || !aiConsent || busy}
                onClick={() =>
                  void run(async () => {
                    setFeedback(
                      (await api(
                        `recordings/${rec.id}/assess`,
                        "POST",
                        {},
                      )) as typeof feedback,
                    );
                  })
                }
              >
                Receber feedback
              </button>
              <button
                className="icon-button"
                title={
                  rec.preserve
                    ? "Deixar expirar em sete dias"
                    : "Preservar amostra"
                }
                aria-label={
                  rec.preserve
                    ? "Deixar gravação expirar"
                    : "Preservar gravação"
                }
                onClick={() =>
                  void run(async () => {
                    await api(`recordings/${rec.id}`, "PATCH", {
                      preserve: !rec.preserve,
                    });
                    await load();
                  })
                }
              >
                <Check size={17} className={rec.preserve ? "accent" : ""} />
              </button>
              <button
                className="icon-button"
                aria-label="Excluir gravação"
                onClick={() =>
                  void run(async () => {
                    await api(`recordings/${rec.id}`, "DELETE");
                    await load();
                    await refresh();
                  })
                }
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
export function Reviews() {
  const { run, refresh, busy } = useApp();
  const [queue, setQueue] = useState<ReviewCard[]>([]),
    [ready, setReady] = useState(false),
    [total, setTotal] = useState(0),
    [completed, setCompleted] = useState(0),
    [revealed, setRevealed] = useState(false),
    [undo, setUndo] = useState(""),
    [nextDue, setNextDue] = useState<string | null>(null),
    [typed, setTyped] = useState("");
  async function load() {
    const result = await api<{
      cards: ReviewCard[];
      count: number;
      next_due: string | null;
    }>("reviews");
    setQueue(result.cards);
    setTotal(result.count);
    setNextDue(result.next_due);
    setReady(true);
  }
  useEffect(() => {
    void load();
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
  const current = queue[0];
  async function answer(rating: number) {
    if (!current) return;
    await run(async () => {
      const value = await api<{ eventId: string }>(
        `reviews/${current.id}/answer`,
        "POST",
        { rating, version: current.version },
      );
      setUndo(value.eventId);
      setCompleted(completed + 1);
      setRevealed(false);
      setTyped("");
      await load();
      await refresh();
    });
  }
  const listen = () => {
    if (!current) return;
    const utterance = new SpeechSynthesisUtterance(current.example);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div className="page review-page">
      <PageHead
        title="Um pouco hoje. Mais fácil amanhã."
        subtitle="Recupere da memória antes de revelar a resposta."
        action={
          <Link href="/" className="text-link">
            Encerrar <XIcon />
          </Link>
        }
      />
      <div className="review-progress">
        <span>
          Revisar <b>{completed} concluídos</b>
        </span>
        <span>{queue.length} na fila</span>
        <progress
          value={completed}
          max={completed + queue.length || 1}
          aria-label="Progresso desta revisão"
        />
      </div>
      {!ready ? (
        <p className="quiet">Abrindo o baralho…</p>
      ) : !current ? (
        <Empty
          title={
            completed
              ? "Por hoje, sua fila está em dia."
              : "Sua memória também precisa de espaço."
          }
        >
          <p>
            {total
              ? `Você tem ${total} cartões. ${nextDue ? `Próxima revisão: ${new Date(nextDue).toLocaleString("pt-BR")}.` : ""}`
              : "Salve uma expressão na sala de estudo para começar seu baralho."}
          </p>
          <Link className="button primary" href={total ? "/" : "/biblioteca"}>
            {total ? "Voltar para Hoje" : "Escolher um conteúdo"}
            <ArrowRight size={16} />
          </Link>
        </Empty>
      ) : (
        <section className="review-stage">
          <span className="context-line">
            {current.mode === "production"
              ? "Produção"
              : current.mode === "listening"
                ? "Escuta"
                : "Reconhecimento"}{" "}
            · tente antes de consultar
          </span>
          {current.mode === "listening" ? (
            <>
              <button className="audio-prompt" onClick={listen}>
                <Volume2 size={26} /> Ouvir exemplo
              </button>
              <span className="small quiet">
                Voz sintética do navegador · não é áudio da fonte
              </span>
            </>
          ) : (
            <h2 lang={current.mode === "production" ? "pt-BR" : "en"}>
              {current.mode === "production"
                ? current.meaning
                : current.expression}
            </h2>
          )}
          <p className="review-meaning">
            {current.mode === "recognition"
              ? "Qual é o sentido desta expressão?"
              : current.mode === "production"
                ? "Como você expressaria essa ideia em inglês? Use em uma frase."
                : "Qual expressão você reconheceu no exemplo?"}
          </p>
          <label className="review-answer-label">
            Sua lembrança (opcional)
            <input
              lang="en"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Diga em voz alta ou escreva aqui"
              autoComplete="off"
            />
          </label>
          {!revealed ? (
            <button
              className="primary reveal-button"
              onClick={() => setRevealed(true)}
            >
              Revelar resposta <ChevronRight size={18} />
            </button>
          ) : (
            <div className="revealed">
              <h3 lang="en">{current.expression}</h3>
              <p>{current.meaning}</p>
              <p lang="en" className="italic">
                {current.example}
              </p>
              <p className="small quiet">
                Como foi recuperar? A nota é sua; não medimos apenas o tempo.
              </p>
              <div className="rating-buttons">
                {[
                  [1, "Esqueci", "Preciso rever"],
                  [2, "Difícil", "Com bastante esforço"],
                  [3, "Bom", "Lembrei com esforço"],
                  [4, "Fácil", "Lembrei de imediato"],
                ].map(([n, label, hint]) => (
                  <button
                    key={n}
                    disabled={busy}
                    onClick={() => void answer(Number(n))}
                  >
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="review-source">
            {current.source_title
              ? `Da fonte “${current.source_title}”`
              : "Expressão adicionada por você"}
            <br />O agendamento mede a memória deste item, não sua fluência.
          </p>
        </section>
      )}
      {undo && (
        <button
          className="text-button undo-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api(`reviews/${undo}/undo`, "POST", {});
              setUndo("");
              setCompleted(Math.max(0, completed - 1));
              setRevealed(false);
              await load();
              await refresh();
            })
          }
        >
          <RefreshCw size={15} /> Tocou errado? Corrigir última resposta.
        </button>
      )}
    </div>
  );
}
function XIcon() {
  return <ArrowLeft size={15} />;
}

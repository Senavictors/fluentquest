"use client";
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Mic,
  Repeat2,
  Route,
  Sun,
  Settings,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  Check,
  LoaderCircle,
} from "lucide-react";
import { api, HttpError, money } from "./http";
import type { Bootstrap } from "./types";
import { Library, Study } from "./Study";
import { Practice, Reviews } from "./Practice";
import { Journey, Preferences, Onboarding } from "./Settings";
type Context = {
  data: Bootstrap;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  busy: boolean;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("App context missing");
  return ctx;
}
const nav = [
  { href: "/", label: "Hoje", Icon: Sun },
  { href: "/biblioteca", label: "Biblioteca", Icon: BookOpen },
  { href: "/praticar", label: "Praticar", Icon: Mic },
  { href: "/revisar", label: "Revisar", Icon: Repeat2 },
  { href: "/jornada", label: "Jornada", Icon: Route },
];
export function App() {
  const [data, setData] = useState<Bootstrap | null>(null),
    [loading, setLoading] = useState(true),
    [unauth, setUnauth] = useState(false),
    [message, setMessage] = useState(""),
    [fatal, setFatal] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [online, setOnline] = useState(true);
  const path = usePathname(),
    router = useRouter();
  const refresh = useCallback(async () => {
    try {
      const result = await api<Bootstrap>("bootstrap");
      setData(result);
      setUnauth(false);
      setFatal("");
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        setUnauth(true);
        setData(null);
      } else {
        setFatal(e instanceof Error ? e.message : "O banco não respondeu.");
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const theme = data?.profile.theme || "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data?.profile.theme]);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(t);
  }, [message]);
  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível concluir.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="boot">
        <span className="wordmark">
          FluentQuest<span>.</span>
        </span>
        <p>
          <LoaderCircle className="spin" size={18} /> Abrindo seu espaço de
          estudo…
        </p>
      </main>
    );
  if (unauth) return <Login onLogin={refresh} />;
  if (!data)
    return (
      <main className="boot">
        <h1>Vamos abrir seu espaço.</h1>
        <p>{fatal}</p>
        <p>Confira a configuração local e se o PostgreSQL está em execução.</p>
        <button onClick={() => void refresh()}>Tentar novamente</button>
      </main>
    );
  const ctx = { data, refresh, notify: setMessage, run, busy };
  const isStudy = path.startsWith("/estudar/");
  return (
    <AppContext.Provider value={ctx}>
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <div className="app-shell">
        <header className="mobile-head">
          <Link href="/" className="wordmark">
            FluentQuest<span>.</span>
          </Link>
          <button
            className="icon-button"
            aria-label="Abrir perfil e configurações"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </header>
        <aside className={`sidebar ${menu ? "mobile-open" : ""}`}>
          <Link href="/" className="wordmark">
            FluentQuest<span>.</span>
          </Link>
          <nav aria-label="Navegação principal">
            {nav.map(({ href, label, Icon }) => {
              const active =
                href === "/"
                  ? path === "/"
                  : path.startsWith(href) ||
                    (href === "/biblioteca" && isStudy);
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? "nav-item active" : "nav-item"}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {href === "/revisar" && data.due > 0 && (
                    <b className="nav-count">{data.due}</b>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="usage-small">
              <span className="small-label">Uso de IA no mês</span>
              <div>
                {money(data.usage.confirmed + data.usage.reserved)}{" "}
                <small>/ {money(data.usage.limit)}</small>
              </div>
              <progress
                value={data.usage.confirmed + data.usage.reserved}
                max={data.usage.limit || 1}
                aria-label="Uso do orçamento mensal"
              />
              <span className="quiet small">
                {data.integrations.ai
                  ? "Controle de orçamento ativo"
                  : "IA ainda não conectada"}
              </span>
            </div>
            <Link href="/configuracoes" className="profile-link">
              <span className="avatar-small">{data.user.name.charAt(0)}</span>
              <span>
                {data.user.name}
                <small>Perfil e configurações</small>
              </span>
              <Settings size={17} />
            </Link>
          </div>
        </aside>
        <main id="main" className={`main ${isStudy ? "study-main" : ""}`}>
          {!online && (
            <div className="notice">
              Você está sem conexão externa. O estudo local pode continuar;
              vídeos e IA precisam de internet.
            </div>
          )}
          {fatal && <div className="notice error">{fatal}</div>}
          {path === "/" ? (
            <Today />
          ) : path === "/biblioteca" ? (
            <Library />
          ) : isStudy ? (
            <Study sourceId={path.split("/")[2]} />
          ) : path === "/praticar" ? (
            <Practice />
          ) : path === "/revisar" ? (
            <Reviews />
          ) : path === "/jornada" ? (
            <Journey />
          ) : path === "/configuracoes" ? (
            <Preferences />
          ) : path === "/onboarding" ? (
            <Onboarding />
          ) : (
            <div className="empty">
              <h1>Este caminho ainda não existe.</h1>
              <Link href="/">Voltar para Hoje</Link>
            </div>
          )}
        </main>
        <nav className="mobile-nav" aria-label="Navegação no celular">
          {nav.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={
                (
                  href === "/"
                    ? path === "/"
                    : path.startsWith(href) ||
                      (href === "/biblioteca" && isStudy)
                )
                  ? "active"
                  : ""
              }
            >
              <Icon size={21} />
              <span>
                {label}
                {href === "/revisar" && data.due > 0 ? ` · ${data.due}` : ""}
              </span>
            </Link>
          ))}
        </nav>
      </div>
      {message && (
        <div role="status" className="toast">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Fechar mensagem"
            onClick={() => setMessage("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("estudante@fluentquest.local"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <main className="login">
      <section className="login-story">
        <span className="wordmark">
          FluentQuest<span>.</span>
        </span>
        <div>
          <div className="rule" />
          <h1>
            Seu inglês.
            <br />
            Em movimento.
          </h1>
          <p>
            Um trecho que faz sentido.
            <br />
            Uma ideia nas suas palavras.
            <br />
            Um pouco mais de autonomia.
          </p>
        </div>
        <span className="small quiet">Aprender · falar · lembrar</span>
      </section>
      <section className="login-form">
        <h2>Entre no seu espaço.</h2>
        <p className="quiet">
          Sua próxima conversa começa com um pouco de prática.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              const response = await fetch("/api/auth/sign-in/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              const data = await response.json();
              if (!response.ok)
                throw new Error(
                  "Não foi possível entrar. Confira seu e-mail e senha.",
                );
              await onLogin();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erro de conexão.");
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="primary full" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="small quiet">
          Acesso pessoal. A conta é criada na configuração local do FluentQuest.
        </p>
      </section>
    </main>
  );
}
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="quiet">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-rule" />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
function Today() {
  const { data, run, refresh, busy } = useApp(),
    router = useRouter();
  const [duration, setDuration] = useState(data.profile.sessionMinutes),
    [closed, setClosed] = useState(false);
  const selected =
    data.sources.find((s) => s.id === data.session?.source_id) ||
    data.sources[0];
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  async function start() {
    await run(async () => {
      let sourceId = selected?.id;
      if (!sourceId) {
        const example = await api<{ id: string }>("example", "POST", {});
        sourceId = example.id;
      }
      await api("sessions", "POST", { sourceId, duration });
      await refresh();
      router.push(`/estudar/${sourceId}`);
    });
  }
  return (
    <div className="today page">
      <div className="dateline">
        <span>{formatted}</span>
        <span>Seu espaço de prática</span>
      </div>
      {!data.profile.onboarded && (
        <div className="onboarding-strip">
          <span>Vamos adaptar a jornada aos seus objetivos?</span>
          <Link href="/onboarding">
            Ajustar meu perfil <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      {closed ? (
        <section className="session-close">
          <Check size={34} />
          <h1>Por hoje, está feito.</h1>
          <p>
            O que você praticou fica na sua jornada. Volte quando fizer sentido
            para você.
          </p>
          <Link className="button primary" href="/jornada">
            Ver minha jornada <ArrowRight size={18} />
          </Link>
          <button className="text-button" onClick={() => setClosed(false)}>
            Continuar estudando
          </button>
        </section>
      ) : (
        <>
          <div className="today-grid">
            <section className="mission">
              <p className="context-line">
                Missão de hoje <span>·</span> Daily
              </p>
              <h1>{data.profile.goal || "Explicar um bloqueio sem roteiro"}</h1>
              <p className="mission-description">
                {selected ? (
                  <>
                    Retome <em>“{selected.title}”</em>, recupere algumas
                    expressões de memória e grave uma atualização de até 90
                    segundos.
                  </>
                ) : (
                  <>
                    Comece com uma situação real de trabalho: um teste que passa
                    na sua máquina e falha no CI. Leia, encontre suas palavras e
                    explique o próximo passo.
                  </>
                )}
              </p>
              <div
                className="duration-options"
                role="group"
                aria-label="Duração da sessão"
              >
                {([10, 25, 45] as const).map((n) => (
                  <button
                    key={n}
                    className={n === duration ? "selected" : ""}
                    onClick={() => setDuration(n)}
                    aria-pressed={n === duration}
                  >
                    {n} min
                  </button>
                ))}
              </div>
              <div className="mission-actions">
                <button
                  className="primary"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  {data.session
                    ? "Continuar minha sessão"
                    : "Começar minha sessão"}
                  <ArrowRight size={18} />
                </button>
                <Link href="/praticar" className="text-link">
                  Trocar missão
                </Link>
              </div>
              {!selected && (
                <p className="small quiet">
                  Primeira sessão com material de exemplo. Nenhuma chamada de
                  IA.
                </p>
              )}
              <ol className="session-steps">
                {["Entender", "Recuperar", "Falar", "Revisar", "Fechar"].map(
                  (s, i) => (
                    <li
                      key={s}
                      className={
                        i ===
                        [
                          "understand",
                          "recall",
                          "speak",
                          "review",
                          "close",
                        ].indexOf(data.session?.stage || "understand")
                          ? "current"
                          : ""
                      }
                    >
                      <span>{i + 1}</span>
                      {s}
                    </li>
                  ),
                )}
              </ol>
              <div className="mission-note">
                <span className="note-mark">“</span>
                <p>
                  O objetivo não é falar sem erros.
                  <br />É conseguir dizer o que importa.
                </p>
              </div>
            </section>
            <aside className="today-aside">
              <section>
                <h2>Revisões previstas</h2>
                <div className="review-total">
                  <strong>{data.due}</strong>
                  <span>
                    {data.due === 1 ? "item para hoje" : "itens para hoje"}
                    <small>
                      {data.due
                        ? `cerca de ${Math.max(1, Math.ceil(data.due / 2))} minutos`
                        : "um novo hábito começa pequeno"}
                    </small>
                  </span>
                </div>
                <div className="queue-line">
                  <span style={{ width: data.due ? "60%" : "0%" }} />
                </div>
                <Link className="button secondary" href="/revisar">
                  {data.due ? "Revisar primeiro" : "Abrir meu baralho"}
                  <ArrowUpRight size={15} />
                </Link>
              </section>
              <section>
                <h2>O que mudou em você</h2>
                {data.progress.evidence.length ? (
                  <>
                    <blockquote>
                      {data.progress.evidence[0].description}
                    </blockquote>
                    <span className="small quiet">
                      Registro de prática · sem certificação
                    </span>
                  </>
                ) : (
                  <>
                    <p className="quiet italic">
                      Sua primeira evidência começa com uma tentativa.
                    </p>
                    <p className="small quiet">
                      Quando você praticar, sua jornada aparece aqui.
                    </p>
                  </>
                )}
              </section>
              <section>
                <h2>Um espaço para falar</h2>
                <p className="quiet">
                  Pratique uma daily, explique um bug ou conte algo que você
                  descobriu.
                </p>
                <Link className="text-link" href="/praticar">
                  Escolher um cenário <ArrowRight size={16} />
                </Link>
              </section>
            </aside>
          </div>
          <footer className="today-footer">
            <span>
              Meta semanal:{" "}
              <b>
                {data.progress.weekly_sessions} de {data.profile.weeklyGoal}{" "}
                sessões
              </b>
              <small>Descanso não apaga conquistas.</small>
            </span>
            <button
              className="text-button"
              onClick={() =>
                void run(async () => {
                  if (data.session)
                    await api(`sessions/${data.session.id}`, "PATCH", {
                      complete: true,
                      stage: "close",
                    });
                  await refresh();
                  setClosed(true);
                })
              }
            >
              Encerrar por hoje <Check size={16} />
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

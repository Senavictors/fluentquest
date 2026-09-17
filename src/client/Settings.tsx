"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  Mic,
  BookOpen,
} from "lucide-react";
import { PageHead, Empty, useApp } from "./App";
import { api, money, date } from "./http";
export function Journey() {
  const { data } = useApp();
  const p = data.progress;
  return (
    <div className="page journey">
      <PageHead
        title="Sua jornada tem evidências."
        subtitle="Participação é constância. Domínio aparece na prática."
      />
      <div className="journey-grid">
        <section className="character">
          <div className="level-seal">
            <span>{p.level}</span>
            <small>NÍVEL</small>
          </div>
          <h2>
            Comunicador
            <br />
            em construção
          </h2>
          <p>
            {p.xp} / {p.nextLevel} XP
          </p>
          <progress
            value={p.xp}
            max={p.nextLevel}
            aria-label="Experiência acumulada"
          />
          <p className="small quiet">
            XP mede participação.
            <br />
            Nenhum ponto vem de assistir vídeo.
          </p>
          <div className="weekly-challenge">
            <h3>Seu desafio da semana</h3>
            <p>Defender uma escolha técnica e responder a uma objeção.</p>
            <Link className="text-link" href="/praticar?scenario=weekly">
              Escolher o desafio <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="skills">
          <h2>O que você está construindo</h2>
          {[
            "Escuta",
            "Expressão oral",
            "Vocabulário ativo",
            "Construção de frases",
            "Comunicação profissional",
          ].map((skill) => {
            const count = p.evidence.filter((e) => e.skill === skill).length;
            return (
              <div className="skill-row" key={skill}>
                <span>{skill}</span>
                <span className="quiet">
                  {count
                    ? `${count} registros · avaliação pendente`
                    : "Evidência insuficiente"}
                </span>
              </div>
            );
          })}
          <p className="small quiet">
            Registros de tentativa não são certificações. Estimativas de nível
            precisam de avaliações comparáveis.
          </p>
          <div className="chapter-list">
            <h2>Próximos capítulos</h2>
            {[
              "Primeiro contato",
              "Daily sem roteiro",
              "Code review",
              "Decisões de arquitetura",
              "Conversa sob pressão",
            ].map((chapter, i) => (
              <Link href="/praticar" key={chapter}>
                <span
                  className={
                    i === 0 && p.recordings > 0
                      ? "chapter-dot done"
                      : "chapter-dot"
                  }
                />
                <span>{chapter}</span>
                <small>
                  {i === 0
                    ? p.recordings
                      ? "em construção"
                      : "comece aqui"
                    : "disponível para explorar"}
                </small>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="evidence-section">
        <div className="section-head">
          <h2>O que você já colocou em prática</h2>
          <span className="small quiet">Histórico pessoal</span>
        </div>
        {!p.evidence.length ? (
          <p className="quiet">
            Ainda não há tentativas registradas. Uma resposta escrita ou falada
            é seu primeiro passo.
          </p>
        ) : (
          p.evidence.map((e) => (
            <article key={e.id} className="evidence-row">
              <span className="evidence-date">{date(e.created_at)}</span>
              <div>
                <p>{e.description}</p>
                <span className="small quiet">
                  {e.skill} ·{" "}
                  {e.provenance === "participation_only"
                    ? "participação registrada, domínio não avaliado"
                    : e.provenance}
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
// As três chaves que o produto usa. `env` aparece na tela porque continuar
// aceitando `.env.local` é parte do contrato: quem já tem uma instalação
// funcionando não precisa recadastrar nada, e precisa conseguir ver de onde a
// chave em uso está vindo.
const integrationProviders = [
  {
    id: "gemini" as const,
    label: "Gemini",
    role: "Transcrição de vídeo por URL, feedback de fala e texto, quando selecionado.",
    env: "GEMINI_API_KEY",
    where: "Google AI Studio",
    url: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai" as const,
    label: "OpenAI",
    role: "Tutor, atividades e apoio de trecho, quando selecionado como provedor de texto.",
    env: "OPENAI_API_KEY",
    where: "Painel da OpenAI",
    url: "https://platform.openai.com/api-keys",
  },
  {
    id: "youtube" as const,
    label: "YouTube Data API",
    role: "Título, autor e duração oficiais do vídeo. O player em iframe funciona sem chave.",
    env: "YOUTUBE_API_KEY",
    where: "Google Cloud Console",
    url: "https://console.cloud.google.com/apis/credentials",
  },
];
function IntegrationRow({
  provider,
}: {
  provider: (typeof integrationProviders)[number];
}) {
  const { data, run, refresh, notify, busy } = useApp();
  const [value, setValue] = useState("");
  const state = data.integrations.keys[provider.id];
  const detail =
    provider.id === "youtube" ? null : data.integrations.detail[provider.id];
  // Chave presente não é integração pronta: o provedor de texto ainda depende
  // de preço revisado e de AI_ENABLED. Dizer só "não configurado" esconderia
  // qual dos três requisitos falta.
  const pending = [
    !state.configured && "cadastre a chave abaixo",
    detail && !detail.prices && "revise o preço do provedor no ambiente",
    detail && !data.integrations.enabled && "AI_ENABLED ainda está desligado",
  ].filter(Boolean) as string[];
  const ready = detail ? detail.ready : state.configured;
  return (
    <div>
      <div className="integration-head">
        <span>
          <strong>{provider.label}</strong>
          <small>{provider.role}</small>
        </span>
        <span className={`status ${ready ? "good" : ""}`}>
          {ready ? "Em uso" : state.configured ? "Chave salva" : "Sem chave"}
        </span>
      </div>
      <p className="integration-pending">
        {state.configured
          ? `Chave ${state.hint} · ${state.origin === "interface" ? "cadastrada aqui" : `lida de ${provider.env}`}`
          : `Nenhuma chave. Também é possível definir ${provider.env} no ambiente.`}
        {pending.length ? ` · Falta: ${pending.join("; ")}.` : ""}
      </p>
      <form
        className="key-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api(`integrations/${provider.id}`, "PUT", {
              key: value.trim(),
            });
            setValue("");
            await refresh();
            notify(`Chave salva: ${provider.label}.`);
          });
        }}
      >
        <label>
          {state.configured
            ? `Substituir a chave · ${provider.label}`
            : `Chave de API · ${provider.label}`}
          <input
            type="password"
            value={value}
            autoComplete="off"
            spellCheck={false}
            placeholder={state.configured ? state.hint! : "Cole a chave aqui"}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <div className="key-actions">
          <button
            className="secondary"
            disabled={busy || value.trim().length < 16}
          >
            Salvar chave <Check size={15} />
          </button>
          <a
            className="text-link"
            href={provider.url}
            target="_blank"
            rel="noreferrer"
          >
            {provider.where} <ExternalLink size={14} />
          </a>
          {state.origin === "interface" && (
            <button
              type="button"
              className="text-button danger-text"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`integrations/${provider.id}`, "DELETE");
                  await refresh();
                  notify(`Chave removida: ${provider.label}.`);
                })
              }
            >
              Remover chave salva
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
export function Preferences() {
  const { data, run, refresh, notify, busy } = useApp(),
    router = useRouter();
  const [limit, setLimit] = useState(data.usage.limit),
    [alert, setAlert] = useState(data.usage.alert),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState("");
  return (
    <div className="page settings-page">
      <PageHead
        title="Seu ritmo. Suas escolhas."
        subtitle="Preferências, uso de IA e seus dados em um só lugar."
      />
      <section className="settings-section">
        <div>
          <h2>Seu perfil</h2>
          <p className="quiet">
            {data.user.name}
            <br />
            {data.user.email}
          </p>
          <Link href="/onboarding" className="text-link">
            Ajustar objetivos e dificuldade <ArrowRight size={15} />
          </Link>
        </div>
        <div>
          <h3>Aparência</h3>
          <div className="theme-options">
            {[
              { id: "light", label: "Claro", Icon: Sun },
              { id: "dark", label: "Escuro", Icon: Moon },
              { id: "system", label: "Sistema", Icon: Monitor },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                className={data.profile.theme === id ? "selected" : ""}
                aria-pressed={data.profile.theme === id}
                onClick={() =>
                  void run(async () => {
                    await api("profile", "PATCH", { theme: id });
                    await refresh();
                  })
                }
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
          <p className="small quiet">
            O tema acompanha todos os espaços de estudo.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={data.profile.shortcutsEnabled}
              onChange={(e) =>
                void run(async () => {
                  await api("profile", "PATCH", {
                    shortcutsEnabled: e.target.checked,
                  });
                  await refresh();
                })
              }
            />
            <span>
              Atalhos na sala: R para repetir, T para tradução. Desativados
              enquanto você digita.
            </span>
          </label>
        </div>
      </section>
      <section className="settings-section costs">
        <div>
          <h2>Custo e uso</h2>
          <p className="quiet">
            {data.usage.period} · estimativa local por uso retornado pelo
            provedor.
          </p>
          <p className="small quiet">
            A conciliação com a fatura é uma etapa separada. Não há projeção
            mensal antes de existir histórico suficiente.
          </p>
        </div>
        <div className="cost-totals">
          <div>
            <span>Contabilizado por uso</span>
            <strong>{money(data.usage.confirmed)}</strong>
          </div>
          <div>
            <span>Reservado agora</span>
            <strong>{money(data.usage.reserved)}</strong>
          </div>
          <div>
            <span>Limite de bloqueio</span>
            <strong>{money(data.usage.limit)}</strong>
          </div>
        </div>
        <div className="cost-detail">
          {data.usage.confirmed + data.usage.reserved >= data.usage.alert && (
            <p className="notice" role="status">
              {data.usage.confirmed + data.usage.reserved >= data.usage.limit
                ? "Limite mensal atingido. Novas chamadas de IA estão bloqueadas."
                : "Seu uso e suas reservas atingiram o alerta mensal. Confira os custos antes de continuar usando IA."}
            </p>
          )}
          {data.usage.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Finalidade</th>
                    <th>Modelo</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Estimativa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usage.rows.map((row) => (
                    <tr key={row.purpose + row.model}>
                      <td>{row.purpose}</td>
                      <td>{row.model}</td>
                      <td>{row.input_tokens}</td>
                      <td>{row.output_tokens}</td>
                      <td>{money(Number(row.micros) / 1e6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice">
              Nenhuma chamada de IA registrada. Gravar, estudar material pronto
              e revisar não consome tokens.
            </p>
          )}
        </div>
        <form
          className="budget-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("profile", "PATCH", {
                monthlyLimitCents: Math.round(limit * 100),
                alertCents: Math.round(alert * 100),
              });
              await refresh();
              notify("Limites atualizados.");
            });
          }}
        >
          <label>
            Alerta interno (US$)
            <input
              type="number"
              min="0"
              max={limit}
              step="1"
              value={alert}
              onChange={(e) => setAlert(Number(e.target.value))}
            />
          </label>
          <label>
            Limite mensal (US$)
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </label>
          <button className="secondary" disabled={busy}>
            Salvar limites <Check size={15} />
          </button>
          <p className="small quiet">
            Ao atingir o limite, novas chamadas são bloqueadas. Biblioteca e
            revisão continuam disponíveis.
          </p>
        </form>
      </section>
      <section className="settings-section">
        <div>
          <h2>Integrações</h2>
          <p className="quiet">
            Cadastre aqui as chaves de API. Elas ficam cifradas no seu banco
            local, nunca voltam pela interface e valem para o servidor e para o
            worker sem reiniciar nada.
          </p>
        </div>
        <div className="integration-list">
          {integrationProviders.map((provider) => (
            <IntegrationRow key={provider.id} provider={provider} />
          ))}
          <details>
            <summary>O que a chave sozinha ainda não liga</summary>
            <p>
              A chave é um dos três requisitos do provedor de texto. Os outros
              dois continuam no ambiente, de propósito, porque decidem gasto
              real: <code>AI_ENABLED=true</code> e a data de revisão de preço (
              <code>AI_PRICES_REVIEWED_ON</code> para o Gemini,{" "}
              <code>OPENAI_PRICES_REVIEWED_ON</code> para a OpenAI), que vence
              em 31 dias. <code>AI_TEXT_PROVIDER</code> escolhe qual dos dois
              atende texto — hoje, <code>{data.integrations.provider}</code>.
              Mudanças no <code>.env.local</code> exigem reiniciar web e worker;
              chaves cadastradas aqui, não.
            </p>
            <p>
              Nenhuma chave é testada ao ser salva: verificar custaria uma
              chamada real ao provedor. Consulte o guia de integrações do
              projeto antes de ativar chamadas pagas.
            </p>
          </details>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Seus dados, sob seu controle.</h2>
          <p className="quiet">
            Gravações expiram em 7 dias, salvo amostras preservadas. Conversas
            expiram em 30 dias.
          </p>
        </div>
        <div className="data-actions">
          <a className="button secondary" href="/api/account/export" download>
            <Download size={17} /> Exportar meus dados
          </a>
          <p className="small quiet">
            O JSON inclui seu histórico e texto próprio. Áudios podem ser
            baixados pelos controles de cada gravação. Transcrições integrais de
            terceiros não entram na exportação.
          </p>
          <button
            className="text-button danger-text"
            onClick={() => setDeleting(!deleting)}
          >
            Excluir minha conta e dados
          </button>
          {deleting && (
            <form
              className="delete-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("account", "DELETE", { confirm });
                  await refresh();
                  router.push("/");
                });
              }}
            >
              <p>
                Esta ação remove sua biblioteca, gravações e progresso. Backups
                locais podem permanecer por até 30 dias.
              </p>
              <label>
                Digite EXCLUIR para confirmar
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  pattern="EXCLUIR"
                />
              </label>
              <button
                className="danger primary"
                disabled={busy || confirm !== "EXCLUIR"}
              >
                Excluir permanentemente
              </button>
            </form>
          )}
        </div>
      </section>
      <button
        className="secondary"
        onClick={() =>
          void run(async () => {
            await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            await refresh();
            router.push("/");
          })
        }
      >
        <LogOut size={16} /> Sair da conta
      </button>
    </div>
  );
}
export function Onboarding() {
  const { data, run, refresh, notify, busy } = useApp(),
    router = useRouter();
  const [goal, setGoal] = useState(data.profile.goal),
    [interests, setInterests] = useState(data.profile.interests),
    [difficulty, setDifficulty] = useState(data.profile.difficulty),
    [weekly, setWeekly] = useState(data.profile.weeklyGoal),
    [duration, setDuration] = useState(data.profile.sessionMinutes),
    [variant, setVariant] = useState(data.profile.englishVariant),
    [diagnostic, setDiagnostic] = useState(""),
    [result, setResult] = useState("");
  const options = [
    "Backend",
    "Code review",
    "Arquitetura",
    "Entrevistas",
    "Frontend",
    "Viagens",
    "Cinema",
    "Ciência",
    "Ciclismo",
    "Música",
  ];
  return (
    <div className="page onboarding">
      <PageHead
        title="Uma jornada com a sua cara."
        subtitle="Ajuste o ponto de partida. Você pode mudar tudo depois."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("profile", "PATCH", {
              goal,
              interests,
              difficulty,
              weeklyGoal: weekly,
              sessionMinutes: duration,
              englishVariant: variant,
              onboarded: true,
            });
            await refresh();
            notify("Seu espaço de estudo foi ajustado.");
            router.push("/");
          });
        }}
      >
        <div className="onboarding-grid">
          <section>
            <h2>O que você quer conseguir dizer?</h2>
            <label>
              Seu objetivo
              <input
                required
                maxLength={300}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <h2>Assuntos que despertam sua curiosidade</h2>
            <div className="interest-options">
              {options.map((option) => (
                <button
                  type="button"
                  key={option}
                  aria-pressed={interests.includes(option)}
                  className={interests.includes(option) ? "selected" : ""}
                  onClick={() =>
                    setInterests(
                      interests.includes(option)
                        ? interests.filter((i) => i !== option)
                        : [...interests, option],
                    )
                  }
                >
                  {interests.includes(option) && <Check size={14} />} {option}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Sessões por semana
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={weekly}
                  onChange={(e) => setWeekly(Number(e.target.value))}
                />
              </label>
              <label>
                Tempo por sessão
                <select
                  value={duration}
                  onChange={(e) =>
                    setDuration(Number(e.target.value) as 10 | 25 | 45)
                  }
                >
                  <option value="10">10 minutos</option>
                  <option value="25">25 minutos</option>
                  <option value="45">45 minutos</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Dificuldade que quer experimentar
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  {["A1", "A2", "B1", "B2", "C1"].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label>
                Variedade preferida
                <select
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                >
                  <option value="en-US">Inglês americano</option>
                  <option value="en-GB">Inglês britânico</option>
                </select>
              </label>
            </div>
            <p className="small quiet">
              Dificuldade escolhida por você. Não é um resultado de diagnóstico.
            </p>
          </section>
          <aside className="diagnostic">
            <h2>Um pequeno ponto de partida</h2>
            <p className="quiet">
              Uma tarefa opcional de leitura. Sem nota de fluência.
            </p>
            <blockquote lang="en">
              “I’ll run the test with one worker to narrow down the cause.”
            </blockquote>
            <label>
              Qual é a intenção de usar um worker?
              <select
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
              >
                <option value="">Escolha uma resposta</option>
                <option value="isolate">Isolar a causa do problema</option>
                <option value="delete">Excluir o teste que falhou</option>
                <option value="deploy">
                  Publicar a correção imediatamente
                </option>
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!diagnostic || busy}
              onClick={() =>
                void run(async () => {
                  const r = await api<{ readingCorrect: boolean }>(
                    "diagnostic",
                    "POST",
                    { answer: diagnostic },
                  );
                  setResult(
                    r.readingCorrect
                      ? "Você identificou a intenção corretamente. Uma questão ainda não determina seu nível."
                      : "“Narrow down” significa reduzir as possibilidades para identificar a causa. Experimente a expressão em outro contexto.",
                  );
                  await refresh();
                })
              }
            >
              Conferir compreensão
            </button>
            {result && <p className="notice">{result}</p>}
            <div className="diagnostic-status">
              <span>
                <BookOpen size={17} /> Compreensão
              </span>
              <strong>Sem estimativa de nível</strong>
              <span>
                <Mic size={17} /> Expressão oral
              </span>
              <strong>Ainda não avaliada</strong>
            </div>
            <p className="small quiet">
              Você pode gravar uma apresentação em Praticar. O microfone é
              opcional.
            </p>
          </aside>
        </div>
        <div className="onboarding-footer">
          <span className="quiet">
            Explicações em português. Prática em inglês.
          </span>
          <button className="primary" disabled={busy}>
            Salvar e começar <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

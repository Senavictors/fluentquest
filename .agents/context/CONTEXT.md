# Contexto Atual do Projeto — FluentQuest

Última atualização: 2026-09-17

## Estado atual

Aplicativo pessoal de inglês para desenvolvedores, local-first e de proprietário único, rodando em `127.0.0.1:3215` (web + worker via `npm run dev`). O MVP local está **completo e verde**: `tsc --noEmit` sem erros, 35/35 testes automatizados, 30/30 cenários de integração sem nenhuma chamada externa, `next build` compilando 4 rotas, e zero violações de acessibilidade/overflow no QA desktop e mobile.

Pilotos reais de texto concluídos em 15/09/2026 com autorização explícita: Gemini 3.5 Flash-Lite e OpenAI `gpt-4o-mini` estão configurados localmente, com preços revisados e teto US$ 1/alerta US$ 0,80. O piloto Gemini conciliou US$ 0,001288; o piloto OpenAI na mesma fonte conciliou US$ 0,000386 (atividade e tutor, com `price_version=openai:2026-09-15`). AI Studio mostra tier gratuito sem faturamento. YouTube Data API v3 usa chave separada e validada: `videos.list` retornou 200 e salvou os metadados oficiais. A transcrição direta por URL **funciona desde 16/09/2026**: um vídeo de 13 min 57 s produziu 78 trechos reais, dentro da duração, marcados `approximate`/`ai_unreviewed`, com reserva `settled`. Os HTTP 500/503 "high demand" atribuídos antes a indisponibilidade do provedor eram sintoma de três defeitos nossos, corrigidos em TASK-004: `processing: "agentic"` num modelo que não o sustenta, `minItems`/`maxItems` vazando para o schema de saída estruturada (que o Gemini recusa com 400), e drift de tempo do provedor tratado como erro fatal. Detalhe e evidência na seção "Desbloqueio — 2026-09-16" de TASK-004. O fluxo de legenda fornecida do vídeo `fwe81ITBSfI` carregou 53 trechos e gerou atividades pelos dois provedores de texto.

Repositório Git inicializado no bootstrap desta arquitetura (branch `main`), com identidade local `Senavictors <victorsena760@gmail.com>`. Antes disso o projeto vivia sem controle de versão.

## Iniciativas ativas

TASK-001 está em active: o piloto Gemini de texto foi concluído; voz e avaliação humana continuam pendentes. TASK-002, TASK-003, TASK-005 e TASK-008 estão concluídas. TASK-004 voltou a `active` (era `blocked`): a transcrição real foi obtida em 16/09; falta medição de custo com faturamento ativo e revisão humana do texto. TASK-006 e TASK-007 estão em active: abstração multi-provedor e adaptador OpenAI de texto foram implementados e tiveram piloto real; faltam apenas juízo humano comparativo e conciliação com o painel OpenAI. TASK-009 está em active: piso de cobertura e falha de validação honesta implementados e verdes; falta uma transcrição real que confirme o piso contra uma resposta completa.

Validação de 15/09: typecheck e build passaram; 35 testes automatizados e 30 cenários de integração. QA isolado confirmou legenda, opção Gemini desabilitada sem IA, proveniência automática e quatro variantes 1440/390 claro/escuro sem violações axe ou overflow. Consulte [VALIDACAO.md](../../docs/VALIDACAO.md) via raiz do projeto.

Em 16/09 o apoio de trecho da sala de estudo deixou de reaproveitar o tutor. A rota `POST /api/segments/:id/translate` chamava `explain()`, cujo prompt sempre anexa "explain one point, give one new example and ask for one original sentence" — por isso um pedido de tradução voltava como miniaula em Markdown, renderizada como texto cru num parágrafo único. Agora existe `SegmentSupporter` com saída estruturada (`segmentSupport`: tradução, ponto, exemplo, pergunta), migração 005 (`segments.support jsonb`) e um painel hierarquizado. Trechos apoiados antes da migração continuam sendo devolvidos como `legacyText`.

Ainda em 16/09, a sala de estudo passou de documento rolável a área de trabalho de altura fixa. Antes, ler a transcrição empurrava o vídeo para fora da tela — e a tarefa é justamente ouvir e ler ao mesmo tempo. Agora a altura é derivada por flex (nunca por `calc()`: o cabeçalho varia entre 198px e 355px conforme título e avisos), cada região rola por si, e a partir de 1240px o vídeo fica ao lado da transcrição. Abaixo de 1000px a página volta a rolar com o vídeo fixo no topo. A barra lateral ganhou recolhimento para trilho de 64px (`localStorage` `fq-rail`), o que devolve 144px à transcrição.

Em 17/09 a conferência de uma transcrição real expôs dois defeitos e abriu TASK-009. O vídeo `Xli-93vkN-s` (837 s) voltou com **5 trechos cobrindo 111 s (13%)** e mesmo assim virou fonte `text_ready`: nada verificava cobertura — `videoTranscript` aceita um trecho e `fitTranscriptToDuration` só recusa tempo acima da duração. Na tentativa anterior, do mesmo minuto, o Gemini respondeu com 4.404 tokens de saída, `settleBudget` conciliou e só então o `schema.parse` falhou; como `ZodError` não é `AppError`, virou `PROVIDER_UNAVAILABLE` — uma transcrição inteira paga, descartada sem registro e diagnosticada como indisponibilidade do provedor. Agora existem `assertTranscriptCoverage()` (piso de 80%, erro `INCOMPLETE_TRANSCRIPT`) e `parseProviderOutput()` (erro `INVALID_PROVIDER_OUTPUT`, texto bruto em `AI_INVALID_OUTPUT`), e transcrição de vídeo deixou de usar `result_cache`, senão a resposta recusada ficaria presa na chave e a nova tentativa nunca chamaria o provedor.

## Arquitetura vigente

Next.js 16 (App Router, Turbopack) + React 19; domínio puro em `src/domain/` (`content.ts`, `review.ts`) sem conhecer HTTP ou banco; servidor em `src/server/` sobre PostgreSQL 18 + Drizzle; fila `pg-boss` no worker `src/worker.ts`; Better Auth com origem restrita a `BETTER_AUTH_URL`; agendamento por `ts-fsrs`. Detalhe em `docs/architecture/` e nos papéis em `.claude/agents/`.

## Restrições importantes

- Aplicação escuta somente em loopback; nada é publicado para a rede.
- `src/domain/` é puro — não importa `pg`, `next` nem nada de `src/server/`.
- Schema só muda por migração nova em `migrations/`; migração já aplicada nunca é editada.
- Arquivos do proprietário vivem em `data/objects/` e nunca são servidos como pasta pública.
- Cadastro pela interface é desabilitado; existe um único proprietário (`scripts/owner.ts` recusa criar um segundo).

## Dívida técnica conhecida

- **Documentação de validação resolvida:** `docs/VALIDACAO.md` agora registra evidências atuais e pendências por task.
- **Cobertura:** `tests/providers.test.ts` cobre contratos Gemini/OpenAI com mocks; integração cobre banco e worker. Texto teve pilotos reais; vídeo depende da recuperação do endpoint Gemini e qualidade pedagógica continua sem avaliação humana.
- **Sem script de lint**: Prettier está instalado como devDependency, mas não há `npm run lint`.
- **Backup manual**: `docs/OPERACAO.md` registra que nenhuma tarefa agendada do Windows foi criada. Existe um backup de 2026-09-14T22:00.
- **Mobile só emulado**: microfone e codecs verificados em 390×844 por emulação; nunca em aparelho físico.

## Decisões recentes

**ADR-001** (2026-09-14, `accepted`) — ativação da camada de IA em três fases, com Gemini no tier gratuito e OpenAI como provedor de texto alternativo. Decidiu também habilitar transcrição de vídeo por URL (o provedor processa; o servidor não baixa mídia) e generalizar a abstração de preço. O limite operacional vigente do piloto é US$ 1/mês. No tier gratuito Gemini **não há fatura**, então o teto vira freio de uso; em OpenAI, a conciliação externa ainda precisa ser feita no painel. Índice em `.agents/decisions/README.md`. As decisões de produto anteriores ao bootstrap estão em `PRODUCT.md` e `docs/INTEGRACOES.md`.

## Riscos atuais

- **Qualidade da transcrição automática não revisada** (impacto médio): na transcrição de 16/09, 9 dos 78 trechos são repetição de um bloco anterior — o modelo repetiu uma seção. Os tempos são reescalados por `fitTranscriptToDuration()` assumindo drift linear, hipótese sem ground truth para o meio do vídeo. Mitigação: trechos ficam `ai_unreviewed` e `approximate`; revisão humana antes de virar cartão.
- **Truncamento do modelo é intermitente** (impacto médio): em 17/09 o mesmo modelo devolveu 13% do vídeo em 6 s, com 70.660 tokens de vídeo servidos do cache implícito do Gemini. O piso de TASK-009 recusa o resultado, mas não impede a chamada nem o custo. Mitigação: teto de US$ 1 e mensagem que informa a cobertura medida.
- **Falso positivo do piso de cobertura** (impacto baixo): vídeo com encerramento longo sem fala pode ficar abaixo de 80% e ser recusado depois de a chamada já ter sido paga. Mitigação: a mensagem informa quanto foi coberto, e `MIN_TRANSCRIPT_COVERAGE` é uma constante única em `src/domain/content.ts`.
- **Custo por minuto de vídeo ainda não medido em conta paga** (impacto baixo): a conta Gemini está em nível gratuito, então a reserva `settled` de US$ 0,058 é contador interno, não fatura. Mitigação: manter teto de US$ 1 e conciliar quando o faturamento for ativado.
- **Piloto de voz e avaliação humana pendentes** (impacto médio): latência e qualidade do caminho de fala continuam sem medição.
- **Revisão de preço vence em 31 dias** (impacto: bloqueio de chamadas): `AI_PRICES_REVIEWED_ON=2026-09-15`; ao ativar a IA, o vencimento passa a bloquear novas chamadas até atualização.
- **Perda de dados de estudo** (impacto alto): o banco `fluentquest` guarda cartões, gravações e histórico; backup é manual.

## Não fazer agora

- Enviar voz sem consentimento, elevar o teto inicial de US$ 1 ou repetir automaticamente a transcrição de vídeo. IA e o piloto de vídeo foram autorizados nesta sessão.
- Trocar o modelo Gemini configurado (Flash-Lite, thinking minimal) sem revisar preço, modalidades e regressão.
- Introduzir scraping, download de vídeo do YouTube, publicação, pagamentos, Live ou avatar 3D — estão fora do escopo declarado em `PRODUCT.md`.
- Mover os documentos já existentes na raiz de `docs/` (`API.md`, `INTEGRACOES.md`, `OPERACAO.md`, `PRODUTO_ORIGINAL.md`) sem aprovação.

# Contexto Atual do Projeto — FluentQuest

Última atualização: 2026-09-15

## Estado atual

Aplicativo pessoal de inglês para desenvolvedores, local-first e de proprietário único, rodando em `127.0.0.1:3215` (web + worker via `npm run dev`). O MVP local está **completo e verde**: `tsc --noEmit` sem erros, 35/35 testes automatizados, 30/30 cenários de integração sem nenhuma chamada externa, `next build` compilando 4 rotas, e zero violações de acessibilidade/overflow no QA desktop e mobile.

Pilotos reais de texto concluídos em 15/09/2026 com autorização explícita: Gemini 3.5 Flash-Lite e OpenAI `gpt-4o-mini` estão configurados localmente, com preços revisados e teto US$ 1/alerta US$ 0,80. O piloto Gemini conciliou US$ 0,001288; o piloto OpenAI na mesma fonte conciliou US$ 0,000386 (atividade e tutor, com `price_version=openai:2026-09-15`). AI Studio mostra tier gratuito sem faturamento. YouTube Data API v3 usa chave separada e validada: `videos.list` retornou 200 e salvou os metadados oficiais. A transcrição direta por URL foi implementada com Interactions e alcançou o Gemini com o vídeo de 8 min 15 s, mas as inferências válidas retornaram HTTP 500/503 por alta demanda. Zero segmentos parciais; reservas 5xx permanecem `unknown` para conciliação. O fluxo de legenda fornecida do vídeo `fwe81ITBSfI` carregou 53 trechos e gerou atividades pelos dois provedores de texto.

Repositório Git inicializado no bootstrap desta arquitetura (branch `main`), com identidade local `Senavictors <victorsena760@gmail.com>`. Antes disso o projeto vivia sem controle de versão.

## Iniciativas ativas

TASK-001 está em active: o piloto Gemini de texto foi concluído; voz e avaliação humana continuam pendentes. TASK-002, TASK-003, TASK-005 e TASK-008 estão concluídas. TASK-004 está `blocked` dentro de `active/`: faltam somente transcrição real e medição de custo, impedidas pelo HTTP 503 do provedor. TASK-006 e TASK-007 estão em active: abstração multi-provedor e adaptador OpenAI de texto foram implementados e tiveram piloto real; faltam apenas juízo humano comparativo e conciliação com o painel OpenAI.

Validação de 15/09: typecheck e build passaram; 35 testes automatizados e 30 cenários de integração. QA isolado confirmou legenda, opção Gemini desabilitada sem IA, proveniência automática e quatro variantes 1440/390 claro/escuro sem violações axe ou overflow. Consulte [VALIDACAO.md](../../docs/VALIDACAO.md) via raiz do projeto.

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

- **Transcrição direta de vídeo e piloto de voz/revisão humana pendentes** (impacto médio): o endpoint de vídeo do Gemini esteve indisponível por alta demanda; latência, custo por minuto e qualidade da transcrição direta não foram medidos. Mitigação: legenda fornecida mantém o estudo funcional; nova tentativa consciente após o disjuntor, mantendo teto de US$ 1 e sem retries automáticos.
- **Revisão de preço vence em 31 dias** (impacto: bloqueio de chamadas): `AI_PRICES_REVIEWED_ON=2026-09-15`; ao ativar a IA, o vencimento passa a bloquear novas chamadas até atualização.
- **Perda de dados de estudo** (impacto alto): o banco `fluentquest` guarda cartões, gravações e histórico; backup é manual.

## Não fazer agora

- Enviar voz sem consentimento, elevar o teto inicial de US$ 1 ou repetir automaticamente a transcrição de vídeo. IA e o piloto de vídeo foram autorizados nesta sessão.
- Trocar o modelo Gemini configurado (Flash-Lite, thinking minimal) sem revisar preço, modalidades e regressão.
- Introduzir scraping, download de vídeo do YouTube, publicação, pagamentos, Live ou avatar 3D — estão fora do escopo declarado em `PRODUCT.md`.
- Mover os documentos já existentes na raiz de `docs/` (`API.md`, `INTEGRACOES.md`, `OPERACAO.md`, `PRODUTO_ORIGINAL.md`) sem aprovação.

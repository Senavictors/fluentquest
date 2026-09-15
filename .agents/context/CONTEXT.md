# Contexto Atual do Projeto — FluentQuest

Última atualização: 2026-09-14

## Estado atual

Aplicativo pessoal de inglês para desenvolvedores, local-first e de proprietário único, rodando em `127.0.0.1:3215` (web + worker via `npm run dev`). O MVP offline está **completo e verde**: `tsc --noEmit` sem erros, 11/11 testes unitários, 23/23 cenários de integração sem nenhuma chamada de IA, `next build` compilando 4 rotas, e 0 violações de acessibilidade (axe) em 9 telas.

O que ainda não foi exercitado é a camada de IA: os adaptadores Gemini existem e passam por tipos e contratos, mas nunca fizeram uma chamada paga. Tutor, tradução automática, geração de atividades e feedback de fala respondem "integração não configurada" enquanto `AI_ENABLED=false`.

Repositório Git inicializado no bootstrap desta arquitetura (branch `main`), com identidade local `Senavictors <victorsena760@gmail.com>`. Antes disso o projeto vivia sem controle de versão.

## Iniciativas ativas

Nenhuma task ativa. Sete tasks planejadas em `.agents/tasks/backlog/` (TASK-001 a TASK-007), derivadas de ADR-001 — ativação da camada de IA em três fases. A ordem é obrigatória: Fase A (TASK-001, TASK-002) → Fase B (TASK-003, TASK-004, TASK-005) → Fase C (TASK-006, TASK-007). Nenhuma chamada paga foi feita ainda; TASK-001 é a primeira.

## Arquitetura vigente

Next.js 16 (App Router, Turbopack) + React 19; domínio puro em `src/domain/` (`content.ts`, `review.ts`) sem conhecer HTTP ou banco; servidor em `src/server/` sobre PostgreSQL 18 + Drizzle; fila `pg-boss` no worker `src/worker.ts`; Better Auth com origem restrita a `BETTER_AUTH_URL`; agendamento por `ts-fsrs`. Detalhe em `docs/architecture/` e nos papéis em `.claude/agents/`.

## Restrições importantes

- Aplicação escuta somente em loopback; nada é publicado para a rede.
- `src/domain/` é puro — não importa `pg`, `next` nem nada de `src/server/`.
- Schema só muda por migração nova em `migrations/`; migração já aplicada nunca é editada.
- Arquivos do proprietário vivem em `data/objects/` e nunca são servidos como pasta pública.
- Cadastro pela interface é desabilitado; existe um único proprietário (`scripts/owner.ts` recusa criar um segundo).

## Dívida técnica conhecida

- **`docs/VALIDACAO.md` não existe** embora o `README.md` o cite duas vezes como fonte das evidências e limites de validação. Único link quebrado da documentação.
- **Cobertura unitária estreita**: `tests/domain.test.ts` cobre fontes, FSRS e orçamento; os 11 módulos de `src/server/` são cobertos apenas pelo `scripts/integration.ts`.
- **Sem script de lint**: Prettier está instalado como devDependency, mas não há `npm run lint`.
- **Backup manual**: `docs/OPERACAO.md` registra que nenhuma tarefa agendada do Windows foi criada. Existe um backup de 2026-09-14T22:00.
- **Mobile só emulado**: microfone e codecs verificados em 390×844 por emulação; nunca em aparelho físico.

## Decisões recentes

**ADR-001** (2026-09-14, `accepted`) — ativação da camada de IA em três fases, com Gemini no tier gratuito e teto de US$ 10/mês. Decidiu também habilitar transcrição de vídeo por URL (o provedor processa; o servidor não baixa mídia) e adicionar a OpenAI como segundo provedor depois de generalizar a abstração de preço. Duas consequências que valem para qualquer sessão futura: no tier gratuito **não há fatura**, então o teto vira freio de uso e não de gasto; e o conteúdo enviado pode ser usado pelo provedor para treino — risco aceito explicitamente pelo proprietário. Índice em `.agents/decisions/README.md`. As decisões de produto anteriores ao bootstrap estão em `PRODUCT.md` e `docs/INTEGRACOES.md`.

## Riscos atuais

- **Piloto de IA não executado** (alta probabilidade de surpresa, impacto médio): qualidade pedagógica, latência e custo real do Gemini são desconhecidos. Mitigação: seguir o piloto de 7 passos em `docs/INTEGRACOES.md`, começando com teto de US$ 1.
- **Revisão de preço vence em 31 dias** (impacto: bloqueio de chamadas): `AI_PRICES_REVIEWED_ON` vazio hoje; ao ativar a IA, o vencimento passa a bloquear novas chamadas até atualização.
- **Perda de dados de estudo** (impacto alto): o banco `fluentquest` guarda cartões, gravações e histórico; backup é manual.

## Não fazer agora

- Ativar `AI_ENABLED=true` sem executar o piloto de `docs/INTEGRACOES.md` e sem preencher os preços revisados.
- Trocar o modelo Gemini configurado (Flash-Lite, thinking minimal) sem revisar preço, modalidades e regressão.
- Introduzir scraping, download de vídeo do YouTube, publicação, pagamentos, Live ou avatar 3D — estão fora do escopo declarado em `PRODUCT.md`.
- Mover os documentos já existentes na raiz de `docs/` (`API.md`, `INTEGRACOES.md`, `OPERACAO.md`, `PRODUTO_ORIGINAL.md`) sem aprovação.

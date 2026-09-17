# Dados

Esta pasta faltava. O mapa de `docs/README.md` sempre listou "Dados" como seção do núcleo, mas o arquivo nunca entrou no Git: a regra `data/` do `.gitignore` — escrita para proteger os arquivos do proprietário na raiz — não estava ancorada e engolia `docs/data/` junto. A regra virou `/data/` e `/data-restore/` na mesma correção que criou este arquivo.

PostgreSQL 18 com Drizzle por cima. O SQL versionado em `migrations/` é a fonte da verdade; `src/server/schema.ts` é espelho tipado e cobre só as tabelas acessadas pelo Drizzle (`learner_profiles` e `sources`) — todo o resto é consultado por SQL direto via `query`/`transaction` de `src/server/db.ts`.

## Como o schema muda

Arquivo novo em `migrations/`, no padrão `NNN_descricao.sql`. `scripts/migrate.ts` (`npm run db:migrate`) aplica tudo dentro de um `BEGIN` único, protegido por `pg_advisory_xact_lock(843201)`, e registra cada arquivo em `fq_migrations`. Uma migração já registrada **nunca** é reaplicada — por isso editar uma migração aplicada não corrige nada, só cria divergência silenciosa entre o SQL e o banco real.

| Migração                                | O que trouxe                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_initial`                           | Autenticação (`user`, `session`, `account`, `verification`), perfil, fontes, trechos, cartões, revisões, XP, gravações, orçamento e controle (idempotência, rate limit, exclusão). |
| `002_learning_flow`                     | Sessões de estudo, unidades de aprendizagem, tentativas, evidências, desafio semanal, tutor e cache de resultado.                                                                  |
| `003_video_transcription`               | Modo de transcrição, provedor/modelo e marcas de revisão na fonte; proveniência e qualidade no trecho.                                                                             |
| `004_budget_reservation_provider_model` | Provedor e modelo na reserva de orçamento, para conciliar custo por provedor.                                                                                                      |
| `005_segment_support`                   | `segments.support jsonb` — apoio de trecho em quatro campos, em vez de texto corrido.                                                                                              |
| `006_reservation_reconciliation`        | `reconciled_at` e `reconciliation_note` — a saída da reserva ambígua (ADR-003).                                                                                                    |
| `007_integration_credentials`           | `integration_credentials` — chave de provedor cifrada, cadastrável pela interface (ADR-005).                                                                                       |

## Onde cada coisa mora

| Assunto                 | Tabelas                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Proprietário e sessão   | `user`, `session`, `account`, `verification`, `learner_profiles`                                           |
| Material de estudo      | `sources`, `segments`, `learning_units`                                                                    |
| Revisão e progresso     | `cards`, `review_events`, `attempts`, `skill_evidence`, `xp_events`, `weekly_challenges`, `study_sessions` |
| Fala e tutor            | `recordings`, `tutor_messages`                                                                             |
| Custo de IA             | `budget_reservations`, `usage_events`, `result_cache`                                                      |
| Credenciais de provedor | `integration_credentials`                                                                                  |
| Fila e controle         | `jobs`, `job_events`, `idempotency`, `rate_limits`, `deletion_requests`                                    |

## Regras que valem para qualquer escrita

1. **Escrita multi-tabela vai dentro de `transaction`.** A consistência entre `cards`, `review_events` e `xp_events` depende disso, e é o que sustenta o cenário "mesma revisão aplica FSRS e XP uma vez" de `scripts/integration.ts`.
2. **Toda consulta de domínio filtra por proprietário.** Não existe rota que devolva dado de outro usuário; o isolamento é verificado por integração.
3. **Exclusão de conta é `ON DELETE CASCADE` a partir de `"user"`**, com tombstone em `deletion_requests`. Qualquer tabela nova com dado do proprietário precisa dessa referência.
4. **Concorrência otimista em cartão** (`cards.version`): versão obsoleta recebe conflito em vez de sobrescrever.

## O que não fica no banco

Arquivos do proprietário (áudio de gravação, mídia própria) vivem em `data/objects/`, gravados por `src/server/storage.ts` e servidos apenas por rota autenticada — **nunca** como pasta pública. `removeUserObjects` limpa isso na exclusão de conta.

## Segredo em repouso

`integration_credentials` guarda a chave de cada provedor cifrada com AES-256-GCM, com chave derivada de `BETTER_AUTH_SECRET`. O motivo é o backup: `scripts/backup.ts` despeja o banco inteiro, e um dump com credencial em texto puro transforma cópia de segurança em vazamento. Só os quatro últimos caracteres (`hint`) são legíveis, e a tabela fica fora da allowlist de `GET /api/account/export`. Detalhes em [ADR-005](../../.agents/decisions/ADR-005-chaves-de-api-cifradas-no-banco.md).

## Backup e restauração

`npm run backup` e `npm run restore`, usando o `PG_BIN` de `.env.local`. Procedimento, periodicidade e a pendência de agendamento estão em [`../OPERACAO.md`](../OPERACAO.md) — não duplicados aqui.

## Quando criar um doc nesta pasta

Crie `docs/data/<assunto>.md` (com frontmatter de estado) quando uma decisão de modelagem precisar de histórico que a migração sozinha não conta: motivo de uma desnormalização, estratégia de retenção, ou o racional de um índice. Mudança de schema com impacto em contrato público exige também ADR em `.agents/decisions/` e atualização de [`../API.md`](../API.md).

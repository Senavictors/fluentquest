# Módulos

Índice das áreas funcionais do FluentQuest. **Os documentos individuais por módulo nascem sob demanda**, quando uma task tocar aquela área — não foram criados no bootstrap para não encher a pasta de descrição especulativa.

## Áreas existentes hoje

| Módulo | Responsabilidade | Código principal |
|---|---|---|
| **Onboarding e perfil** | Diagnóstico inicial sem estimativa CEFR, metas, idioma, fuso, tema e atalhos. | `src/client/Settings.tsx`, `learner_profiles` |
| **Biblioteca e ingestão** | Adicionar URL, texto, legenda ou mídia própria; validar direitos; preparar a fonte. | `src/client/Study.tsx`, `src/domain/content.ts`, `src/server/media.ts` |
| **Sala de estudo** | Leitura segmentada, player oficial, retomada de posição, modo imersão, tradução editorial do exemplo. | `src/client/Study.tsx`, `src/server/example.ts` |
| **Produção e prática** | Atividades independentes, tentativa escrita ou falada, gravação com consentimento e descarte. | `src/client/Practice.tsx`, `attempts`, `recordings` |
| **Revisão espaçada** | Fila devida, nota 1–4, agendamento FSRS, correção da última resposta. | `src/domain/review.ts`, `cards`, `review_events` |
| **Jornada e recompensa** | XP, nível, histórico e desafio semanal com recompensa única. | `xp_events`, `weekly_challenges` |
| **Orçamento e integrações** | Estado dos provedores, reserva, conciliação e limite mensal. | `src/server/budget.ts`, `src/server/providers.ts` |
| **Conta e dados** | Exportação sem credenciais, exclusão com revogação de sessão e tombstone. | `src/server/api.ts`, `deletion_requests`, `src/worker.ts` |

## Como criar o documento de um módulo

Quando uma task tocar uma dessas áreas, crie `docs/modules/<modulo>.md` com o frontmatter de estado descrito em [`../README.md`](../README.md) e registre: responsabilidade, entradas e saídas, regras de negócio verificadas, tabelas envolvidas e cenários de teste que sustentam o comportamento. `bootstrap-complete` carimba a `ultima-revisao` ao concluir a task.

# Índice de Decisões (ADRs) — FluentQuest

Mantido automaticamente por `bootstrap-audit` a cada execução — não edite esta tabela manualmente, edite os ADRs individuais. Se `bootstrap-audit` ainda não rodou desde a última decisão adicionada, esta tabela pode estar desatualizada.

| ID      | Título                                                                                                | Status   | Data       | Arquivo                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | Ativação da camada de IA em três fases, com Gemini no tier gratuito                                   | accepted | 2026-09-14 | [ADR-001-ativacao-camada-ia.md](ADR-001-ativacao-camada-ia.md)                                                               |
| ADR-002 | OpenAI limitada a inferências textuais com uso auditável                                              | accepted | 2026-09-15 | [ADR-002-openai-texto-com-uso-auditavel.md](ADR-002-openai-texto-com-uso-auditavel.md)                                       |
| ADR-003 | Conciliação manual de reserva ambígua, com estado próprio no livro-razão                              | accepted | 2026-09-17 | [ADR-003-conciliacao-manual-de-reserva-ambigua.md](ADR-003-conciliacao-manual-de-reserva-ambigua.md)                         |
| ADR-004 | Legenda de vídeo público tem proveniência própria, em vez de se disfarçar de material do proprietário | accepted | 2026-09-17 | [ADR-004-legenda-de-video-publico-com-proveniencia-propria.md](ADR-004-legenda-de-video-publico-com-proveniencia-propria.md) |
| ADR-005 | Chaves de provedor cadastráveis pela interface, cifradas no banco, com o ambiente como fallback       | accepted | 2026-09-17 | [ADR-005-chaves-de-api-cifradas-no-banco.md](ADR-005-chaves-de-api-cifradas-no-banco.md)                                     |
| ADR-006 | O idioma de estudo é propriedade da fonte, não do perfil; o perfil guarda só a língua de explicação   | accepted | 2026-09-17 | [ADR-006-idioma-de-estudo-vem-da-fonte.md](ADR-006-idioma-de-estudo-vem-da-fonte.md)                                         |

<!-- bootstrap-audit preenche uma linha por arquivo em .agents/decisions/*.md, lendo o frontmatter (id, title, status, date). Não remova este comentário — é o marcador de onde a regeneração insere as linhas. -->

## Status possíveis

- `proposed` — decisão registrada, ainda não confirmada em execução.
- `accepted` — decisão vigente, deve ser respeitada por qualquer papel/ferramenta.
- `superseded` — substituída por uma decisão mais recente (referenciar o ID novo).
- `deprecated` — não vale mais, mantida só para histórico.

# Arquitetura

Visão estrutural do FluentQuest: um aplicativo local de proprietário único, composto por dois processos Node (web Next.js e worker de fila) sobre um PostgreSQL 18 local, sem nuvem, proxy ou orquestrador.

A característica arquitetural que mais influencia decisões aqui é a **honestidade de estado**: o sistema prefere declarar "integração não configurada", "tempo aproximado" ou "sem medição de uso" a apresentar um resultado plausível. Isso aparece no domínio (proveniência de segmentos), no servidor (reserva de orçamento antes da inferência) e na interface (nenhuma métrica inventada).

## Documentos

- [`context.md`](context.md) — propósito, atores, fronteiras e integrações externas
- [`containers.md`](containers.md) — os dois processos, o banco e como se comunicam
- [`components.md`](components.md) — componentes internos por camada
- [`dependencies.md`](dependencies.md) — direção de dependência permitida e proibida
- [`deployment.md`](deployment.md) — topologia real, portas, variáveis de ambiente e boot

Diagramas visuais complementares: [`../diagrams/`](../diagrams/README.md).

## Decisões estruturais vigentes

| Decisão | Onde se vê no código |
|---|---|
| Domínio puro, isolado de HTTP e banco | `src/domain/` não importa `pg` nem Next |
| Fila no próprio PostgreSQL, sem broker | `pg-boss` em `src/server/queue.ts` |
| Schema só por migração SQL versionada | `migrations/`, aplicadas por `scripts/migrate.ts` |
| Arquivos privados fora de pasta pública | `src/server/storage.ts` sobre `data/objects/` |
| Custo reservado antes da inferência | `reserveBudget` em `src/server/budget.ts` |
| Escuta apenas em loopback | `--hostname 127.0.0.1` nos scripts `dev` e `start` |

Decisões novas que mudem qualquer linha desta tabela precisam de um ADR em `.agents/decisions/`.

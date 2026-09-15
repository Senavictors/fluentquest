# Diagramas

Diagramas em Mermaid, versionados como texto para que a diferença entre versões seja legível em revisão. Um diagrama complementa a prosa de [`../architecture/`](../architecture/README.md) — quando os dois discordarem, a prosa e o código vencem, e o diagrama é corrigido ou marcado como divergente.

## Visão de containers

```mermaid
flowchart LR
    O(["Proprietário"]) --> B["Navegador<br/>localhost:3215"]
    B --> W["Aplicação web<br/>Next.js 16 + React 19"]
    B -. iframe oficial .-> YT["YouTube player"]
    W --> DB[("PostgreSQL 18<br/>banco fluentquest")]
    W -- "enfileira (pg-boss)" --> DB
    K["Worker<br/>src/worker.ts"] --> DB
    K -. "só com AI_ENABLED=true" .-> G["Google Gemini"]
    W -. "só com AI_ENABLED=true" .-> G
    W --> FS[("data/objects/<br/>arquivos privados")]
```

## Ciclo de uma revisão

```mermaid
sequenceDiagram
    participant U as Proprietário
    participant C as src/client/App.tsx
    participant A as src/server/api.ts
    participant D as src/domain/review.ts
    participant P as PostgreSQL
    U->>C: recupera a expressão e escolhe a nota (1-4)
    C->>A: POST /api/reviews/:id/answer (nota + version)
    A->>P: SELECT cartão FOR UPDATE
    alt version obsoleta
        A-->>C: conflito — o cliente recarrega
    else version atual
        A->>D: scheduleCard(estado, nota)
        D-->>A: próximo estado e próxima data
        A->>P: transação: cards + review_events + xp_events
        Note over P: UNIQUE(user_id, origin_id, rule)<br/>garante XP único
        A-->>C: próxima revisão da fila
    end
```

## Custo de uma chamada de IA

```mermaid
stateDiagram-v2
    [*] --> Reservado: reserveBudget (máx. 2 ativas)
    Reservado --> Concluído: settleBudget + usage_events
    Reservado --> Falha: failBudget(ambiguous = false)
    Reservado --> Ambíguo: failBudget(ambiguous = true)
    Ambíguo --> [*]: valor permanece reservado<br/>sem repetição automática
    Concluído --> [*]
    Falha --> [*]
```

## Ao adicionar um diagrama

Use Mermaid em bloco de código, dentro de um arquivo desta pasta, com o frontmatter de estado descrito em [`../README.md`](../README.md). Não versione imagem exportada: ela envelhece sem deixar rastro no diff.

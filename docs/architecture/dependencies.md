---
estado: real
fonte: src/domain/ (ausência de imports de servidor), src/server/db.ts, tsconfig.json, package.json
ultima-revisao: 2026-09-14 (bootstrap-init)
---

# Dependências

Direção estrita de dependência entre camadas e containers.

## Servidor

```text
Entrada HTTP (api.ts, auth.ts)  →  Serviços (budget, providers, media, storage, queue)  →  Acesso a dados (db.ts, schema.ts)
                         ↘                    ↘
                              Núcleo puro (src/domain/)
```

- **Permitido**: qualquer camada superior usar `src/domain/` — ele é folha e não depende de ninguém do projeto.
- **Proibido**: `src/domain/` importar `src/server/`, `pg`, `next` ou qualquer coisa que exija banco ou requisição. Quebrar isso inviabiliza `tests/domain.test.ts`, que roda sem PostgreSQL.
- **Proibido**: duplicar regra de negócio entre `src/domain/` e `src/server/`. Se a regra é pura, o lugar dela é o domínio.
- **Proibido**: acessar o banco fora de `pool`/`query`/`transaction` de `src/server/db.ts`.
- **Proibido**: chamar provedor externo fora de `src/server/providers.ts`, e sem passar antes por `reserveBudget`.

## Interface

```text
Telas (App, Study, Practice, Settings)  →  http.ts  →  API local
```

- **Permitido**: telas consumirem tipos de `src/client/types.ts`, compartilhados com o servidor.
- **Proibido**: tela acessar banco, sistema de arquivos ou provedor externo diretamente. A única exceção de rede no cliente é o iframe oficial do YouTube.
- **Proibido**: renderizar dado externo ou resposta de IA como HTML executável — ver [`../API.md`](../API.md).

## Entre containers

```text
Navegador  →  Aplicação web  →  PostgreSQL
                     ↓ fila (pg-boss)
                  Worker  →  PostgreSQL  →  (Gemini, só com AI_ENABLED=true)
```

- **Proibido**: o navegador acessar o banco diretamente.
- **Proibido**: servir `data/objects/` como pasta estática — mídia sai por rota autenticada com `Range`.
- **Proibido**: trabalho longo dentro do ciclo de requisição; o caminho é enfileirar para o worker.

## Dependências de terceiros

- Adicionar biblioteca nova exige que o projeto já tenha um uso equivalente ou um ADR em `.agents/decisions/`. As versões em `package.json` são fixas (sem `^`) por decisão — mantenha o padrão.
- `pg`, `pg-boss` e `ffprobe-static` estão em `serverExternalPackages` no `next.config.ts`; qualquer pacote nativo novo provavelmente precisa entrar ali também.

## Contratos públicos

As rotas de `src/server/api.ts` e os schemas Zod de `src/domain/content.ts` são o contrato entre interface e servidor. Mudança que quebre compatibilidade não é silenciosa: atualize [`../API.md`](../API.md) e registre um ADR em `.agents/decisions/`.

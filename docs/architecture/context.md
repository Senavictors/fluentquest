---
estado: real
fonte: src/server/api.ts, src/server/auth.ts, src/server/providers.ts, next.config.ts, .env.example, PRODUCT.md
ultima-revisao: 2026-09-14 (bootstrap-init)
---

# Contexto do Sistema

## Propósito

FluentQuest transforma conteúdo escolhido pelo próprio usuário — vídeo do YouTube, texto, legenda SRT/VTT ou mídia própria — em prática de inglês: leitura segmentada, produção escrita e falada, e revisão espaçada por FSRS. É de uso pessoal e local: um único proprietário, um único computador, sem publicação.

## Atores

| Ator | Papel |
|---|---|
| Proprietário | Único usuário autenticado. Importa fontes, estuda, grava áudio, confirma cartões e revisa. Cadastro pela interface é desabilitado. |
| Worker | Processo de apoio que consome a fila `pg-boss`, prepara fontes e executa manutenção periódica (expiração de gravações, conclusão de exclusão de conta). |
| Visitante anônimo | Sem acesso. Toda consulta de domínio verifica o proprietário; acesso anônimo é bloqueado (cenário verificado em `scripts/integration.ts`). |

## Fronteiras do sistema (atores/sistemas externos)

- **YouTube** — reprodução pelo player oficial em iframe, executado no navegador. Metadados via `videos.list` apenas quando `YOUTUBE_API_KEY` existe. Sem scraping e sem download de mídia.
- **Google Gemini** — tutor, geração de atividade, transcrição e feedback de fala, via `@google/genai`. **Desligado por padrão** (`AI_ENABLED=false`); nenhuma chamada paga foi feita até hoje.
- **PostgreSQL 18** — instância local em `localhost:5432`, banco e usuário exclusivos `fluentquest`. Tratado em [containers.md](containers.md).
- **Sistema de arquivos local** — `data/objects/` guarda áudio e mídia do proprietário; `backups/` guarda dumps manuais.
- **ffprobe** (`ffprobe-static`) — verificação de duração e conteúdo real de mídia enviada.

## Fora do escopo deste contexto

- Publicação na internet: a aplicação escuta apenas em loopback (`127.0.0.1:3215`), nunca em interface de rede.
- Múltiplos usuários, convites, papéis ou compartilhamento.
- Live, avatar 3D, certificados, pagamentos, aplicativo nativo e scraping — limites declarados em [`../../PRODUCT.md`](../../PRODUCT.md).
- Avaliação fonética: não existe nesta versão, nem quando a IA for ativada.

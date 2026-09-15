---
id: TASK-002
title: Metadados do YouTube e estado editorial de fonte sem transcrição
status: backlog
type: feature
owner: fontes-proveniencia
created_at: 2026-09-14
updated_at: 2026-09-14
affected_modules: [src/server/providers.ts, src/worker.ts, src/client/Study.tsx, src/client/Settings.tsx]
related_use_cases: [ingestão de fonte do YouTube]
related_adrs: [ADR-001]
---

# TASK-002 — Metadados do YouTube e estado editorial de fonte sem transcrição

## Contexto

Fase A do ADR-001. Antes de construir a transcrição por URL (Fase B), o caminho honesto precisa funcionar bem: o link entra, o vídeo toca, os metadados aparecem e a interface diz com clareza o que falta para estudar o texto.

## Problema

`YOUTUBE_API_KEY` não está configurada, então `youtube.get()` lança 503 e o bloco de metadados em `src/worker.ts:22` é pulado: título e autor ficam como o proprietário digitou, e `duration_ms` fica zerado. Pior, uma fonte do YouTube sem legenda colada nasce `no_transcript` com job `awaiting_configuration` — um estado tecnicamente correto que hoje não explica ao proprietário o que fazer a seguir.

## Objetivo

Link do YouTube colado resulta em fonte com título, autor e duração reais, player funcionando, e um estado de interface que diz explicitamente que falta legenda e quais são os caminhos legítimos de obtê-la.

## Fora de escopo

- Transcrever o vídeo automaticamente (Fase B, TASK-004).
- Qualquer download de mídia ou legenda do YouTube — proibido pela Constituição.

## Comportamento atual

Fonte criada com `status='no_transcript'`; `prepare` falha com `NO_TRANSCRIPT` se acionado. A tela mostra o player e nenhum segmento.

## Comportamento esperado

Metadados preenchidos a partir de `videos.list`; vídeo não incorporável marcado como `unavailable` com mensagem própria; estado "sem transcrição" apresentado como um passo pendente acionável, não como erro.

## Regras de negócio

- RN-01: O servidor só consulta `videos.list` por ID validado por `youtubeId()`. Nenhum fetch de URL arbitrária.
- RN-02: Vídeo com `status.embeddable !== true` vira `unavailable` e não é oferecido para estudo.
- RN-03: Duração e tempos de legenda continuam aproximados; nenhuma sincronização é inventada.

## Critérios de aceitação

- [ ] CA-01: `YOUTUBE_API_KEY` configurada em `.env.local`; Ajustes mostra YouTube como "Configurado".
- [ ] CA-02: Um link real do proprietário produz título, autor e `duration_ms` corretos vindos da API.
- [ ] CA-03: Um vídeo não incorporável resulta em `unavailable` com mensagem compreensível, sem stack trace.
- [ ] CA-04: A tela de uma fonte `no_transcript` explica o que falta e oferece o caminho de colar legenda autorizada, sem sugerir download.
- [ ] CA-05: `node scripts/accessibility-qa.mjs` continua com 0 violações.

## Impacto técnico

### Backend
Verificar o parser de duração ISO-8601 em `src/server/providers.ts:370` contra durações com horas — a expressão atual precisa ser exercitada com um vídeo de mais de uma hora.

### Frontend
Estado editorial de `no_transcript` em `src/client/Study.tsx`.

### Banco de dados
Nenhuma migração.

### Integrações
YouTube Data API v3, apenas `videos.list`.

### Segurança
Chave só em `.env.local`.

## Plano de implementação

- [ ] Etapa 1: Criar e configurar `YOUTUBE_API_KEY`.
- [ ] Etapa 2: Exercitar `youtube.get()` com vídeo curto, vídeo longo (mais de uma hora) e vídeo não incorporável.
- [ ] Etapa 3: Corrigir o parser de duração se a etapa 2 revelar erro.
- [ ] Etapa 4: Ajustar o estado de interface de fonte sem transcrição.
- [ ] Etapa 5: Rodar a QA de acessibilidade.

## Estratégia de testes

- [ ] Unitários: caso de parsing de duração, se a lógica for movida para `src/domain/`.
- [ ] Integração: `npm run test:integration`.
- [ ] E2E: `node scripts/browser-qa.mjs`.
- [ ] Manual: os três vídeos da etapa 2.

## Riscos e rollback

Rollback é remover `YOUTUBE_API_KEY`. Risco baixo: a API é somente leitura e o player não depende dela.

## Registro de execução

### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação

Comandos e resultados.

## Handoff

Link para o handoff ativo, quando aplicável.

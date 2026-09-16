---
id: TASK-002
title: Metadados do YouTube e estado editorial de fonte sem transcrição
status: completed
type: feature
owner: fontes-proveniencia
created_at: 2026-09-14
updated_at: 2026-09-15
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

- [x] CA-01: `YOUTUBE_API_KEY` configurada em `.env.local`; Ajustes mostra YouTube como "Configurado".
- [x] CA-02: Um link real do proprietário produz título, autor e `duration_ms` corretos vindos da API.
- [x] CA-03: Um vídeo não incorporável resulta em `unavailable` com mensagem compreensível, sem stack trace.
- [x] CA-04: A tela de uma fonte `no_transcript` explica o que falta e oferece o caminho de colar legenda autorizada, sem sugerir download.
- [x] CA-05: `node scripts/accessibility-qa.mjs` continua com 0 violações.

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

- [x] Etapa 1: Criar e configurar `YOUTUBE_API_KEY`.
- [x] Etapa 2: Exercitar `youtube.get()` com vídeo curto, vídeo longo (mais de uma hora) e vídeo não incorporável.
- [x] Etapa 3: Confirmar o parser de duração com horas; nenhuma correção adicional foi necessária.
- [x] Etapa 4: Ajustar o estado de interface de fonte sem transcrição.
- [x] Etapa 5: Rodar a QA de acessibilidade.

## Estratégia de testes

- [x] Unitários: adaptador exercitado em `tests/providers.test.ts`, incluindo `PT1H2M3S`.
- [x] Integração: `npm run test:integration` — 27/27 cenários.
- [x] E2E: `node scripts/browser-qa.mjs` e validação manual no Chrome.
- [x] Manual: vídeos curto, longo e não incorporável consultados; vídeo indicado pelo proprietário validado ponta a ponta.

## Riscos e rollback

Rollback é remover `YOUTUBE_API_KEY`. Risco baixo: a API é somente leitura e o player não depende dela.

## Registro de execução

### Alterações realizadas

2026-09-15 — Metadados podem entrar na fila sem IA; eventos refletem o estado real. Fonte sem texto fica no_transcript; vídeo não incorporável preserva unavailable e não exibe player/preparo. Formulário de legenda distingue owned/licensed; texto vazio é recusado. Estado vazio oferece legenda autorizada e prática independente. Validação de ID no adaptador; parser testado com PT1H2M3S. docs/API.md atualizado.

### Arquivos principais
### Decisões
### Divergências

Escopo registrado nesta revisão: correções necessárias à execução segura do fluxo local identificado pela inspeção. QA isolado e documentação transversal registrados separadamente em TASK-008. Fixtures não equivalem ao piloto real.

### Pendências

Nenhuma pendência neste escopo. Transcrição automática continua fora da TASK-002.


## Validação

Validação de 15/09/2026: npm run typecheck passou; npm test 30/30; npm run test:integration 27/27; npm run build passou. QA Edge desktop/mobile e axe: zero erros/transbordamentos e zero violações em nove telas e quatro variantes do formulário. Execução em banco temporário, sem chamadas reais de IA/YouTube. Evidências e limites em [docs/VALIDACAO.md](../../../docs/VALIDACAO.md).

## Handoff

[Continuidade da Fase A](../../handoffs/FASE-A-2026-09-15.md)

## Atualização após configuração — 2026-09-15

Chave preenchida pelo proprietário, porém videos.list retornou 401. Inspeção autorizada do Chrome confirmou FluentQuest Youtube restrita a Gemini API e vinculada a conta de serviço. É necessário criar chave própria YouTube Data API v3 no Google Cloud e atualizar YOUTUBE_API_KEY; não reutilizar a chave Gemini. CA-01 ainda não equivale a credencial validada. Nenhum vídeo real importado.

Resultados detalhados em [VALIDACAO.md](../../../docs/VALIDACAO.md), seção Piloto real de texto. Registros anteriores permanecem como histórico.

## Validação real da integração — 2026-09-15

A nova chave separada retornou HTTP 200 em `videos.list`; Ajustes exibiu YouTube como Configurado. O vídeo indicado pelo proprietário (`mDxeUnbUOn0`) foi criado pelo fluxo autenticado e atualizado pelo worker para **How We Built a Custom AI System for a Real Business**, **Dev Shah**, `duration_ms=495000`, `status=no_transcript`. O Chrome mostrou o player e a orientação de legenda autorizada.

Consulta adicional: vídeo curto `PT3M35S`; vídeo longo `PT3H26M43S`; vídeo real `3xlegeyULX8` com `embeddable=false`. O estado indisponível e a ausência de player estão cobertos no cenário de integração. Nenhuma chave foi registrada em Git ou documentação.

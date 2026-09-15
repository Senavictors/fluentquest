---
id: TASK-004
title: Adaptador Gemini de transcrição por URL de vídeo e orçamento por minuto
status: backlog
type: integration
owner: ia-orcamento
created_at: 2026-09-14
updated_at: 2026-09-14
affected_modules: [src/server/providers.ts, src/server/budget.ts, src/worker.ts, docs/INTEGRACOES.md]
related_use_cases: [transcrição de vídeo por URL]
related_adrs: [ADR-001]
---

# TASK-004 — Adaptador Gemini de transcrição por URL de vídeo e orçamento por minuto

## Contexto

Núcleo da Fase B do ADR-001. É esta task que transforma "colei um link" em "tenho texto para estudar", sem que o servidor baixe mídia: a URL é enviada ao Gemini e o Google faz o processamento do lado dele.

## Problema

`infer()` em `src/server/providers.ts:88` reserva orçamento a partir de uma estimativa de tokens de texto e de áudio (`90 * 100` para áudio curto). Vídeo não cabe nessa conta: o custo escala com a duração da mídia, não com o tamanho do prompt. Reservar por token de texto para uma chamada de vídeo subestimaria a reserva e furaria a regra de que a reserva precede e cobre a inferência.

## Objetivo

Um caminho de transcrição por URL de vídeo, com reserva de orçamento proporcional à duração, saída segmentada com timestamps aproximados, e nenhuma mídia trafegando pelo servidor.

## Fora de escopo

- Tela e fluxo de uso (TASK-005).
- Qualquer provedor além do Gemini.
- Download de áudio ou vídeo, em qualquer hipótese.

## Comportamento atual

`gemini.transcribe()` aceita `Buffer` de áudio do próprio proprietário. Não existe caminho que aceite URL.

## Comportamento esperado

Nova função de provedor que recebe a URL validada e a duração conhecida (vinda de `videos.list`, TASK-002), reserva orçamento em função dos minutos, chama o Gemini com a URL, valida e persiste os segmentos.

## Regras de negócio

- RN-01: A reserva de orçamento precede a chamada, como toda inferência. A fórmula de reserva passa a considerar duração; o multiplicador de folga existente (1,25) é mantido ou justificado se alterado.
- RN-02: Sem `duration_ms` conhecido, a transcrição é recusada — não se reserva orçamento cego.
- RN-03: Vídeo acima do limite de duração de TASK-003 é recusado antes de qualquer reserva.
- RN-04: Finalidade (`purpose`) própria em `budget_reservations` e `usage_events`, para que o custo de vídeo seja distinguível do custo de texto em `GET /api/usage`.
- RN-05: Saída sem medição de uso mantém a reserva em `unknown`, como já faz `infer()`. Não se repete automaticamente uma chamada que pode ter sido cobrada.
- RN-06: Resultado truncado ou incompleto **não** vira transcrição salva.
- RN-07: O servidor não baixa mídia. Nenhuma dependência de download entra no projeto.

## Critérios de aceitação

- [ ] CA-01: Transcrição de um vídeo curto real produz segmentos com `time_accuracy = 'approximate'` e o `origin` novo de TASK-003.
- [ ] CA-02: `GET /api/usage` mostra o custo da transcrição em finalidade separada da geração de atividade.
- [ ] CA-03: Vídeo acima do limite é recusado sem criar reserva — verificável por `budget_reservations` vazia após a tentativa.
- [ ] CA-04: Custo real por minuto de vídeo medido e registrado em `docs/VALIDACAO.md`.
- [ ] CA-05: Uma interrupção no meio da transcrição deixa a reserva em `unknown` e nenhum segmento parcial salvo.
- [ ] CA-06: `docs/INTEGRACOES.md` reescrito: a frase que diz que o suporte a URL de vídeo não está ativado deixa de valer e é substituída pelos limites reais adotados.
- [ ] CA-07: Nenhuma dependência nova no `package.json`.

## Impacto técnico

### Backend
`src/server/providers.ts` (função nova ao lado de `gemini.transcribe`), `src/server/budget.ts` (fórmula de reserva por duração), `src/worker.ts` (novo handler de job).

### Frontend
Nenhum nesta task.

### Banco de dados
Nenhuma migração — consome o schema de TASK-003.

### Integrações
Primeiro uso do Gemini com entrada de vídeo por URL. Verificar no piloto se o tier gratuito permite esse modo e com que limite.

### Segurança
Conteúdo de terceiros passa a ser enviado ao provedor. No tier gratuito isso alimenta o treino do modelo — risco aceito em ADR-001, mas precisa estar visível ao proprietário antes da primeira transcrição.

## Plano de implementação

- [ ] Etapa 1: Confirmar na documentação do provedor o formato exato de entrada de URL de vídeo e os limites do tier gratuito.
- [ ] Etapa 2: Estender a fórmula de reserva para duração.
- [ ] Etapa 3: Escrever o adaptador, com schema de saída segmentada validado por Zod.
- [ ] Etapa 4: Adicionar o handler de job no worker.
- [ ] Etapa 5: Medir custo e latência com um vídeo curto; registrar.
- [ ] Etapa 6: Exercitar recusa por duração, interrupção e resposta truncada.
- [ ] Etapa 7: Reescrever a seção de YouTube em `docs/INTEGRACOES.md`.

## Estratégia de testes

- [ ] Unitários: fórmula de reserva por duração, em `src/domain/` se puder ser pura.
- [ ] Integração: `npm run test:integration` com cenário novo de recusa por duração e de IA desligada.
- [ ] E2E: não se aplica.
- [ ] Manual: um vídeo curto real, medido.

## Riscos e rollback

Maior risco de custo do plano inteiro. Mitigação: começar com um vídeo de poucos minutos e o teto de US$ 10 já aplicado. Rollback é desativar o novo `jobs.kind` — o schema de TASK-003 permanece sem causar dano. O agente `ia-orcamento` tem poder de veto sobre esta task.

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

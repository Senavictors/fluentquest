---
id: TASK-007
title: Adaptador OpenAI e piloto do crédito de US$ 5
status: backlog
type: integration
owner: ia-orcamento
created_at: 2026-09-14
updated_at: 2026-09-14
affected_modules: [src/server/providers.ts, package.json, .env.example, docs/INTEGRACOES.md, docs/VALIDACAO.md]
related_use_cases: [tutor contextual, geração de atividade, transcrição de gravação própria]
related_adrs: [ADR-001]
---

# TASK-007 — Adaptador OpenAI e piloto do crédito de US$ 5

## Contexto

Última task do ADR-001. O proprietário tem US$ 5 de crédito já pago na OpenAI. Depois de TASK-006, adicionar um provedor deixa de ser risco de conciliação e passa a ser trabalho de adaptador.

## Problema

Hoje existe um único provedor. Se a chave do Gemini falhar, atingir limite de taxa do tier gratuito ou o modelo sair do ar, não há alternativa: todas as funções de IA caem juntas. Além disso, não há com o que comparar a qualidade pedagógica do Gemini — o piloto avalia um provedor contra nada.

## Objetivo

OpenAI disponível como provedor alternativo para tutor, geração de atividade e transcrição das gravações do próprio proprietário, com conciliação de custo correta e o crédito de US$ 5 como teto natural do experimento.

## Fora de escopo

- **Qualquer caminho de YouTube via OpenAI.** A OpenAI não acessa vídeos do YouTube e baixar o áudio é proibido pela Constituição. Transcrição de vídeo continua sendo exclusividade do caminho de TASK-004.
- Roteamento automático entre provedores por custo ou qualidade. A escolha é explícita nesta task.

## Comportamento atual

Um provedor. `integrationStatus().ai` é booleano único.

## Comportamento esperado

Segundo adaptador implementando as mesmas interfaces (`TutorProvider`, `LessonGenerator`, `SpeechTranscriber`), com preços e revisão próprios, selecionável pelo proprietário.

## Regras de negócio

- RN-01: A dependência nova (`openai`) contraria a regra global de não introduzir dependência que o projeto ainda não usa. Está autorizada **apenas** por ADR-001; a justificativa fica registrada no `package.json` da task e no ADR.
- RN-02: O adaptador respeita todas as invariantes existentes: reserva antes da inferência, medição de uso obrigatória, saída truncada não vira avaliação, prompt versionado, conteúdo de origem tratado como dado não confiável.
- RN-03: O prompt de sistema é o mesmo `SYSTEM` já usado, ou uma variante versionada — não um prompt novo improvisado.
- RN-04: O cache de resultado é chaveado por provedor e modelo, além do que já usa. Resposta de um provedor nunca é servida como se fosse de outro.
- RN-05: Preços da OpenAI copiados da tabela oficial na data da configuração, com sua própria data de revisão.

## Critérios de aceitação

- [ ] CA-01: Tutor, geração de atividade e transcrição de gravação própria funcionam via OpenAI.
- [ ] CA-02: `usage_events` registra provedor, modelo e custo corretos para cada chamada; o custo estimado bate com o consumo mostrado no painel da OpenAI dentro de uma margem registrada.
- [ ] CA-03: Trocar de provedor não reaproveita cache do outro.
- [ ] CA-04: Com a chave da OpenAI ausente, o provedor aparece como não configurado e o Gemini continua funcionando normalmente.
- [ ] CA-05: Comparação de qualidade entre os dois provedores, na mesma fonte, registrada em `docs/VALIDACAO.md` — com juízo humano, não autoavaliação de modelo.
- [ ] CA-06: `npm run typecheck`, `npm test` e `npm run test:integration` verdes.
- [ ] CA-07: `.env.example` e `docs/INTEGRACOES.md` documentam o provedor novo.

## Impacto técnico

### Backend
Adaptador novo em `src/server/providers.ts` (ou arquivo irmão), sobre a abstração de TASK-006.

### Frontend
Lista de integrações em `src/client/Settings.tsx` passa a mostrar dois provedores.

### Banco de dados
Nenhuma migração esperada — `usage_events` já tem `model` e `price_version`.

### Integrações
Dependência `openai` nova, com versão fixada.

### Segurança
Chave só em `.env.local`. Diferente do Gemini no tier gratuito, a OpenAI em conta paga não usa o conteúdo da API para treino por padrão — o que torna este provedor a opção mais adequada para gravações de voz. Registrar essa diferença.

## Plano de implementação

- [ ] Etapa 1: Confirmar preços e modelos disponíveis para o crédito existente.
- [ ] Etapa 2: Adicionar a dependência com versão fixada.
- [ ] Etapa 3: Implementar o adaptador sobre a abstração de TASK-006.
- [ ] Etapa 4: Exercitar as três funções com material curto.
- [ ] Etapa 5: Comparar a mesma fonte nos dois provedores e registrar o juízo.
- [ ] Etapa 6: Conferir o consumo no painel da OpenAI contra `usage_events` — é a conciliação com fatura que o tier gratuito do Gemini não permite fazer.

## Estratégia de testes

- [ ] Unitários: normalização de uso do provedor novo.
- [ ] Integração: cenário de provedor ausente e de provedor com preço vencido.
- [ ] E2E: não se aplica.
- [ ] Manual: etapas 4 a 6.

## Riscos e rollback

Crédito de US$ 5 é finito e não renova. Mitigação: material curto nas etapas de teste, e o teto de US$ 10 do aplicativo continua valendo. Rollback é remover a chave do `.env.local`; o Gemini segue funcionando. O agente `ia-orcamento` tem poder de veto.

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

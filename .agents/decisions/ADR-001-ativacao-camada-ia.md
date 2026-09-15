---
id: ADR-001
title: Ativação da camada de IA em três fases, com Gemini no tier gratuito
status: accepted
date: 2026-09-14
deciders: [Victor Sena]
related_tasks: [TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007]
---

# ADR-001 — Ativação da camada de IA em três fases, com Gemini no tier gratuito

## Contexto

O MVP offline está completo e verde (`tsc --noEmit` limpo, 11/11 testes de domínio, 23/23 cenários de integração, banco migrado com proprietário e perfil criados). A camada de IA está inteiramente escrita em `src/server/providers.ts` — tutor com SSE, geração de atividade com schema Zod e verificação de IDs de origem, transcrição e feedback de fala, tudo atrás de reserva de orçamento em `src/server/budget.ts` — mas **nunca executou uma chamada**. Com `AI_ENABLED=false` e sem `GEMINI_API_KEY`, toda função responde 503 "integração não configurada", conforme a Constituição exige.

O proprietário quer usar o aplicativo de verdade: colar um link do YouTube e estudar com apoio de IA. O mapeamento do fluxo real (`src/server/api.ts:355`, `src/worker.ts:39`) mostra a lacuna central: **uma fonte do YouTube sem legenda colada nasce com status `no_transcript` e job `awaiting_configuration`**. A IA do código atual só gera atividade a partir de segmentos que já existem; ela não produz transcrição de vídeo. Sem um caminho novo, "colar link e estudar" continua exigindo que o proprietário obtenha e cole a legenda manualmente para cada vídeo.

Restrições que moldaram a decisão:

- A Constituição proíbe scraping e download do YouTube — apenas o player oficial em iframe e legendas fornecidas legitimamente.
- `docs/INTEGRACOES.md` declara que o suporte do Gemini a URL de vídeo **não está ativado** nesta implementação e que qualquer extensão desse caminho exige piloto, registro de direitos, limites específicos de mídia e medição de custo.
- As regras globais proíbem introduzir dependência nova sem que o projeto já a use.
- O motor de preço é hoje inteiramente específico do Gemini (`GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION`), embora `usage_events` já registre `model` por linha.
- O proprietário tem crédito de US$ 5 já pago na OpenAI.

## Decisão

Ativar a camada de IA em **três fases sequenciais**, cada uma com seu próprio conjunto de tasks e sua própria evidência de conclusão.

**Fase A — Piloto Gemini no escopo atual.** Configurar `GEMINI_API_KEY`, `AI_PRICES_REVIEWED_ON` e os preços revisados; ligar `AI_ENABLED=true`; configurar `YOUTUBE_API_KEY` para metadados. Executar o piloto de `docs/INTEGRACOES.md` com material curto do próprio proprietário e uma gravação própria, registrando as evidências em `docs/VALIDACAO.md`. Nesta fase o YouTube funciona como player e a legenda continua sendo colada manualmente.

**Fase B — Transcrição de vídeo por URL, pelo lado do Google.** Adicionar um caminho de ingestão no qual o servidor envia a **URL** do vídeo ao Gemini e recebe transcrição segmentada, em vez de o servidor baixar qualquer mídia. Exige migração nova para o novo `origin`/provenance e status de fonte, limite de duração de vídeo, finalidade de orçamento própria e proveniência honesta na interface (`timeAccuracy: "approximate"`, nunca sincronização inventada).

**Fase C — Segundo provedor.** Generalizar `providers.ts` e as variáveis de preço para N provedores antes de adicionar qualquer adaptador novo; só então integrar a OpenAI para tutor, geração de atividade e transcrição das gravações do próprio proprietário, usando o crédito de US$ 5 já existente.

**Parâmetros operacionais decididos pelo proprietário:**

- Teto mensal de IA no aplicativo: **US$ 10** (`monthly_limit_cents = 1000`).
- Chave Gemini: **tier gratuito**.

## Alternativas consideradas

### Alternativa A isolada — apenas o piloto no escopo atual

Ligar o Gemini e parar aí. É a opção de menor custo e menor risco, e não conflita com nenhuma linha da Constituição nem de `docs/INTEGRACOES.md`.

**Não escolhida** porque não entrega o objetivo declarado pelo proprietário. Mantém o passo manual de obter e colar legenda para cada vídeo, que é exatamente a fricção que motivou o pedido. Foi absorvida como Fase A, não descartada: é pré-requisito das outras duas.

### Alternativa C isolada — apenas o segundo provedor OpenAI

Aproveitar o crédito de US$ 5 já pago e ganhar redundância de provedor e um ponto de comparação de qualidade pedagógica.

**Não escolhida como caminho principal** porque não resolve o problema central: a OpenAI também não acessa vídeos do YouTube, e baixar o áudio para transcrever continua proibido pela Constituição. Entregaria apenas uma segunda forma de fazer o que o Gemini já faz. Foi mantida como Fase C, depois de o problema principal estar resolvido.

### Alternativa descartada — baixar áudio do YouTube para transcrever

Seria o caminho técnico mais direto para transformar qualquer link em texto, e habilitaria qualquer provedor de transcrição, inclusive a OpenAI.

**Descartada sem negociação**: contradiz frontalmente a Constituição ("Sem scraping ou download do YouTube") e o escopo declarado em `PRODUCT.md`. Não foi oferecida como opção ao proprietário.

## Consequências

### Positivas

- O objetivo do proprietário — colar um link e estudar — passa a ser alcançável ao fim da Fase B, sem que o servidor baixe mídia de terceiros.
- A Fase A produz exatamente as evidências que faltam em `docs/VALIDACAO.md`, resolvendo de quebra o único link quebrado da documentação.
- A ordem das fases mantém o risco crescente e reversível: cada fase é útil sozinha e pode ser interrompida sem deixar o sistema inconsistente.
- Generalizar o provedor **antes** de adicionar a OpenAI evita que a conciliação de custo passe a mentir, que é o que aconteceria ao chamar um provedor novo com variáveis de preço `GEMINI_*`.

### Negativas

- A Fase B amplia o escopo declarado do produto. `docs/INTEGRACOES.md` precisa ser reescrito nesse ponto, deixando de dizer que o caminho de URL de vídeo não está ativado.
- Transcrição de vídeo custa por minuto de mídia, ordens de grandeza acima de texto. O teto de US$ 10 será atingido muito mais rápido na Fase B do que na Fase A.
- A Fase C dobra a superfície de preço, conciliação e regressão, para um ganho que é de redundância, não de capacidade nova.

### Riscos

- **Tier gratuito: não há fatura, então o passo 5 do piloto não pode ser concluído como escrito.** O livro-razão de `usage_events` passa a ser uma estimativa que não tem contra-prova externa. O teto de US$ 10 deixa de ser freio de gasto e vira **freio de uso**. Consequência aceita conscientemente pelo proprietário; a validação de custo real fica pendente até que exista uma chave de projeto pago.
- **Privacidade no tier gratuito (risco principal desta decisão).** No tier gratuito o Google pode usar o conteúdo enviado para melhorar seus modelos, independentemente de o adaptador enviar `store: false`. O proprietário vai enviar gravações da própria voz e, na Fase B, conteúdo de vídeos de terceiros. Risco declarado e aceito; deve ser reexibido na interface antes do primeiro envio de gravação.
- **Limites de taxa do tier gratuito não medidos.** Podem transformar uso normal em erro 429 e abrir o disjuntor de `PROVIDER_CIRCUIT_OPEN` após três falhas ambíguas em dez minutos. A ser medido no piloto, não estimado.
- **Disponibilidade do modelo não verificada.** `gemini-3.5-flash-lite` compila nos tipos do SDK `@google/genai` 2.22.0, mas nunca foi chamado; a existência e a disponibilidade do modelo na conta só se confirmam na primeira chamada real.
- **Direitos sobre conteúdo de terceiros na Fase B.** Transcrever um vídeo de terceiro para estudo pessoal exige que o campo `rights` da fonte reflita a realidade (`public_link`), e que a interface não apresente a transcrição como material licenciado.
- **`AI_PRICES_REVIEWED_ON` vence em 31 dias** e bloqueia novas chamadas. Vira tarefa recorrente a partir da Fase A.

## Plano de adoção

1. **Fase A** — TASK-001 (configuração e piloto Gemini, evidências em `docs/VALIDACAO.md`) e TASK-002 (metadados do YouTube e estado editorial de fonte sem transcrição).
2. **Fase B** — TASK-003 (migração e domínio da ingestão por URL de vídeo), TASK-004 (adaptador Gemini de transcrição por URL e finalidade de orçamento própria), TASK-005 (interface do fluxo colar-link-e-estudar).
3. **Fase C** — TASK-006 (abstração multi-provedor de `providers.ts` e das variáveis de preço, sem adicionar provedor) e TASK-007 (adaptador OpenAI e piloto de US$ 5).

Nenhuma fase começa antes de a anterior ter sua evidência registrada. A Fase C pode render um ADR próprio quando o desenho da abstração multi-provedor estiver definido; este ADR registra a intenção, não o desenho.

Compatibilidade: as fases A e C não alteram contratos públicos. A Fase B altera `POST /api/sources` e o ciclo de vida de `jobs`, exigindo atualização de `docs/API.md` antes do merge.

## Validação

- **Fase A** cumprida quando os passos 1 a 6 de `docs/INTEGRACOES.md` estiverem executados e registrados em `docs/VALIDACAO.md`, com o passo 5 marcado explicitamente como não concluído por ausência de fatura no tier gratuito.
- **Fase B** cumprida quando um link do YouTube colado pelo proprietário resultar em segmentos estudáveis com `time_accuracy = 'approximate'` e proveniência visível, sem que o servidor tenha baixado mídia, e com o custo por minuto medido e registrado.
- **Fase C** cumprida quando uma mesma atividade puder ser gerada por Gemini e por OpenAI com a conciliação de custo correta para cada um em `usage_events`, e com os US$ 5 de crédito refletidos.

## Revisão

Reavaliar ao fim de cada fase. Gatilhos de reavaliação antecipada: adoção de chave de projeto pago (muda o risco de privacidade e reabilita o passo 5 do piloto), custo medido da Fase B acima de US$ 10/mês em uso normal, ou limites de taxa do tier gratuito tornando o uso diário inviável.

---
id: TASK-009
title: Piso de cobertura da transcrição por URL e falha de validação honesta
status: active
type: fix
owner: ia-orcamento
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules:
  [
    src/domain/content.ts,
    src/server/providers.ts,
    tests/domain.test.ts,
    tests/providers.test.ts,
    docs/API.md,
  ]
related_use_cases: [transcrição de vídeo por URL]
related_adrs: [ADR-001]
---

# TASK-009 — Piso de cobertura da transcrição por URL e falha de validação honesta

## Contexto

Em 2026-09-17 o proprietário transcreveu por URL o vídeo `Xli-93vkN-s` ("How to Actually Build a $10,000 Website…", 837.000 ms) e pediu conferência do resultado. A verificação encontrou dois defeitos nossos, ambos no caminho aberto por TASK-004. Nenhum deles é indisponibilidade do provedor.

## Problema

**Defeito 1 — transcrição truncada aceita como pronta.** A fonte `c93d484d-e971-40b6-896d-b38733387196` ficou com **5 trechos cobrindo 0 → 111.000 ms de 837.000 ms (13,3%)** e mesmo assim entrou em `text_ready`. Nada no caminho verifica cobertura: `videoTranscript` exige `segments.min(1)` (`src/domain/content.ts:144`) e `fitTranscriptToDuration` (`src/domain/content.ts:174`) só recusa tempo **acima** da duração. Para comparação, o vídeo `bU-0iWXCPkw`, de exatamente 837.000 ms, rendeu 78 trechos cobrindo os 837 s inteiros em 2026-09-16.

**Defeito 2 — resposta paga descartada e reportada como falha do provedor.** Na tentativa de 09:29:33 o Gemini respondeu com 4.404 tokens de saída (mesma ordem dos 5.676 que geraram 78 trechos no outro vídeo). `settleBudget` conciliou em `src/server/providers.ts:567`; só depois o `schema.parse(JSON.parse(text))` da linha 582 falhou. `ZodError` não é `AppError`, então caiu no `catch` genérico e virou `PROVIDER_UNAVAILABLE` (`src/server/providers.ts:622`), com a mensagem "Não foi possível concluir a chamada ao provedor". A transcrição inteira foi paga, descartada sem registro do texto e diagnosticada errado.

Efeito somado: duas chamadas cobradas no mesmo minuto (33.910 + 23.845 micros), a primeira perdida por diagnóstico falso e a segunda — 378 tokens de saída, 70.660 tokens de vídeo servidos do cache implícito do Gemini — salva como se fosse a transcrição do vídeo.

## Objetivo

Uma resposta de transcrição só vira fonte `text_ready` se cobrir o vídeo; uma resposta que chega, é cobrada e não passa na validação é reportada pelo que é, com o texto bruto preservado no log.

## Fora de escopo

- Revisar o texto dos 5 trechos já salvos, ou re-transcrever o vídeo (decisão do proprietário, depois desta correção).
- Mudar modelo, preço ou teto de orçamento.
- Interface: nenhuma tela nova. As mensagens novas chegam pelo caminho de erro de job que já existe.
- Corrigir a repetição de bloco observada em 2026-09-16 (9 de 78 trechos) — continua como pendência de TASK-004.

## Comportamento atual

- Transcrição com qualquer cobertura ≥ 1 trecho é gravada e a fonte vira `text_ready`.
- Falha de validação pós-conciliação vira `PROVIDER_UNAVAILABLE`, o texto se perde e o job vai para `needs_review` com causa falsa.
- O texto validado é gravado em `result_cache` antes de o chamador poder recusá-lo.

## Comportamento esperado

- Transcrição cujo último `endMs` fique abaixo de `MIN_TRANSCRIPT_COVERAGE` da duração é recusada com `INCOMPLETE_TRANSCRIPT`, mensagem dizendo quanto foi coberto, e nenhum segmento salvo. A fonte não vai para `text_ready`.
- JSON inválido ou schema reprovado viram `INVALID_PROVIDER_OUTPUT`, com o primeiro motivo da validação na mensagem e o texto bruto no log `AI_INVALID_OUTPUT`.
- Transcrição de vídeo não passa pelo `result_cache`, para que uma resposta recusada não fique presa na chave e impeça nova tentativa.

## Regras de negócio

- RN-01: Cobertura é medida na linha do tempo crua do modelo, antes de `fitTranscriptToDuration`. O reescalonamento só encolhe (`lastEnd > durationMs`), então nunca transforma transcrição curta em completa.
- RN-02: O piso é `MIN_TRANSCRIPT_COVERAGE = 0.8`. Os 20 % de folga cobrem encerramento sem fala (vinheta, tela final); truncamento real fica bem abaixo disso.
- RN-03: Uma chamada conciliada continua conciliada. A recusa por validação não libera reserva já `settled` — o dinheiro foi gasto e o registro precisa dizer isso.
- RN-04: `INVALID_PROVIDER_OUTPUT` nunca é apresentado como indisponibilidade do provedor. A diferença é exatamente o que custou uma transcrição em 2026-09-17.
- RN-05: Nenhum conteúdo inferido muda de `quality_status`. `ai_unreviewed` e `approximate` continuam valendo para o que passa no piso.

## Critérios de aceitação

- [x] CA-01: `assertTranscriptCoverage` recusa 111.000 ms de 837.000 ms e aceita 837.000 ms de 837.000 ms.
- [x] CA-02: `gemini.transcribeVideo` com resposta truncada rejeita com `INCOMPLETE_TRANSCRIPT`, sem gravar em `result_cache`.
- [x] CA-03: Resposta com JSON válido mas schema reprovado rejeita com `INVALID_PROVIDER_OUTPUT`, não `PROVIDER_UNAVAILABLE`.
- [x] CA-04: Resposta que não é JSON rejeita com `INVALID_PROVIDER_OUTPUT`.
- [x] CA-05: A conciliação de uma resposta recusada por validação permanece `settled` (nenhuma reserva já conciliada é revertida).
- [x] CA-06: Transcrição de vídeo não lê nem escreve `result_cache`; os demais propósitos continuam usando o cache.
- [x] CA-07: `npm run typecheck` e `npm test` verdes; `docs/API.md` atualizado.

## Impacto técnico

### Backend

`src/domain/content.ts`: `MIN_TRANSCRIPT_COVERAGE` e `assertTranscriptCoverage()`, puros, sem dependência de HTTP ou banco. `src/server/providers.ts`: `parseProviderOutput()` substitui `schema.parse(JSON.parse(text))`; `transcribeVideo` chama a asserção de cobertura antes de `fitTranscriptToDuration`; leitura e escrita de `result_cache` passam a ser condicionadas a `!video`.

### Frontend

Nenhum. As mensagens novas usam o caminho `jobs.error_code` / `error_message` que a tela já renderiza.

### Banco de dados

Nenhuma migração. Nenhum dado existente é alterado — a fonte truncada de 2026-09-17 continua como está até o proprietário decidir.

### Integrações

Nenhuma chamada nova ao Gemini. O piso e a validação podem **recusar** uma chamada já paga; é o preço de não salvar transcrição falsa.

### Segurança

`AI_INVALID_OUTPUT` registra até 4.000 caracteres do texto bruto no log do servidor local. É conteúdo de estudo do próprio proprietário, em máquina de proprietário único, e o log não sai do loopback.

## Plano de implementação

- [x] Etapa 1 — `MIN_TRANSCRIPT_COVERAGE` e `assertTranscriptCoverage()` em `src/domain/content.ts`.
- [x] Etapa 2 — `parseProviderOutput()` em `src/server/providers.ts` e substituição do parse genérico.
- [x] Etapa 3 — cobertura chamada em `transcribeVideo`; `result_cache` desligado para vídeo.
- [x] Etapa 4 — testes unitários de domínio e de provedor.
- [x] Etapa 5 — `docs/API.md` e registro em `.agents/`.

## Estratégia de testes

- [x] Unitários — `tests/domain.test.ts` (piso de cobertura) e `tests/providers.test.ts` (códigos de erro, conciliação, cache).
- [ ] Integração — `npm run test:integration` exige PostgreSQL e `.env.setup`; rodar antes do commit.
- [ ] E2E — não se aplica.
- [ ] Manual — nova transcrição real do vídeo `Xli-93vkN-s`, para confirmar que uma resposta completa passa no piso. Gera custo; depende de autorização do proprietário.

## Riscos e rollback

- **Falso positivo do piso** (impacto médio): vídeo com encerramento longo sem fala pode cair abaixo de 80 % e ser recusado depois de a chamada ter sido paga. Mitigação: a mensagem informa a cobertura medida, então o proprietário distingue truncamento de silêncio legítimo; o piso é uma constante única, fácil de ajustar.
- **Chamada repetida sem cache** (impacto baixo): desligar o `result_cache` para vídeo permite pagar duas vezes pelo mesmo vídeo se a mesma requisição for repetida. Contido pelo guard `TRANSCRIPT_EXISTS` no worker, pela reserva de orçamento e pelo teto de US$ 1.
- Rollback: as três mudanças são independentes e reversíveis por arquivo; nenhuma toca schema, migração ou dado gravado.

## Registro de execução

### Alterações realizadas

- `src/domain/content.ts`: `MIN_TRANSCRIPT_COVERAGE = 0.8` e `assertTranscriptCoverage()`, que recusa com `INCOMPLETE_TRANSCRIPT` e informa a cobertura medida em minutos e em porcentagem.
- `src/server/providers.ts`: `parseProviderOutput()` no lugar de `schema.parse(JSON.parse(text))` — separa "resposta chegou e reprovou" de "provedor fora do ar", registra o texto bruto em `AI_INVALID_OUTPUT` (4.000 caracteres) e devolve `INVALID_PROVIDER_OUTPUT` com o motivo da validação na mensagem; `transcribeVideo` chama a asserção de cobertura antes do reescalonamento; leitura e escrita de `result_cache` passam a ser puladas quando a chamada é de vídeo.
- `tests/domain.test.ts`: bloco "Piso de cobertura da transcrição de vídeo" com o caso real de 2026-09-17, o encerramento sem fala dentro da folga e a independência em relação ao reescalonamento.
- `tests/providers.test.ts`: recusa da resposta truncada mantendo a conciliação; ausência de cache para vídeo; `INVALID_PROVIDER_OUTPUT` para schema reprovado e para resposta que não é JSON; nenhum cache depois de validação reprovada. O fixture de `query` passou a responder por SQL em vez de por ordem de chamada, porque vídeo não lê mais o cache. Dois fixtures de transcrição tinham cobertura de 1,7% e 2,4% e foram corrigidos para representar transcrições completas — eram exatamente o caso que o piso agora recusa.
- `docs/API.md`: contrato de `POST /api/sources/:id/transcribe` com os dois códigos novos e a ausência de cache.

### Arquivos principais

`src/domain/content.ts`, `src/server/providers.ts`, `tests/domain.test.ts`, `tests/providers.test.ts`, `docs/API.md`.

### Decisões

- O piso vive no domínio, não no schema Zod: `videoTranscript` é convertido em JSON Schema e enviado ao Gemini, e cobertura depende de `durationMs`, que não pertence ao contrato de saída.
- A cobertura é verificada em `transcribeVideo` e não dentro de `infer`: `infer` é genérico. Em troca, `result_cache` precisou ser desligado para vídeo, senão a resposta recusada ficaria presa na chave e a nova tentativa nunca chamaria o provedor.

### Divergências

Dois testes de provedor que já existiam passaram a falhar com o piso ligado, porque seus fixtures cobriam 1,7% e 2,4% da duração declarada. Não é regressão: é o defeito reproduzido dentro da própria suíte, que até aqui tratava transcrição truncada como resultado normal.

### Pendências

- Nova transcrição real de `Xli-93vkN-s` para confirmar o piso contra uma resposta completa. Gera custo; depende de autorização.
- A fonte `c93d484d-e971-40b6-896d-b38733387196` continua no banco com 5 trechos e status `text_ready`. Esta task não mexe em dado gravado; a decisão de apagar e re-transcrever é do proprietário.
- O erro `INCOMPLETE_TRANSCRIPT` chega à interface pela mensagem do job. Nenhuma tela foi conferida com `node scripts/accessibility-qa.mjs` porque nenhuma tela mudou.

## Validação

- `npm run typecheck`: passou.
- `npm test`: 51/51 (43 anteriores + 8 novos).
- `npm run test:integration`: 30/30, sem nenhuma chamada de IA.
- Verificação do defeito original, no banco: fonte `c93d484d` com 5 trechos, `max(end_ms)=111000` para `duration_ms=837000`; jobs `7b43713f` (`PROVIDER_UNAVAILABLE`, 4.404 tokens de saída conciliados) e `34a73a86` (`ready`, 378 tokens de saída, 70.660 tokens de vídeo em cache implícito do provedor).

## Complemento — 2026-09-17, caso `2Bs0Ink_-Uo`

### O que apareceu

Logo após a correção acima, a transcrição do vídeo `2Bs0Ink_-Uo` ("JEV Breakdown", Rob Shocks, fonte `6fc332de-41c8-4de2-a7b9-3d9153b43d60`) falhou quatro vezes seguidas — três com `INVALID_TRANSCRIPT_TIME` e uma com `PROVIDER_UNAVAILABLE`. A duração foi conferida na própria página do YouTube: 636 s exatos, igual ao `duration_ms` gravado. O parser ISO-8601 não tem culpa.

`fitTranscriptToDuration` recusa quando o maior `endMs` passa de `durationMs * MAX_TIME_DRIFT` (1,5), ou seja 954.000 ms. O Gemini devolveu tempos além disso para um vídeo de 636 s. Em 2026-09-16, no vídeo de 837 s, o drift medido tinha sido de 1,118×.

As três chamadas recusadas foram conciliadas: 5.158, 5.079 e 3.253 tokens de saída (US$ 0,030 + 0,030 + 0,026). O volume sugere transcrição completa — o vídeo de 837 s que rendeu 78 trechos usou 5.676 tokens de saída. Mas é inferência: **nenhum número da linha do tempo sobrou para conferir**, porque `INVALID_TRANSCRIPT_TIME` é lançado depois do `infer` e o log `AI_INVALID_OUTPUT` criado nesta task só cobre a validação de schema, dentro do `infer`. É o mesmo defeito que a task corrigiu, sobrevivendo numa borda que ficou aberta.

### Correção adicional

`src/server/providers.ts`: as duas recusas pós-conciliação de `transcribeVideo` passam a registrar `AI_REJECTED_TRANSCRIPT` com código, duração, contagem de trechos, linha do tempo inteira, texto bruto e — o ponto — `lastEndMs` e `maxEndMs` **separados**. A separação existe porque há duas explicações possíveis, com correções opostas:

- **drift acumulado**, com todos os tempos esticados proporcionalmente: o reescalonamento linear resolve e `MAX_TIME_DRIFT = 1.5` é que está apertado;
- **um trecho isolado com tempo absurdo**: `Math.max` sobre todos os `endMs` deixa um único trecho ruim derrubar a transcrição inteira, e reescalar pioraria.

`tests/providers.test.ts` ganhou dois casos: o registro da linha do tempo recusada, e um que documenta a segunda sensibilidade — trechos terminando em 12 s, 9.990 s e 630 s num vídeo de 636 s deixam `lastEndMs` dentro da duração e só `maxEndMs` estoura, e ainda assim tudo é recusado.

### Decisão adiada e depois revertida

Numa primeira passagem `MAX_TIME_DRIFT` foi mantido em 1,5 à espera de um `AI_REJECTED_TRANSCRIPT` real. Foi erro de julgamento: o proprietário tentou de novo, a quinta chamada foi cobrada e recusada igual, e o custo de "esperar o dado" passou a ser maior que o de corrigir. Somadas, cinco tentativas nesse vídeo consumiram ~US$ 0,12 sem produzir um trecho.

O teto foi então corrigido pelo que ele de fato precisa discriminar:

- **`MAX_TIME_DRIFT` passou de 1,5 para 10.** 1,5 não separava drift de erro de unidade — erro de unidade é 1000× (segundos lidos como milissegundos) ou 60000× (minutos). 1,5 só recusava vídeo em que o modelo contou o tempo pior que a média. A mensagem do erro agora informa o fator medido.
- **A âncora do reescalonamento deixou de ser `Math.max` de todos os `endMs` e passou a ser o fim do último trecho.** `startMs` chega monotônico por contrato, então o último trecho é o encerramento real; um `endMs` solto no meio é defeito de um trecho e não pode mais decidir a escala nem derrubar a transcrição inteira.
- **Todo trecho é aparado dentro de `[0, durationMs]`**, inclusive quando não há reescalonamento. É o que neutraliza o trecho fora da curva sem descartar o resto.

Os dois testes escritos na passagem anterior para documentar o comportamento antigo passaram a falhar — sinal correto — e foram reescritos para o comportamento novo, mais dois testes de domínio.

### Pendências abertas por este complemento

- **Reescalonamento de drift grande não tem ground truth.** Com 1,56× de desvio, o alinhamento no meio do vídeo é hipótese linear, não medição. Os trechos continuam `approximate` e `ai_unreviewed`; se o destaque durante a reprodução ficar visivelmente fora, o caminho honesto é degradar a precisão declarada, não apertar o teto de novo.
- **Saldo travado:** 10 reservas em estado `unknown` somam 589.697 micros (US$ 0,59) do teto de US$ 1,00, sobra de chamadas ambíguas de 15 e 16/09. O consumo real do mês é US$ 0,19, mas o disponível caiu para US$ 0,22. Precisa de conciliação — assunto separado desta task.

## Handoff

Não aplicável enquanto a task avançar nesta sessão.

---
id: TASK-018
title: Ler letras no formato LRC no domínio
status: completed
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/domain/content.ts, tests/domain.test.ts, src/client/Study.tsx, scripts/integration.ts]
related_use_cases: [estudar música]
related_adrs: [ADR-009]
---

# TASK-018 — Ler letras no formato LRC no domínio

## Contexto
Primeira etapa do ADR-009. LRC é o formato de letra sincronizada do LRCLIB (e de quase todo player): uma linha por verso, com o tempo em que ela começa.

```text
[ti:Not You Too]
[ar:Drake]
[00:17.12] First time in a long time
[00:21.40] Hurtin' deeply inside
```

## Problema
`parseContent` só reconhece texto simples e SRT/VTT (detecta pelo `-->`). Um `.lrc` colado hoje vira texto simples com `[00:17.12]` dentro de cada trecho e sem tempo.

## Objetivo
`parseContent` reconhece LRC e devolve trechos com `startMs`/`endMs`, sem nenhuma rede. Isso já permite importar `.lrc` manualmente pelo formulário "Texto ou legenda".

## Fora de escopo
- Buscar letra em qualquer serviço (TASK-019).
- Sincronização por palavra (`<mm:ss.xx>` dentro da linha / `lines[].words` do Lyricsfile) — as marcas por palavra são removidas do texto nesta versão.

## Comportamento atual
Texto com `[mm:ss.xx]` cai no ramo de texto simples: `timeAccuracy: "none"` e marcas de tempo dentro do texto.

## Comportamento esperado
Detectado LRC, cada linha com tempo vira um trecho; o texto sai limpo.

## Regras de negócio
- RN-01: Detecção: pelo menos 2 linhas casando `^\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]`, e nenhum `-->` (SRT/VTT tem precedência).
- RN-02: `startMs` = tempo declarado na linha; `endMs` = `startMs` da próxima linha com texto. A última linha usa `[length:]` se existir; senão `endMs = null`. Isso não é interpolação: o fim de um verso é, por definição do formato, o início do seguinte.
- RN-03: `timeAccuracy = "approximate"` — tempo de comunidade, não alinhamento acústico.
- RN-04: Linha com várias marcas (`[00:12.00][01:30.00] refrão`) gera um trecho por marca; o resultado é ordenado por `startMs`.
- RN-05: Tags de metadado (`ti`, `ar`, `al`, `by`, `length`, `re`, `ve`) não viram trecho. `[offset:+/-ms]` é aplicado a todos os tempos (positivo adianta, conforme a convenção do formato).
- RN-06: Linhas com tempo e sem texto (pausas instrumentais) não viram trecho, mas encerram o trecho anterior.
- RN-07: Marcas por palavra `<mm:ss.xx>` são removidas do texto.
- RN-08: Os limites atuais continuam valendo (500 mil caracteres, `EMPTY_CONTENT`, trechos de até 1.200 caracteres).

## Critérios de aceitação
- [x] CA-01: LRC simples gera trechos com `startMs`/`endMs` corretos e `timeAccuracy: "approximate"`.
- [x] CA-02: Metadados ignorados; `[offset:]` aplicado; `[length:]` fecha a última linha.
- [x] CA-03: Marcas múltiplas por linha geram trechos ordenados.
- [x] CA-04: SRT, VTT e texto simples continuam com o mesmo resultado de antes (testes existentes intactos).
- [x] CA-05: Texto em prosa com um colchete eventual (`[sic]`) **não** é tratado como LRC.
- [x] CA-06: O formulário "Texto ou legenda" menciona que aceita `.lrc` (só texto de ajuda; nenhuma regra nova no cliente).

## Impacto técnico
### Backend
Nenhum — `POST /api/sources` já chama `parseContent`.
### Frontend
Texto de ajuda no `ImportForm` (`src/client/Study.tsx`).
### Banco de dados
Nenhum.
### Integrações
Nenhuma.
### Segurança
Parser puro; manter o limite de tamanho antes de qualquer regex.

## Plano de implementação
- [x] Extrair `parseLrc()` em `src/domain/content.ts` e chamá-lo em `parseContent` antes do ramo de texto simples.
- [x] Reaproveitar `time()` se compatível; senão um conversor próprio para `mm:ss.xx`.
- [x] Testes em `tests/domain.test.ts`, bloco "Fontes e proveniência".
- [x] Texto de ajuda no formulário.

## Estratégia de testes
- [x] Unitários: casos de RN-01 a RN-08 com fixtures curtas autorais (não usar letra real protegida nos testes).
- [x] Integração: um cenário importando `.lrc` como texto e conferindo `time_accuracy` no banco.
- [ ] Manual: importar um `.lrc` e conferir salto/loop de trecho na sala.

## Riscos e rollback
Falso positivo de detecção em prosa (mitigado por RN-01 e CA-05). Rollback: remover a chamada de `parseLrc` em `parseContent`.

## Registro de execução
### Alterações realizadas
- `parseContent` detecta LRC (`looksLikeLrc`, RN-01) antes do ramo de texto simples e delega a `parseLrc`. SRT/VTT têm precedência: qualquer `-->` desliga a detecção.
- `parseLrc` gera um evento por marca de tempo (RN-04), aplica `[offset:]` (positivo subtrai, RN-05), ordena de forma estável e fecha cada verso no próximo instante declarado — com ou sem texto (RN-02, RN-06). A última linha usa `[length:]` quando ele é maior que o início; senão `endMs = null`. Marcas por palavra `<mm:ss.xx>` saem do texto (RN-07). Tudo `timeAccuracy: "approximate"` (RN-03).
- Formulário "Texto ou legenda": placeholder, rótulo do botão de arquivo e `accept` passam a citar `.lrc` (CA-06). Nenhuma regra nova no cliente.
- Cenário de integração "LRC importado como texto grava tempo aproximado, sem metadado nem pausa".
### Arquivos principais
`src/domain/content.ts` · `tests/domain.test.ts` (+8 casos) · `src/client/Study.tsx` · `scripts/integration.ts`
### Decisões
- Conversor próprio `lrcTime()` em vez de `time()`: LRC circula com fração por `:` (`[00:17:12]`), que `time()` leria como hh:mm:ss. A fração é decimal (`.1` = 100 ms, `.12` = 120 ms, `.123` = 123 ms). Segundo ≥ 60 vira `INVALID_CAPTION`, como em `time()`.
- Linha sem marca de tempo que não seja metadado é ignorada, como o formato define. Linha com `[Chorus]` (sem dois-pontos) também é ignorada.
- `[offset:]` negativo atrasa; tempo deslocado abaixo de zero é preso em 0.
- `[length:]` malformado é descartado como metadado ruim (não derruba a importação); a última linha fica sem fim.
- RN-08: o limite de 500 mil caracteres e `EMPTY_CONTENT` continuam antes de qualquer regex. Um verso acima de 1.200 caracteres é recusado com `INVALID_CAPTION` em vez de ser fatiado — fatiar exigiria repetir ou inventar tempo para os pedaços. LRC sem nenhum verso com texto também é `INVALID_CAPTION`. Teto de 10 mil trechos, igual ao SRT/VTT.
### Divergências
- Ambiente: o container `fluentquest-postgres` e os `.env` descritos em 30/09 não existiam nesta máquina. Com autorização do proprietário (14/10), foram recriados: container `postgres:18` (18.6) em `127.0.0.1:5433`, volume novo `fluentquest-pgdata`, **sem** `--restart unless-stopped` (precisa ser iniciado à mão com `docker start fluentquest-postgres`), `.env.setup`/`.env.local`/`.env.owner` novos, proprietário de teste `estudante@fluentquest.local` (o e-mail que a tela de login pré-preenche e de que `accessibility-qa.mjs` depende). `node_modules` também não existia; foi instalado com `npm ci`.
### Pendências
- Verificação manual de salto/loop na sala com um `.lrc`: não feita. Fonte só de texto não tem player; o salto/loop com tempo real só se aplica a partir da TASK-020 (letra + vídeo) e é o objeto da TASK-022.
- Achado fora de escopo: `scripts/source-qa.mjs` (dentro de `qa-isolated.ts`) falha com 2–3 violações axe nas quatro variantes, **todas dentro do iframe do player do YouTube** (`#widget2` → `.ytmVideoInfoVideoTitle` `aria-level`, `#movie_player` `aria-label`, `.ytmVideoInfoChannelAvatar` sem nome). É marcação de terceiros, não do FluentQuest, e não tem relação com esta task. Precisa de decisão: excluir o iframe do escopo do axe em `source-qa.mjs` ou aceitar.

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

Resultados de 2026-10-14:
- `npm run typecheck`: sem erros.
- `npm test`: 79/79 (71 antes + 8 de LRC).
- `npm run test:integration`: 42/42 (41 antes + 1 de LRC), nenhuma chamada de IA.
- `npx tsx --env-file=.env.local scripts/qa-isolated.ts` (após `npm run build`): `browser-qa` sem erros nem overflow; `accessibility-qa` com `violations: []` nas 9 rotas (hoje, biblioteca, praticar, revisar, jornada, configurações, onboarding, estudo, configurações escuro mobile); `source-qa` com as violações do iframe do YouTube descritas em Pendências.

## Handoff

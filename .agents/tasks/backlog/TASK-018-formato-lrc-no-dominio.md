---
id: TASK-018
title: Ler letras no formato LRC no domínio
status: backlog
type: feature
owner: fontes-proveniencia
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/domain/content.ts, tests/domain.test.ts, src/client/Study.tsx]
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
- [ ] CA-01: LRC simples gera trechos com `startMs`/`endMs` corretos e `timeAccuracy: "approximate"`.
- [ ] CA-02: Metadados ignorados; `[offset:]` aplicado; `[length:]` fecha a última linha.
- [ ] CA-03: Marcas múltiplas por linha geram trechos ordenados.
- [ ] CA-04: SRT, VTT e texto simples continuam com o mesmo resultado de antes (testes existentes intactos).
- [ ] CA-05: Texto em prosa com um colchete eventual (`[sic]`) **não** é tratado como LRC.
- [ ] CA-06: O formulário "Texto ou legenda" menciona que aceita `.lrc` (só texto de ajuda; nenhuma regra nova no cliente).

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
- [ ] Extrair `parseLrc()` em `src/domain/content.ts` e chamá-lo em `parseContent` antes do ramo de texto simples.
- [ ] Reaproveitar `time()` se compatível; senão um conversor próprio para `mm:ss.xx`.
- [ ] Testes em `tests/domain.test.ts`, bloco "Fontes e proveniência".
- [ ] Texto de ajuda no formulário.

## Estratégia de testes
- [ ] Unitários: casos de RN-01 a RN-08 com fixtures curtas autorais (não usar letra real protegida nos testes).
- [ ] Integração: um cenário importando `.lrc` como texto e conferindo `time_accuracy` no banco.
- [ ] Manual: importar um `.lrc` e conferir salto/loop de trecho na sala.

## Riscos e rollback
Falso positivo de detecção em prosa (mitigado por RN-01 e CA-05). Rollback: remover a chamada de `parseLrc` em `parseContent`.

## Registro de execução
### Alterações realizadas
### Arquivos principais
### Decisões
### Divergências
### Pendências

## Validação
`npm run typecheck` · `npm test` · `npm run test:integration`

## Handoff

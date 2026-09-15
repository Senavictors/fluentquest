# Domínio

O domínio do FluentQuest é pequeno e deliberadamente puro: vive inteiro em `src/domain/`, não conhece HTTP nem banco, e é o único lugar onde regras de conteúdo e de revisão são decididas.

## Conceitos centrais

| Conceito | O que é | Onde vive |
|---|---|---|
| **Fonte** | Material escolhido pelo proprietário: URL do YouTube, texto, legenda SRT/VTT ou mídia própria. Carrega autor, idioma, direitos e consentimento. | `sources`, validada por `sourceInput` |
| **Trecho (segmento)** | Unidade de leitura de uma fonte, com `origin`, `time_accuracy` e `quality_status` — a proveniência viaja junto com o texto. | `segments`, produzida por `parseContent` |
| **Atividade (unidade de aprendizagem)** | Exercício de produção ligado a uma fonte ou a um cenário autoral. Nunca entrega a resposta de referência antes da tentativa. | `learning_units`, `scenarios` |
| **Tentativa** | Resposta escrita ou falada do proprietário, com ou sem ajuda, opcionalmente ligada a uma gravação. | `attempts` |
| **Gravação** | Áudio do proprietário, com consentimento, duração verificada e expiração padrão de 7 dias. | `recordings` |
| **Cartão** | Expressão + sentido + exemplo, confirmados pelo proprietário. Único por `(expressão normalizada, sentido normalizado, modo)`. | `cards` |
| **Revisão** | Aplicação de uma nota 1–4 ao cartão, agendando o próximo encontro por FSRS, com evento reversível. | `review_events` |
| **XP e nível** | Registro de prática, não de proficiência. Idempotente por `(user_id, origin_id, rule)`. | `xp_events` |

## Invariantes do domínio

1. **Proveniência nunca é inventada.** Texto simples entra com `time_accuracy: 'none'`; legenda preserva o tempo aproximado que o arquivo declara. Nada alega alinhamento acústico.
2. **Deduplicação não funde sentidos.** A mesma expressão com significado diferente é outro cartão.
3. **Notas de revisão são 1, 2, 3 ou 4** — qualquer outra é rejeitada em `scheduleCard`.
4. **Recompensa é única por origem e regra**, garantida por restrição do banco e não por verificação em código.
5. **XP não mede proficiência** e nunca é concedido por reprodução de mídia.

## Onde ler o código

- `src/domain/content.ts` — fontes, parsing, proveniência, schemas Zod e `AppError`.
- `src/domain/review.ts` — FSRS e progressão de XP.
- `tests/domain.test.ts` — 11 casos que documentam as invariantes acima em forma executável.

Papéis responsáveis: [`fontes-proveniencia`](../../.claude/agents/fontes-proveniencia.md) e [`dominio-revisao`](../../.claude/agents/dominio-revisao.md).

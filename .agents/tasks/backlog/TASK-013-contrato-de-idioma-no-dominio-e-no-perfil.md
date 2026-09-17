---
id: TASK-013
title: Idioma de estudo no contrato do domínio e língua de explicação no perfil
status: backlog
type: feature
owner:
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules:
  [src/domain/content.ts, src/server/api.ts, src/server/schema.ts, migrations]
related_use_cases: [Importar fonte, Criar cartão, Ajustar perfil]
related_adrs: [ADR-006]
---

# TASK-013 — Idioma de estudo no contrato do domínio e língua de explicação no perfil

## Contexto

Primeira das três tasks de ADR-006. É a que abre o contrato; as outras duas dependem dela.

## Problema

`sourceInput.language` e `cardInput.language` são `z.enum(["en-US","en-GB"])`. Nenhum idioma além de inglês atravessa a validação, mesmo com o banco aceitando (`sources.language` e `cards.language` são `text`, e a chave única de cartão já inclui `language`).

## Objetivo

O domínio aceita uma lista fechada de idiomas de estudo, e o perfil passa a declarar a língua de explicação em `learner_profiles.locale` — coluna que existe desde a migração 001 e nunca foi lida nem escrita.

## Fora de escopo

- Prompts (TASK-014).
- Qualquer tela (TASK-015).
- Nível por idioma: `difficulty` continua global e ambíguo, por decisão registrada em ADR-006.

## Comportamento atual

Qualquer fonte nasce `en-US`, porque o cliente envia fixo e o enum não aceita outra coisa. `locale` é coluna morta.

## Comportamento esperado

`POST /api/sources` e `POST /api/cards` aceitam qualquer idioma da lista suportada e recusam o resto com `AppError` legível. `PATCH /api/profile` aceita `explanationLanguage`, persistido em `locale`. Sem idioma informado, o default continua `en-US` — nenhuma fonte existente muda de comportamento.

## Regras de negócio

- RN-01: a lista de idiomas suportados é uma constante única em `src/domain/content.ts`. Não pode haver uma segunda lista no servidor ou no cliente.
- RN-02: o cartão herda o idioma da fonte de origem; quando não há fonte, usa o idioma informado, com o mesmo default.
- RN-03: `normalize()` passa a receber o idioma e usar `toLocaleLowerCase(<idioma>)` — hoje aplica regra de inglês inclusive ao significado em português.
- RN-04: `english_variant` permanece, rebaixada a preferência de variedade quando a fonte é inglês. Não vira seletor de idioma e não muda de nome (evita migração de dados; o nome desalinhado é anotado, não corrigido).
- RN-05: nenhum dado existente é migrado. Fonte e cartão já gravados continuam `en-US`.

## Critérios de aceitação

- [ ] CA-01: criar fonte em um idioma novo da lista persiste esse idioma e é recusada fora da lista.
- [ ] CA-02: cartão criado a partir de uma fonte herda o idioma dela.
- [ ] CA-03: dois cartões com a mesma expressão em idiomas diferentes coexistem (a chave única já inclui `language`).
- [ ] CA-04: `PATCH /api/profile` grava `explanationLanguage` em `locale` e o bootstrap o devolve.
- [ ] CA-05: requisição sem `language` continua resultando em `en-US`.
- [ ] CA-06: `normalize()` com idioma de casing próprio não produz o resultado da regra inglesa.

## Impacto técnico

### Backend

`src/domain/content.ts`: constante de idiomas suportados, `sourceInput`/`cardInput` abertos, `normalize(value, language)`. `src/server/api.ts`: propagação do idioma na criação de cartão e `explanationLanguage` no schema Zod do perfil.

### Frontend

Nenhum nesta task — o cliente continua mandando `en-US` fixo até TASK-015.

### Banco de dados

Nenhuma migração. `locale` já existe com default `pt-BR`; `src/server/schema.ts` já a espelha.

### Integrações

Nenhuma.

### Segurança

Idioma é entrada do usuário e entra em prompt na TASK-014 — precisa ser validado contra a lista fechada, nunca repassado como texto livre.

## Plano de implementação

- [ ] Etapa 1 — constante de idiomas e abertura dos dois schemas Zod.
- [ ] Etapa 2 — `normalize()` por idioma e ajuste dos pontos de chamada.
- [ ] Etapa 3 — herança de idioma da fonte para o cartão.
- [ ] Etapa 4 — `explanationLanguage` no perfil sobre `locale`.

## Estratégia de testes

- [ ] Unitários — `tests/domain.test.ts`: lista fechada, default, `normalize()` por idioma, coexistência de expressões iguais em idiomas diferentes.
- [ ] Integração — `scripts/integration.ts`: fonte em idioma novo, herança no cartão, recusa fora da lista, perfil com língua de explicação.
- [ ] E2E — não há suíte.
- [ ] Manual — não aplicável (sem tela).

## Riscos e rollback

- Risco: ampliar o enum sem propagar para os prompts faz uma fonte em espanhol ser transcrita com prompt de inglês. Mitigação: TASK-014 é pré-requisito para liberar a escolha na tela (TASK-015).
- Rollback: reverter os schemas Zod; nenhum dado foi migrado.

## Registro de execução

### Alterações realizadas

### Arquivos principais

### Decisões

### Divergências

### Pendências

## Validação

## Handoff

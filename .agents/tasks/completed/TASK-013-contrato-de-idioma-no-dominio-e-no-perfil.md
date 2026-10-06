---
id: TASK-013
title: Idioma de estudo no contrato do domínio e língua de explicação no perfil
status: active
type: feature
owner: fontes-proveniencia
created_at: 2026-09-17
updated_at: 2026-09-28
affected_modules:
  [src/domain/content.ts, src/server/api.ts, docs/API.md, tests/domain.test.ts, scripts/integration.ts]
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

- [x] CA-01: criar fonte em um idioma novo da lista persiste esse idioma e é recusada fora da lista.
- [x] CA-02: cartão criado a partir de uma fonte herda o idioma dela.
- [x] CA-03: dois cartões com a mesma expressão em idiomas diferentes coexistem (a chave única já inclui `language`).
- [x] CA-04: `PATCH /api/profile` grava `explanationLanguage` em `locale` e o bootstrap o devolve.
- [x] CA-05: requisição sem `language` continua resultando em `en-US`.
- [x] CA-06: `normalize()` com idioma de casing próprio não produz o resultado da regra inglesa.

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

- [x] Etapa 1 — constante de idiomas e abertura dos dois schemas Zod.
- [x] Etapa 2 — `normalize()` por idioma e ajuste dos pontos de chamada.
- [x] Etapa 3 — herança de idioma da fonte para o cartão.
- [x] Etapa 4 — `explanationLanguage` no perfil sobre `locale`.

## Estratégia de testes

- [x] Unitários — `tests/domain.test.ts`: lista fechada, default, `normalize()` por idioma, coexistência de expressões iguais em idiomas diferentes.
- [x] Integração — `scripts/integration.ts`: fonte em idioma novo, herança no cartão, recusa fora da lista, perfil com língua de explicação. Escrita e revisada; **não executada nesta sessão** (ver Pendências).
- [ ] E2E — não há suíte.
- [ ] Manual — não aplicável (sem tela).

## Riscos e rollback

- Risco: ampliar o enum sem propagar para os prompts faz uma fonte em espanhol ser transcrita com prompt de inglês. Mitigação: TASK-014 é pré-requisito para liberar a escolha na tela (TASK-015).
- Rollback: reverter os schemas Zod; nenhum dado foi migrado.

## Registro de execução

### Alterações realizadas

- `src/domain/content.ts`: `SUPPORTED_LANGUAGES` (12 idiomas: `en-US`, `en-GB`, `es-ES`, `es-AR`, `es-CL`, `es-MX`, `it-IT`, `fr-FR`, `zh-CN`, `ja-JP`, `ru-RU`, `pt-BR`) e o tipo `SupportedLanguage`, únicos no domínio (RN-01) — usados tanto pelo idioma de estudo (`sourceInput`/`cardInput`) quanto pela língua de explicação do perfil. `normalize(value, language)` passou a receber o idioma em vez de fixar `toLocaleLowerCase("en")` (RN-03); a assinatura usa `language: string`, não `SupportedLanguage`, porque a regra de casing do `Intl` é ortogonal à política de idiomas do produto. `sourceInput.language` e `cardInput.language` trocaram `z.enum(["en-US","en-GB"])` por `z.enum(SUPPORTED_LANGUAGES)`, mesmo default `en-US`.
- `src/server/api.ts`: `POST /api/cards` passou a capturar a fonte (antes o resultado de `sourceFor` era descartado) e usar `source.language` quando há `sourceId`, caindo para `input.language` só sem fonte (RN-02). O significado (`meaning`) passou a normalizar na língua de explicação do perfil (`learner_profiles.locale`, busca adicional só nesta rota), e a expressão no idioma resolvido do cartão — antes as duas usavam a regra fixa de inglês (RN-03). `PATCH /api/profile` ganhou `explanationLanguage: z.enum(SUPPORTED_LANGUAGES)` no schema Zod, gravado no campo `locale` da tabela (nomes diferentes: o Zod usa o nome do conceito, a coluna já existia com outro nome desde a 001).
- `tests/domain.test.ts`: lista fechada aceitando idioma novo e recusando fora dela; `normalize()` com `tr-TR` provando que a regra de casing muda com o idioma (CA-06 usa turco porque é o exemplo clássico de casing dependente de locale — `tr-TR` não está em `SUPPORTED_LANGUAGES`, e não precisa estar, porque `normalize()` é utilitário puro de `Intl`); dois `cardInput` com mesma expressão/sentido e idiomas diferentes parseando sem colisão.
- `scripts/integration.ts`: seis cenários novos após "Cartões equivalentes não duplicam" — fonte em `es-ES` persistida, idioma fora da lista recusado, cartão herdando idioma da fonte mesmo sem declarar `language`, mesma expressão coexistindo em `es-ES` e `en-US`, fonte sem idioma informado permanecendo `en-US`, e `PATCH /api/profile` com `explanationLanguage` refletido em `bootstrap().profile.locale`.
- `docs/API.md`: linhas de `POST /api/sources`, `POST /api/cards` e `PATCH /api/profile` documentam a lista fechada, a herança de idioma no cartão e `explanationLanguage`→`locale`, com referência a ADR-006. `ultima-revisao` carimbada.

### Decisões

- **`normalize()` recebe `language: string`, não `SupportedLanguage`.** A função é utilitário puro de casing; amarrar seu tipo à política de idiomas do produto obrigaria toda chamada a validar contra `SUPPORTED_LANGUAGES` mesmo quando o valor já veio validado de outro lugar (ex.: `profile.locale`, que é `text` no banco e pode não ter sido migrado quando a lista mudar).
- **Buscar `profile.locale` dentro de `POST /api/cards`.** RN-03 diz que a regra de casing errada valia "inclusive ao significado em português" — corrigir só a expressão e deixar o significado com a regra fixa de inglês seria meia correção do mesmo defeito que a regra descreve. O custo é uma consulta adicional, indexada pela chave primária de `learner_profiles`.
- **`explanationLanguage` valida contra a mesma `SUPPORTED_LANGUAGES` do idioma de estudo**, não uma lista própria — RN-01 proíbe uma segunda lista, e a nota de Segurança da task cobre "idioma" de forma geral, não só o de estudo.
- **Lista de idiomas decidida com o proprietário nesta sessão** (não estava especificada na task nem no ADR-006): inglês (US/GB), espanhol (ES/AR/CL/MX), italiano, francês, mandarim, japonês, russo — mais português (BR), exigido porque é o valor default de `locale` e precisa validar como `explanationLanguage`.

### Divergências

Nenhuma em relação ao plano original da task.

### Pendências

- **`npm run test:integration` não foi executado nesta sessão.** Não há `.env.setup` no repositório nem serviço PostgreSQL rodando nesta máquina (confirmado por `Get-Service '*postgres*'` sem resultado) — consistente com o que TASK-016 já registrou em 19/09: banco local antigo indisponível, ainda sem substituto configurado. Os seis cenários novos estão escritos e revisados contra o padrão dos cenários vizinhos, mas não foram rodados de verdade contra Postgres.
- **`npm run build` falha antes de chegar à rota afetada**, por `.env.local` vazio (`BETTER_AUTH_SECRET` ausente) — falha pré-existente, não relacionada a esta task. A compilação TypeScript do build ("Compiled successfully", "Finished TypeScript") passou; o erro é só na coleta de dados de página de `/api/auth/[...all]`.
- Recomendo rodar `npm run test:integration` assim que houver Postgres acessível (local ou o projeto Railway dedicado que TASK-016 está preparando) antes de mover esta task para `completed/`.

## Validação

- `npm run typecheck`: passou, sem erros.
- `npm test`: 65/65.
- `npm run build`: compilação TypeScript passou; falha na coleta de dados de `/api/auth/[...all]` por `.env.local` vazio — ambiente, não código (ver Pendências).
- `npm run test:integration`: **não executado** — sem `.env.setup`/Postgres nesta máquina (ver Pendências).
- `node scripts/accessibility-qa.mjs`: não aplicável — nenhuma tela mudou nesta task.

## Handoff

Task fica em `active/`, não em `completed/`, porque a evidência de integração está pendente (ver Pendências). Para continuar: obter acesso a um Postgres (local, restaurando `.env.setup`, ou o projeto Railway de TASK-016), rodar `npm run test:integration` e, se os seis cenários novos passarem, mover para `completed/` via `bootstrap-complete`. Só depois faz sentido iniciar TASK-014 (prompts parametrizados por idioma), que depende deste contrato.

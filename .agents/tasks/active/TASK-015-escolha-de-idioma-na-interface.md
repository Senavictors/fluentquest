---
id: TASK-015
title: Escolha de idioma na importação, rótulo na biblioteca e filtro na revisão
status: active
type: feature
owner: interface-editorial
created_at: 2026-09-17
updated_at: 2026-09-28
affected_modules:
  [
    src/client/Study.tsx,
    src/client/Practice.tsx,
    src/client/Settings.tsx,
    src/client/types.ts,
    src/client/languages.ts,
    src/app/globals.css,
  ]
related_use_cases: [Importar fonte, Revisar, Ajustar perfil]
related_adrs: [ADR-006]
---

# TASK-015 — Escolha de idioma na importação, rótulo na biblioteca e filtro na revisão

## Contexto

Terceira das três tasks de ADR-006. Depende de TASK-013 e TASK-014 — liberar a escolha na tela antes dos prompts parametrizados entregaria uma fonte em espanhol transcrita com prompt de inglês.

## Problema

O idioma nunca é perguntado: `src/client/Study.tsx:314` envia `language: "en-US"` fixo. A tela não mostra o idioma de uma fonte nem de um cartão, e `Practice.tsx:652` alterna `lang` entre `pt-BR` e `en` na marra — o que vira defeito de acessibilidade assim que existir uma terceira possibilidade, porque o leitor de tela pronuncia com a fonética errada.

## Objetivo

O proprietário escolhe o idioma ao importar, vê de que idioma é cada fonte e cada cartão, e pode filtrar a revisão por idioma. Idioma sem conteúdo autoral diz isso na tela.

## Fora de escopo

- Traduzir a interface: o texto de tela continua em pt-BR, conforme a regra global do projeto.
- Escrever pacote de exemplo, cenários ou diagnóstico em outro idioma.
- Nível (`difficulty`) por idioma — ambiguidade registrada em ADR-006, não resolvida aqui.

## Comportamento atual

Importação sem campo de idioma; biblioteca e revisão sem rótulo; `lang` binário.

## Comportamento esperado

Campo de idioma no formulário de importação, com `en-US` pré-selecionado. Rótulo de idioma na fonte e no cartão. Filtro opcional por idioma na revisão, com o baralho misto como padrão. `lang` derivado do idioma real do conteúdo, não de um ternário. O seletor de variedade `en-US`/`en-GB` só aparece quando a fonte é inglês.

## Regras de negócio

- RN-01: texto de interface em pt-BR; conteúdo de estudo no idioma da fonte.
- RN-02: `lang` do elemento sempre reflete o idioma real daquele conteúdo — é acessibilidade, não detalhe.
- RN-03: idioma sem pacote de exemplo, cenários ou diagnóstico declara essa ausência, em vez de mostrar o conteúdo em inglês como se fosse daquele idioma ou esconder a seção sem explicação.
- RN-04: o filtro de revisão é preferência de tela; não vira estado de servidor sem necessidade.

## Critérios de aceitação

- [x] CA-01: importar uma fonte escolhendo um idioma da lista persiste esse idioma.
- [x] CA-02: biblioteca e revisão mostram o idioma de cada item.
- [x] CA-03: o filtro por idioma na revisão funciona e o padrão continua misto.
- [x] CA-04: `lang` corresponde ao idioma do conteúdo em todos os pontos onde hoje é ternário.
- [x] CA-05: com um idioma sem conteúdo autoral, a tela declara a ausência de exemplo, cenários e diagnóstico.
- [x] CA-06: a variedade en-US/en-GB só aparece em contexto de inglês.
- [ ] CA-07: `node scripts/accessibility-qa.mjs` sem violações, e sem transbordamento em 390×844, claro e escuro.

## Impacto técnico

### Backend

Nenhum, se TASK-013 e TASK-014 estiverem prontas — exceto o filtro por idioma na consulta de revisão, se for feito no servidor.

### Frontend

`Study.tsx` (campo de idioma, rótulo na fonte), `Practice.tsx` (`lang` correto, filtro, rótulo no cartão), `Settings.tsx` (língua de explicação, variedade condicional, aviso de conteúdo autoral ausente), CSS do campo e do filtro.

### Banco de dados

Nenhum.

### Integrações

Nenhuma.

### Segurança

Idioma escolhido é validado no servidor contra a lista fechada — o cliente não é fonte de verdade.

## Plano de implementação

- [x] Etapa 1 — campo de idioma na importação.
- [x] Etapa 2 — rótulo de idioma em fonte e cartão; `lang` derivado do conteúdo.
- [x] Etapa 3 — filtro por idioma na revisão.
- [x] Etapa 4 — perfil: língua de explicação e variedade condicional.
- [x] Etapa 5 — aviso honesto de conteúdo autoral ausente.

## Estratégia de testes

- [x] Unitários — não aplicável (tela).
- [x] Integração — já coberta pelos cenários de TASK-013 (`scripts/integration.ts`): o contrato `POST /api/sources` persistir o `language` enviado já estava testado; esta task só troca o valor fixo `en-US` pela escolha real do formulário, sem mudar o contrato.
- [ ] E2E — não há suíte.
- [ ] Manual — **não executado nesta sessão** (ver Pendências): `node scripts/accessibility-qa.mjs` exige servidor web rodando com PostgreSQL acessível e login do proprietário; nenhum dos dois está disponível nesta máquina.

## Riscos e rollback

- Risco: `lang` errado é invisível em teste automatizado e audível em leitor de tela. Conferir no axe e por inspeção.
- Risco: o aviso de conteúdo ausente fica ruidoso se repetido em toda tela. Dizer uma vez, no lugar onde a ausência aparece.
- Rollback: reverter o cliente; fontes já criadas em outro idioma continuam válidas no banco.

## Registro de execução

### Alterações realizadas

- `src/client/languages.ts` (novo): `LANGUAGE_LABELS` (rótulo em pt-BR de cada `SupportedLanguage`, importada de `src/domain/content.ts` — primeira vez que o cliente importa de `src/domain/`, viável porque o módulo é puro, só depende de `zod`), `languageLabel()`, `STUDY_LANGUAGE_OPTIONS` (inglês como entrada única, as demais linguas achatadas) e `isEnglish()`.
- `src/client/types.ts`: `locale` em `Profile`; `language` em `ReviewCard` (a coluna já vinha do servidor via `SELECT c.*`, só faltava no tipo do cliente).
- `src/client/Study.tsx`: `ImportForm` ganhou o campo "Idioma do conteúdo" (lista fechada, `en-US` pré-selecionado) e, condicionalmente, "Variedade do inglês" (RN-04/CA-06); aviso quando o idioma escolhido não é inglês (RN-03/CA-05). Biblioteca e cabeçalho da sala mostram o rótulo em pt-BR do idioma da fonte (CA-02). Todos os `lang="en"` fixos que renderizavam conteúdo de estudo (trecho selecionado, transcrição, vocabulário, apoio de trecho, editor de cartão, resposta da atividade) passaram a usar o idioma real da fonte (RN-02/CA-04) — não só o único ternário que existia (`Player`'s leitura), mas todo ponto que ficaria audivelmente errado com uma fonte não inglesa. Rótulos "Expressão/Exemplo/Sua resposta em inglês" viraram dinâmicos.
- `src/client/Practice.tsx`: `Reviews()` ganhou filtro de idioma client-side (RN-04: preferência de tela, não estado de servidor) com fallback automático para "todos" se o idioma filtrado deixar de existir na fila; `current.language` substitui os `lang="en"`/`"pt-BR"` fixos e o ternário de `lang` do card; síntese de voz (`listen()`) usa o idioma real em vez de `"en-US"` fixo; rótulo de idioma no rodapé do cartão (CA-02).
- `src/client/Settings.tsx`: bloco novo "Idioma" em Preferências — língua de explicação (lista fechada completa, grava via `PATCH /api/profile explanationLanguage`) e variedade do inglês, esta última condicional a existir pelo menos uma fonte `en-US`/`en-GB` na biblioteca (CA-06). O seletor "Variedade preferida" saiu do Onboarding — lá não existe nenhuma fonte ainda, então nunca poderia satisfazer CA-06 de forma honesta. Texto do rodapé do Onboarding deixou de afirmar "Prática em inglês".
- `src/app/globals.css`: `.review-filter`, reaproveitando o padrão de `label.search` para o filtro de idioma caber na mesma linha de `.review-progress`.

### Decisões

- **Cliente importa `SUPPORTED_LANGUAGES` de `src/domain/content.ts` em vez de duplicar a lista.** RN-01 de TASK-013 proíbe uma segunda lista de códigos; `content.ts` não tem dependência de servidor (só `zod`), e `npm run build` confirmou que o bundle do cliente compila sem problema com esse import. `LANGUAGE_LABELS` (pt-BR, para a tela) e `LANGUAGE_NAMES` (inglês, para prompt em `providers.ts`) são duas *traduções* da mesma lista, não duas listas — RN-01 é sobre os códigos, não sobre os rótulos.
- **Inglês entra como uma entrada única no seletor de idioma da importação, com a variedade como controle separado só quando aplicável.** Só o inglês tem uma coluna de perfil dedicada à variedade (`englishVariant`, de antes de ADR-006); espanhol não tem "spanishVariant" equivalente, então suas 4 variantes ficam achatadas na lista principal sem tratamento especial — o CA-06 só cita en-US/en-GB, e inventar agrupamento para espanhol seria escopo não pedido.
- **`englishVariant` saiu do Onboarding e entrou em Preferências, condicional a existir fonte em inglês.** Manter em Onboarding violaria CA-06 de forma estrutural, porque onboarding nunca tem uma fonte para satisfazer "só aparece quando a fonte é inglês". Preferências tem acesso a `data.sources` e pode checar a condição de verdade.
- **Aviso de conteúdo autoral ausente fica só na importação, uma vez**, conforme o risco já registrado na própria task ("dizer uma vez, no lugar onde a ausência aparece") — não repeti em Praticar, porque os cenários já eram fixos em inglês antes desta task e nada aqui piora essa ambiguidade.

### Divergências

Nenhuma em relação ao plano original da task.

### Pendências

- **`node scripts/accessibility-qa.mjs` não foi executado nesta sessão.** O script abre `http://localhost:3215`, faz login do proprietário e precisa de PostgreSQL acessível — nesta máquina não há banco rodando (mesma lacuna de TASK-013/TASK-014/TASK-016). Tentei subir o servidor de desenvolvimento para uma verificação visual mínima: o cliente compila e renderiza (confirmado por `npm run build` e pelo preview, que carregou a casca da aplicação), mas `GET /api/bootstrap` falha com `ECONNREFUSED` antes de qualquer tela autenticada aparecer — não há como exercitar o formulário de importação, a revisão ou o axe sem banco.
- **Nenhuma conferência de transbordamento em 1440×1000/390×844, claro/escuro foi feita**, pela mesma razão.
- Recomendo rodar `npm run test:integration` e `node scripts/accessibility-qa.mjs` juntos, assim que houver Postgres acessível — isso resolveria a pendência desta task e das TASK-013/TASK-014 na mesma sessão.

## Validação

- `npm run typecheck`: passou, sem erros.
- `npm test`: 71/71 (sem testes novos — task não altera domínio nem servidor).
- `npm run build`: compilação e bundling do cliente passaram, incluindo o import novo de `src/domain/content.ts` no cliente ("Compiled successfully", "Finished TypeScript"); a falha na coleta de dados de `/api/auth/[...all]` por `.env.local` vazio é ambiente, não código (mesma lacuna já registrada em TASK-013/TASK-014).
- Preview manual: servidor de desenvolvimento sobe e a casca da aplicação renderiza; sem PostgreSQL, `GET /api/bootstrap` retorna 500 e a tela autenticada nunca carrega — não foi possível ir além disso.
- `node scripts/accessibility-qa.mjs`: **não executado** (ver Pendências).

## Handoff

Task fica em `active/`, não em `completed/`: o código está implementado, com `typecheck`, `test` e `build` verdes, mas a verificação visual e de acessibilidade (CA-07) não pôde ser feita nesta máquina, sem Postgres. Assim que houver banco acessível: `npm run dev`, login do proprietário, testar a importação em pelo menos um idioma não inglês (verificar herança no cartão, rótulo na biblioteca, `lang` correto por inspeção ou leitor de tela), o filtro de revisão com dois idiomas na fila, e rodar `node scripts/accessibility-qa.mjs`. Se tudo passar, mover TASK-013, TASK-014 e TASK-015 para `completed/` juntas — as três dependem da mesma verificação pendente.

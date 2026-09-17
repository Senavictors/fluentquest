---
id: TASK-015
title: Escolha de idioma na importação, rótulo na biblioteca e filtro na revisão
status: backlog
type: feature
owner:
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules:
  [
    src/client/Study.tsx,
    src/client/Practice.tsx,
    src/client/Settings.tsx,
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

- [ ] CA-01: importar uma fonte escolhendo um idioma da lista persiste esse idioma.
- [ ] CA-02: biblioteca e revisão mostram o idioma de cada item.
- [ ] CA-03: o filtro por idioma na revisão funciona e o padrão continua misto.
- [ ] CA-04: `lang` corresponde ao idioma do conteúdo em todos os pontos onde hoje é ternário.
- [ ] CA-05: com um idioma sem conteúdo autoral, a tela declara a ausência de exemplo, cenários e diagnóstico.
- [ ] CA-06: a variedade en-US/en-GB só aparece em contexto de inglês.
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

- [ ] Etapa 1 — campo de idioma na importação.
- [ ] Etapa 2 — rótulo de idioma em fonte e cartão; `lang` derivado do conteúdo.
- [ ] Etapa 3 — filtro por idioma na revisão.
- [ ] Etapa 4 — perfil: língua de explicação e variedade condicional.
- [ ] Etapa 5 — aviso honesto de conteúdo autoral ausente.

## Estratégia de testes

- [ ] Unitários — não aplicável (tela).
- [ ] Integração — fonte criada com idioma escolhido chega ao banco com esse idioma.
- [ ] E2E — não há suíte.
- [ ] Manual — `node scripts/accessibility-qa.mjs` e conferência de transbordamento em 1440×1000 e 390×844, claro e escuro.

## Riscos e rollback

- Risco: `lang` errado é invisível em teste automatizado e audível em leitor de tela. Conferir no axe e por inspeção.
- Risco: o aviso de conteúdo ausente fica ruidoso se repetido em toda tela. Dizer uma vez, no lugar onde a ausência aparece.
- Rollback: reverter o cliente; fontes já criadas em outro idioma continuam válidas no banco.

## Registro de execução

### Alterações realizadas

### Arquivos principais

### Decisões

### Divergências

### Pendências

## Validação

## Handoff

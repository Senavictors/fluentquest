---
id: TASK-023
title: Recolher a barra lateral de qualquer altura de janela e o painel de ferramentas da sala
status: completed
type: feature
owner: interface-editorial
created_at: 2026-10-14
updated_at: 2026-10-14
affected_modules: [src/client/App.tsx, src/client/Study.tsx, src/app/globals.css, scripts/layout-qa.mjs, scripts/qa-isolated.ts, docs/ui/README.md]
related_use_cases: [estudar com mais espaço para a transcrição]
related_adrs: []
---

# TASK-023 — Recolher a barra lateral de qualquer altura de janela e o painel de ferramentas da sala

## Contexto
Pedido do proprietário em 2026-10-14, com print de produção (Railway): "opção de minimizar a sidebar" e "opção de minimizar o trecho Expressão, Tutor, Atividade, porque a transcrição fica muito pequena, principalmente em texto sem vídeo".

## Problema
- A barra lateral já recolhe para um trilho de 64 px (botão "Recolher", desde 2026-09-16), mas o botão fica **no rodapé** da barra, depois do orçamento e do perfil. A barra tem `height: 100dvh` sem rolagem: numa janela baixa ou com zoom alto (o caso do print) o rodapé sai da tela e o botão fica inalcançável — para o proprietário, a opção não existe.
- O painel "Expressão / Tutor / Atividade" ocupa 300–350 px fixos ao lado da transcrição e não pode ser recolhido.

## Objetivo
- Botão de recolher/expandir a barra sempre visível, em qualquer altura de janela.
- Painel de ferramentas recolhível para um trilho fino com botão de reabrir, lembrado no navegador.

## Fora de escopo
- Mudar o trilho de 64 px da barra (decisão do proprietário: manter).
- Celular e faixa empilhada (≤ 1000 px): ali o painel já fica abaixo do conteúdo, em coluna única.
- Atalho de teclado para o painel (não pedido).

## Regras de negócio
- RN-01: o botão da barra fica no topo, junto do logo; a barra rola quando o conteúdo não cabe.
- RN-02: recolher o painel não descarta nada em andamento (rascunho de cartão, tentativa, pergunta ao tutor): o conteúdo só sai da vista.
- RN-03: preferência do painel em `localStorage` (`fq-panel`), como `fq-rail` e `fq-cinema`; sem armazenamento, abre expandido.
- RN-04: só acima de 1000 px; abaixo disso o controle não existe (não anunciar o que não funciona).

## Critérios de aceitação
- [x] CA-01: em 1366×650 e em 1920×946 com a barra cheia, o botão de recolher está visível sem rolar.
- [x] CA-02: recolher o painel dá a largura dele à transcrição (texto e vídeo) e persiste ao recarregar.
- [x] CA-03: com o painel recolhido, o rascunho em andamento continua lá ao reabrir.
- [x] CA-04: controles com nome acessível, `aria-expanded`/`aria-pressed` e foco visível; `accessibility-qa` e QA isolado com zero violações.

## Registro de execução
### Alterações realizadas
- `src/client/App.tsx`: o botão de recolher saiu do rodapé da barra e foi para `.sidebar-head`, ao lado do logo — só ícone, com nome acessível fixo "Recolher a barra lateral", `aria-pressed` e `title` que muda com o estado.
- `src/app/globals.css`: `.sidebar` com `overflow-y: auto`; `.sidebar-head` (em trilho, logo "F." e botão empilhados); seletores `.sidebar > .wordmark` passaram a `.sidebar-head > .wordmark`; painel recolhível (`.panel-toggle`, `.study-tools`, `.study.panel-collapsed` com coluna de 48 px acima de 1000 px; abaixo, controle oculto e conteúdo sempre visível); `.study { width: 100% }`.
- `src/client/Study.tsx`: estado `panelOpen` com `fq-panel`; botão `panel-toggle` (`aria-expanded`, `aria-controls`) no topo do painel; abas e corpo dentro de `#study-tools`, recolhido com `hidden`.
- `scripts/layout-qa.mjs` (novo, ligado em `qa-isolated.ts`) e `docs/ui/README.md`.
### Arquivos principais
`src/client/App.tsx` · `src/client/Study.tsx` · `src/app/globals.css` · `scripts/layout-qa.mjs`
### Decisões
- Trilho da barra (64 px) mantido, por escolha do proprietário; o defeito real era o botão inalcançável, não a falta da opção.
- Painel: trilho fino de 48 px com botão de reabrir (opção escolhida pelo proprietário). Aberto, o controle é só um ícone no canto da linha das abas, que cede 48 px à direita — não ocupa linha nova.
- `hidden` em vez de desmontar: rascunho de cartão, tentativa e pergunta ao tutor ficam no DOM e no estado (RN-02).
- Nome acessível fixo + `aria-pressed` na barra (o nome não muda com o estado); no painel, `aria-expanded` + `aria-controls`.
### Divergências
- `.study { width: 100% }` não estava previsto: como item de flex em coluna com `margin: auto`, a sala encolhia até o próprio conteúdo quando o painel saía e a largura liberada virava margem (transcrição ganhava 83 px em vez de 252 px). Com o painel aberto nada muda.
- Durante a validação, `.next/dev/types/routes.d.ts` ficou com 0 bytes depois de parar o servidor de desenvolvimento no meio de uma escrita e quebrou `tsc`; o diretório gerado foi removido e recriado. Não é código do projeto.
### Pendências
- Produção (Railway) roda um commit antigo: o botão no topo e o painel recolhível só aparecem lá depois de um novo deploy.
- Em fonte só de texto, o cartão "Seu material de leitura" ocupa a coluna de 380–430 px que o vídeo ocuparia; recolhê-lo daria ainda mais espaço à transcrição. Fora do escopo pedido.

## Validação
`npm run typecheck` · `npm run build` · `npx tsx --env-file=.env.local scripts/qa-isolated.ts`

Resultados de 2026-10-14:
- `npm run typecheck` e `npm run build`: sem erros. `npm test`: 103/103 (sem mudança de domínio).
- QA isolado completo, saída 0: `browser-qa`, `accessibility-qa` (`violations: []` nas 9 rotas), `source-qa`, `song-qa` e o novo `layout-qa`: botão da barra inteiro na tela em 1366×650, 1280×560 e 1920×946 (CA-01); recolher o painel em 1366×650 com a barra cheia levou a transcrição de 388 para 640 px e a preferência persistiu ao recarregar (CA-02); rascunho preservado ao recolher e reabrir (CA-03); zero violações axe e zero overflow com painel recolhido, painel + barra recolhidos e no celular, claro e escuro (CA-04).
- Verificação manual no navegador embutido (1366×650, barra em trilho, texto de exemplo): transcrição de 532 para 784 px.

## Handoff

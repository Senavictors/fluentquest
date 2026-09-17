---
id: TASK-010
title: Modo cinema na sala de estudo, somente desktop
status: active
type: feature
owner: interface-editorial
created_at: 2026-09-17
updated_at: 2026-09-17
affected_modules: [src/client/Study.tsx, src/app/globals.css, DESIGN.md]
related_use_cases: [assistir acompanhando a transcrição]
related_adrs: []
---

# TASK-010 — Modo cinema na sala de estudo, somente desktop

## Contexto

O proprietário pediu, mostrando o painel "Neste vídeo" do YouTube como referência: uma forma de ver o vídeo maior com a transcrição ao lado, **apenas na visualização web desktop**.

## Problema

A sala de estudo foi desenhada para a tarefa de ler e salvar expressões, e o arranjo reflete isso: acima de 1240px o vídeo é a coluna estreita (280–430px) e a transcrição fica com o resto, com o painel de ferramentas ocupando mais 300–350px à direita. Quando a tarefa é assistir acompanhando o texto, a proporção está invertida — num monitor de 1920px o vídeo tinha 430px de largura, menos de um quarto da janela.

## Objetivo

Um arranjo alternativo, reconhecível de imediato por quem usa YouTube, em que o vídeo domina e a transcrição fica ao lado, sem tirar nada do arranjo atual nem tocar em celular e tablet.

## Fora de escopo

- Qualquer mudança abaixo de 1240px.
- Tela cheia nativa do navegador ou do player.
- Mudar o modo imersão, que é outra coisa: ele aumenta o corpo do trecho, não o vídeo.
- Rota, contrato ou schema novo — nada de servidor muda.

## Comportamento atual

`.study-content` acima de 1240px: `[mídia 280–430px] [transcrição 1fr]`, com `.study-panel` fixo à direita. Sem alternativa.

## Comportamento esperado

Um controle "Modo cinema" na barra do player. Ligado: o painel de ferramentas sai, `.study-content` vira `[mídia 1fr] [transcrição 320–440px]`, e o vídeo é o maior 16:9 que cabe na moldura, centralizado sobre o palco escuro. A escolha persiste entre sessões.

## Regras de negócio

- RN-01: O modo só existe acima de 1240px. O controle é removido do DOM renderizado por `display: none`, o que também o tira da ordem de tabulação — nada de botão invisível e focável.
- RN-02: O atalho `C` e a dica de rodapé só aparecem onde o modo existe, verificados por `matchMedia` no mesmo limiar do CSS. Anunciar uma tecla que não faz nada seria mentira de interface.
- RN-03: Ação que depende do painel de ferramentas devolve o painel. "Recuperar sem consulta" sai do cinema antes de trocar a aba, senão seria um clique que não mostra nada.
- RN-04: O apoio de trecho continua dentro da transcrição, não no painel, então ele funciona igual no cinema. Verificado antes de ocultar o painel.
- RN-05: A preferência vive em `localStorage` (`fq-cinema`), lida depois da montagem, como já faz `fq-rail`. Ler no initializer divergiria do HTML do servidor.

## Critérios de aceitação

- [x] CA-01: Acima de 1240px o vídeo cresce de forma mensurável e a transcrição continua ao lado.
- [x] CA-02: Em 390px e 900px nada muda: sem controle, sem atalho, sem dica.
- [x] CA-03: Nenhuma rolagem horizontal e nenhum elemento transbordando, em nenhuma das larguras testadas.
- [x] CA-04: `node scripts/accessibility-qa.mjs` sem violações.
- [x] CA-05: A preferência sobrevive a recarregar a página.
- [x] CA-06: `npm run typecheck`, `npm test` e `npm run build` verdes.

## Impacto técnico

### Backend

Nenhum.

### Frontend

`src/client/Study.tsx`: estados `cinema` e `wide`, `applyCinema`, botão na barra do player, atalho `C`, classe na raiz. `src/app/globals.css`: bloco cinema dentro de `@media (min-width: 1240px)`.

### Banco de dados

Nenhum. A preferência é local do navegador, como o recolhimento da barra lateral.

### Integrações

Nenhuma.

### Segurança

Nenhuma. Nada sai do cliente.

## Plano de implementação

- [x] Etapa 1 — estado, persistência e controle.
- [x] Etapa 2 — CSS do arranjo, restrito ao desktop.
- [x] Etapa 3 — QA medido de layout e axe nas larguras reais.
- [x] Etapa 4 — DESIGN.md e registro.

## Estratégia de testes

- [ ] Unitários — não se aplica: é arranjo de CSS e estado local, sem regra de domínio.
- [ ] Integração — não se aplica: nada de servidor muda.
- [x] E2E — script de QA com Playwright medindo caixas, axe e transbordamento em 1920×1080, 1440×1000, 1280×800, 900×1000 e 390×844.
- [x] Manual — `node scripts/accessibility-qa.mjs`, que já cobre a rota `estudo`.

## Riscos e rollback

- **Tarja do palco em larguras médias** (impacto baixo, consequência aceita): em 1440×1000 o vídeo é limitado pela largura da coluna, então sobram ~94px de tarja escura acima e abaixo. É o letterbox convencional de palco de vídeo e é o que a referência do YouTube mostra; em 1920 cai para ~13px. A alternativa — o palco encolher até o vídeo — separaria os controles do vídeo ou exigiria altura calculada, que esta tela já rejeitou por bons motivos.
- **`max-width` removido no cinema**: a sala passa a usar a coluna inteira em vez de parar em 1600px. É deliberado — a largura extra vira vídeo, e a medida de leitura está protegida pela coluna própria da transcrição.
- Rollback: duas mudanças isoladas, uma em `Study.tsx` e uma no bloco cinema do CSS. Nada de schema, rota ou dado.

## Registro de execução

### Alterações realizadas

- `src/client/Study.tsx`: estados `cinema` (persistido em `fq-cinema`) e `wide` (`matchMedia` em 1240px); `applyCinema`; botão `cinema-toggle` na barra do player com `aria-pressed` e rótulo que muda; atalho `C`; classe `cinema` na raiz; saída automática do modo em "Recuperar sem consulta"; dica de rodapé condicional.
- `src/app/globals.css`: bloco cinema em `@media (min-width: 1240px)` — painel oculto, `.study-content` invertido, palco com `container-type: size` e vídeo dimensionado por `min(100cqw, calc(100cqh * 16 / 9))`, faixa extra em 1600px.
- `DESIGN.md`: o arranjo novo registrado junto da identidade.

### Decisões

- **Unidades de container em vez de `calc()` com altura.** O vídeo precisa ser o maior 16:9 que cabe nos dois eixos. `height: 100%` numa coluna estreita distorceria a proporção, e qualquer `calc()` com altura de cabeçalho erraria — esta tela já registrou que o cabeçalho varia entre 198px e 355px. `container-type: size` no palco resolve pela altura real, derivada.
- **Nomear "cinema", não "teatro".** É como o YouTube pt-BR chama o arranjo; o proprietário já reconhece o termo de lá. Familiaridade conquistada vale mais que vocabulário próprio aqui.
- **Controle na barra do player, não no cabeçalho.** É onde o YouTube põe e é onde estão os outros controles de vídeo, com a mesma forma de botão que "A–B" já usa.

### Divergências

O primeiro resultado ampliava o vídeo em apenas 44px. A causa não estava no bloco novo: `.study` tem `margin: auto`, e margem automática no eixo transversal de um flex em coluna desliga o `stretch`, fazendo o elemento assumir a largura do próprio conteúdo. No arranjo normal isso nunca apareceu porque o painel fixo empurra o conteúdo além de 1600px; sem o painel, a sala encolhia para ~1004px justamente no modo que existe para ser largo. Resolvido com largura explícita e remoção do teto no cinema.

### Pendências

- O `scripts/accessibility-qa.mjs` cobre a rota `estudo`, mas no arranjo normal. O modo cinema é verificado por script de QA descartável, não por um permanente.

## Validação

- `npm run typecheck`, `npm test` (56/56) e `npm run build`: passaram.
- `node scripts/accessibility-qa.mjs`: 0 violações em todas as rotas, incluindo `estudo`.
- QA medido do modo cinema, largura × altura do vídeo, normal → cinema:
  - 1920×1080: 430×248 → **1182×671**
  - 1440×1000: 430×248 → **742×423**
  - 1280×800: 380×220 → **582×333**
  - 390×844 e 900×1000: controle ausente, arranjo idêntico ao anterior.
- Rolagem horizontal zero e nenhum elemento transbordando em todas as larguras.
- axe no modo cinema: 2 violações, ambas dentro do iframe do YouTube (`ytmVideoInfoVideoTitle`, `html5-video-player`) e presentes também na medição de referência sem o modo. Não são nossas e não são corrigíveis daqui.
- Detector do Impeccable sobre `Study.tsx` e `globals.css`: nenhum achado.

## Revisão — 2026-09-17, segunda passagem

### O que o proprietário reportou

Num monitor grande o modo ficou "razoavelmente bom", mas no notebook ficou ruim: o vídeo estreito, cercado de tarja preta. Pediu algo mais estruturado, "tipo uma modal", sem a borda preta. Reportou também que o botão de expandir/minimizar do cabeçalho — o modo imersão — não serve para nada e que nem sabia para que existia.

### Diagnóstico

A primeira versão tratava o cinema como um arranjo de colunas dentro da página, e a página continuava pagando por cabeçalho, aviso e trilha de etapas. Num notebook de 1360×630 isso deixava ~240px de altura para o palco, e como o vídeo é o maior 16:9 que cabe nos dois eixos, ele encolhia e o resto do palco virava tarja. A tarja era consequência, não escolha: quanto menor a altura útil, maior a moldura.

Sobre o botão de imersão, o proprietário está certo. `.immersed` fazia exatamente duas coisas: painel de 350px para 310px e corpo do trecho de 15px para 19px. Nenhuma das duas se anuncia, e o ícone `Maximize2` prometia uma ampliação que não acontecia.

### Correções

- **O cinema deixou de ser arranjo e virou superfície.** Barra lateral (alcançada por `html[data-cinema="1"]`, já que vive fora da árvore da sala), aviso e trilha de etapas saem; o cabeçalho encolhe para uma faixa com título à esquerda e fechar à direita. O que resta da janela é vídeo e transcrição.
- **Sem moldura preta.** `.player-area` perde o fundo `#141617` no cinema. A sobra em volta do vídeo passa a ser a cor da página.
- **Saídas que as pessoas tentam primeiro.** `Esc` além do botão e de `C`.
- **O controle mudou de lugar.** Saiu da barra do player e foi para o cabeçalho, ocupando o vão deixado pelo botão de imersão. Na barra do player o rótulo quebrava a linha numa coluna de 380px, custando ~44px de transcrição justamente na tela mais apertada; e o modo troca a sala inteira, não o player. No cinema esse mesmo botão é o fechar da faixa, o que dá ao modo a estrutura de cabeçalho de modal que o proprietário pediu.
- **Modo imersão removido**: estado, botão, parâmetro `?mode=immersion`, escrita no contexto da sessão e as três regras de CSS. O corpo maior de trecho migrou para o cinema, onde ler de longe é a tarefa.

### Por que não é uma `<dialog>` de verdade

Mover o player para dentro de um elemento novo desmontaria o iframe do YouTube e perderia a reprodução e a posição. A superfície é obtida por CSS, sem tirar nada de lugar na árvore, e recebe em JS o que uma modal daria: `Esc` para sair e a navegação removida da ordem de tabulação por `display: none`.

### Compatibilidade

`PATCH /api/sessions/:id` continua aceitando `immersion` como opcional, para não invalidar sessões já gravadas. O cliente parou de escrever e de ler o campo. Nenhum contrato mudou, então `docs/API.md` não precisou de alteração.

### Validação da segunda passagem

- `npm run typecheck`, `npm test` (56/56) e `npm run build`: passaram.
- `node scripts/accessibility-qa.mjs`: 0 violações em todas as rotas.
- Vídeo, normal → cinema: 1360×630 **380×220 → 852×485**; 1366×768 → 884×503; 1440×900 → 958×545; 1920×1080 → 1398×792.
- Palco com fundo transparente confirmado por `getComputedStyle`; barra lateral fora do fluxo no cinema; `Esc` sai do modo nas quatro larguras; rolagem horizontal zero.
- Em 390×844: sem controle, sem barra lateral fora do padrão, arranjo idêntico ao anterior.
- axe no cinema: as mesmas 2 violações de dentro do iframe do YouTube, presentes na medição de referência.

## Handoff

Não aplicável.

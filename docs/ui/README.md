# Interface e design system

> **Fontes primárias**: [`../../DESIGN.md`](../../DESIGN.md) (identidade resumida) e [`../mockups/`](../mockups/) (mockups de origem e seu `_ds/`). Esta pasta complementa: registra como a identidade se materializou no código.

## Identidade

Editorial "Broadsheet": Source Serif 4 auto-hospedada via `@fontsource/source-serif-4`, manchetes com peso tipográfico e respiro generoso. Paleta clara com fundo `#f3f2f2`, texto `#201e1d` e destaque `#0088b0` (texto de ação `#006786`). Divisórias discretas, raios de 2 a 4px, cor secundária reservada a estados. Sidebar de 208px no desktop.

Referências dos mockups: **1a** (tela Hoje), **1b** (sala de estudo), **1c** (modo imersão).

## Telas implementadas

| Tela | Arquivo | Linhas |
|---|---|---|
| Casca, navegação e Hoje | `src/client/App.tsx` | 650 |
| Biblioteca e sala de estudo | `src/client/Study.tsx` | 1982 |
| Produção, prática e gravação | `src/client/Practice.tsx` | 721 |
| Perfil, preferências e conta | `src/client/Settings.tsx` | 656 |

Ícones: `lucide-react` — a única dependência de UI do projeto. Não há framework de estilo nem biblioteca de componentes de terceiros.

## Regras de composição

1. **Uma missão predominante por tela** no desktop, com revisões e evidência à direita.
2. **Mobile em uma coluna**, cinco destinos na barra inferior, alvos de toque de 44px.
3. **Tema escuro preserva contraste e estrutura** — não é inversão automática de cores.
4. **Nenhuma métrica inventada**: se o dado não existe no banco, a tela não o mostra.
5. **Estado de IA indisponível é textual e explícito** — "integração não configurada", nunca um carregamento perpétuo.
6. **Avatar usa iniciais e nível**, sem arte figurativa improvisada.
7. **Foco visível e rótulo textual em todo controle**; atalhos R (repetir), T (apoio), C (cinema, só acima de 1240px) e K (acompanhar a letra, só em música com clipe), desligáveis pelo proprietário. A dica de rodapé da sala só lista o atalho que funciona naquela fonte.
8. **Sem efeitos de impressão que repitam texto acessível** — o título continua legível para leitor de tela.
9. **`lang` segue o idioma real do conteúdo** (ADR-006, TASK-015): trechos, expressões e exemplos usam o idioma da fonte ou do cartão; texto na língua de explicação usa `profile.locale`. Nenhum `lang="en"` fixo em conteúdo de estudo. Rótulos de idioma vêm de `src/client/languages.ts`, que importa os códigos de `src/domain/content.ts` em vez de manter uma segunda lista.

## Idioma na interface

A importação pergunta o idioma do conteúdo (inglês pré-selecionado); a variedade en-US/en-GB só aparece quando o inglês está em jogo — no formulário e em Preferências, se houver fonte em inglês. Idioma diferente de inglês mostra, uma vez, no formulário, que exemplo, cenários e diagnóstico existem só em inglês. Biblioteca, sala de estudo e revisão mostram o idioma de cada item; a revisão ganha um filtro por idioma quando a fila tem mais de um, como preferência de tela, sem estado no servidor.

## Música (TASK-021, ADR-009)

A importação tem uma quarta aba, **Música**. Ela é só estado de tela: a fonte gravada é `text` (só letra) ou `youtube` (letra + clipe). Título e autor não são digitados — vêm do catálogo. Fluxo: buscar (debounce de 450 ms, uma requisição por vez, a anterior cancelada) → escolher a versão → opcionalmente colar o link do clipe oficial → idioma → importar.

- Resultados são **radios nativos num `fieldset`** ("Escolha a versão da letra"), com título, artista, álbum, duração `m:ss` e "Letra sincronizada" / "Só texto, sem tempo" / "Instrumental — sem letra para estudar". Instrumental aparece desabilitado, não some. As setas passam entre versões habilitadas, e o leitor de tela anuncia a posição na lista. A lista rola por si acima de 420px.
- Contagem e "Buscando no LRCLIB…" ficam num `role="status"`; erro (`LYRICS_RATE_LIMITED`, `LYRICS_UNAVAILABLE`) num `role="alert"`, sem nova tentativa automática — o mesmo termo só volta à rede por ação do proprietário.
- Catálogo desligado (`integrations.lyrics=false`): a aba diz "Integração não configurada", sugere colar um `.lrc` em "Texto ou legenda" com um botão que troca de aba, e o envio fica desabilitado.
- Direito fixo (`third_party`), sem seletor: um parágrafo curto diz que a letra é de terceiros, para estudo pessoal, não revisada e fora da exportação.
- Letra ou clipe já importados (`409 SOURCE_EXISTS`) abrem a fonte existente em vez de mostrar erro.
- Origem visível: na sala, o subtítulo do cabeçalho leva "Letra da comunidade (LRCLIB), não revisada" o tempo todo, e o trecho selecionado leva "Letra da comunidade (LRCLIB), não revisada · tempo aproximado" (ou "· sem tempo"). Na biblioteca, o artista é o autor e a linha leva "Letra (LRCLIB)".

QA dedicado: `scripts/song-qa.mjs`, rodado por `scripts/qa-isolated.ts` com o servidor ligado a um LRCLIB simulado (`scripts/qa-lrclib-fixture.mjs`, carregado por `--import` só no servidor de QA; nenhuma chamada sai para lrclib.net). Cobre teclado, rótulos, reimportação, catálogo desligado, axe e overflow em 1440/390, claro/escuro. Capturas em `.impeccable/review/song-*.png`.

### Modo karaokê (TASK-022)

Vale só para fonte com clipe e trechos `lyrics_catalog` com tempo `approximate` (`followsPlayback`); em qualquer outra fonte a sala é a de sempre. Com a música tocando, o player é consultado a cada 200 ms (o 1 s de sempre continua para posição e A–B), e o verso cujo início deslocado já passou (`activeSegmentIndex`) acende: fio de destaque à esquerda, texto em cor de ação e `aria-current="time"`. É um estado separado da seleção — acompanhar não fecha o apoio nem apaga o rascunho de cartão. A lista troca de página e rola até o verso (`block: "nearest"`), sem animação quando o sistema pede movimento reduzido.

Barra "Acompanhamento da letra", abaixo dos controles do player: "Acompanhar a letra" (`aria-pressed`, atalho K, preferência em `localStorage` `fq-karaoke`), "Ajuste da letra" em passos de 0,5 s entre −10 s e +10 s, com o valor num `output` vivo e uma linha que lembra que o tempo é aproximado e da comunidade. Clicar num trecho pausa o acompanhamento até a próxima reprodução e a linha avisa isso. O deslocamento é salvo na fonte (`PATCH /api/sources/:id` com `timeOffsetMs`) e também desloca o salto ao trecho, o R e o A–B. No modo cinema a barra continua, mais compacta.

O QA (`scripts/song-qa.mjs`) troca só o script `iframe_api` do YouTube, no navegador de teste, por um player simulado com relógio próprio, e mede a latência entre o início declarado do verso e o destaque.

## Acessibilidade

Estado atual: **`violations: []` em 9 rotas** medidas por axe (`node scripts/accessibility-qa.mjs`), incluindo a variante escura em mobile. Desde 2026-10-14 o axe de `scripts/source-qa.mjs` e `scripts/song-qa.mjs` exclui o iframe do player do YouTube (`.youtube-host iframe`), por decisão do proprietário: as violações ali são marcação do YouTube, não do FluentQuest. Esse número é um contrato, não uma conquista pontual: uma mudança de tela que o quebre não está pronta. Ver [`../quality/README.md`](../quality/README.md).

## Ao criar um componente

Reaproveite os padrões já presentes nas quatro telas antes de inventar um novo, mantenha os textos em pt-BR no tom editorial existente ("Entre no seu espaço.", "Abrindo seu espaço de estudo…"), e rode o QA de acessibilidade antes de considerar a mudança concluída. Alterações de paleta, tipografia ou estrutura de navegação exigem aprovação — ver [`interface-editorial`](../../.claude/agents/interface-editorial.md).

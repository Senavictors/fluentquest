# Interface e design system

> **Fontes primárias**: [`../../DESIGN.md`](../../DESIGN.md) (identidade resumida) e [`../mockups/`](../mockups/) (mockups de origem e seu `_ds/`). Esta pasta complementa: registra como a identidade se materializou no código.

## Identidade

Editorial "Broadsheet": Source Serif 4 auto-hospedada via `@fontsource/source-serif-4`, manchetes com peso tipográfico e respiro generoso. Paleta clara com fundo `#f3f2f2`, texto `#201e1d` e destaque `#0088b0` (texto de ação `#006786`). Divisórias discretas, raios de 2 a 4px, cor secundária reservada a estados. Sidebar de 208px no desktop.

Referências dos mockups: **1a** (tela Hoje), **1b** (sala de estudo), **1c** (modo imersão).

## Telas implementadas

| Tela | Arquivo | Linhas |
|---|---|---|
| Casca, navegação e Hoje | `src/client/App.tsx` | 650 |
| Biblioteca e sala de estudo | `src/client/Study.tsx` | 1340 |
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
7. **Foco visível e rótulo textual em todo controle**; atalhos R/T configuráveis pelo proprietário.
8. **Sem efeitos de impressão que repitam texto acessível** — o título continua legível para leitor de tela.

## Acessibilidade

Estado atual: **`violations: []` em 9 rotas** medidas por axe (`node scripts/accessibility-qa.mjs`), incluindo a variante escura em mobile. Esse número é um contrato, não uma conquista pontual: uma mudança de tela que o quebre não está pronta. Ver [`../quality/README.md`](../quality/README.md).

## Ao criar um componente

Reaproveite os padrões já presentes nas quatro telas antes de inventar um novo, mantenha os textos em pt-BR no tom editorial existente ("Entre no seu espaço.", "Abrindo seu espaço de estudo…"), e rode o QA de acessibilidade antes de considerar a mudança concluída. Alterações de paleta, tipografia ou estrutura de navegação exigem aprovação — ver [`interface-editorial`](../../.claude/agents/interface-editorial.md).

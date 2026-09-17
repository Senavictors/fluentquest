# Mapa da Documentação — FluentQuest

Pasta versionada. Complementa — nunca duplica — a documentação de produto que já existia neste repositório antes do bootstrap da arquitetura de agentes.

## Convenção de estado (documentação viva)

Todo documento desta pasta (exceto os `README.md` de índice) começa com um frontmatter mínimo:

```yaml
---
estado: planejado | real | divergente
fonte: <arquivo/pasta de código que sustenta este doc, ou a spec de origem>
ultima-revisao: <task ou data que atualizou este doc por último>
---
```

- **planejado** — descreve algo especificado mas ainda não implementado.
- **real** — descreve o comportamento confirmado no código atual.
- **divergente** — documento e código discordam e a divergência ainda não foi resolvida; registre-a no corpo do doc, nunca corrija silenciosamente.

Quem mantém isso vivo: `bootstrap-complete` (ao concluir uma task que toca a área) e `bootstrap-audit` (aponta docs `real` suspeitos de estarem defasados).

## Fontes primárias

Estes documentos já existiam na raiz de `docs/` e **continuam sendo os donos** dos respectivos assuntos. Não foram movidos nem duplicados no bootstrap.

| Assunto                                           | Fonte primária                               |
| ------------------------------------------------- | -------------------------------------------- |
| Contratos da API local (rotas, erros, cabeçalhos) | [`API.md`](API.md)                           |
| Ativação de provedores de IA, preços e piloto     | [`INTEGRACOES.md`](INTEGRACOES.md)           |
| Operação: backup, restauração, incidentes         | [`OPERACAO.md`](OPERACAO.md)                 |
| Especificação original do produto                 | [`PRODUTO_ORIGINAL.md`](PRODUTO_ORIGINAL.md) |
| Mockups e design system de origem                 | [`mockups/`](mockups/)                       |
| Identidade visual resumida                        | [`../DESIGN.md`](../DESIGN.md)               |
| Escopo, limites e compromissos de marca           | [`../PRODUCT.md`](../PRODUCT.md)             |
| Estrutura, visão arquitetural e demais assuntos   | esta pasta (`docs/`)                         |

Os dois links quebrados que este mapa registrava foram fechados em 17/09/2026: [`VALIDACAO.md`](VALIDACAO.md) existe e é citado pelo `README.md` da raiz, e [`data/`](data/README.md) deixou de ser uma entrada sem destino — o arquivo nunca entrara no Git porque a regra `data/` do `.gitignore`, escrita para os arquivos do proprietário na raiz, não estava ancorada e engolia `docs/data/` junto. A regra virou `/data/`.

## Regra de organização

Nenhum arquivo novo é criado solto na raiz de `docs/` além deste `README.md` — todo doc novo vive numa subpasta do mapa abaixo. Os documentos pré-existentes listados acima permanecem onde estão até que uma realocação seja aprovada.

## Comece por aqui

Núcleo:

1. [Arquitetura](architecture/README.md)
2. [Domínio](domain/README.md)
3. [Módulos](modules/README.md)
4. [API](api/README.md)
5. [Dados](data/README.md)
6. [Integrações](integrations/README.md)
7. [Diagramas](diagrams/README.md)

Extensões deste projeto:

- [`ai/`](ai/README.md) — avaliação, segurança e limites da funcionalidade de IA
- [`security/`](security/README.md) — threat model e privacidade dos dados do proprietário
- [`quality/`](quality/README.md) — estratégia de testes, acessibilidade e evidências de validação
- [`ui/`](ui/README.md) — design system e identidade editorial

Toda extensão nova entra declarada nesta lista — nenhuma pasta surge em `docs/` sem constar deste mapa.

## Implementar uma funcionalidade

Task (`.agents/tasks/`) → módulo (`modules/`) → API/dados (`api/`, `data/`) → decisões (`.agents/decisions/`) → testes (`quality/`)

## Corrigir um bug

Task → módulo → known issues → testes → causa raiz → handoff (`.agents/handoffs/`)

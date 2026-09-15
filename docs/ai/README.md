# IA no produto

Esta pasta documenta a funcionalidade de IA do FluentQuest: o que ela promete, o que ainda não foi verificado, e os limites que não podem ser afrouxados. A configuração e o passo a passo de ativação são de [`../INTEGRACOES.md`](../INTEGRACOES.md); o mapa de adaptadores é de [`../integrations/README.md`](../integrations/README.md).

## Situação honesta em 2026-09-14

**Nenhuma chamada paga jamais foi executada.** Os adaptadores existem, passam por tipos, contratos locais e estados sem credencial, e o caminho completo de reserva e conciliação é exercitado por 23 cenários de integração — todos **sem IA**. O que isso significa na prática:

| Aspecto | Verificado? |
|---|---|
| Contrato e schema de saída | Sim, por tipos e Zod |
| Comportamento sem credencial | Sim, cenário "IA desligada sem resposta simulada" |
| Reserva, conciliação e concorrência de orçamento | Sim, com valores simulados |
| Qualidade pedagógica do tutor e das atividades | **Não** |
| Precisão de transcrição (WER) e utilidade do feedback | **Não** |
| Latência real e custo real por sessão | **Não** |
| Disponibilidade do modelo na conta do proprietário | **Não** |

Não declare nenhuma linha "Não" como resolvida sem a evidência do piloto.

## Funcionalidades previstas

- **Tutor** — conversa por SSE (`streamTutor`), com contexto textual limitado e prompt versionado.
- **Geração de atividade** — saída em schema Zod/JSON Schema, com verificação dos IDs de origem citados.
- **Transcrição** — áudio no Gemini Flash-Lite, sem alegar alinhamento acústico.
- **Feedback de fala** — etapa separada da transcrição. **Não existe avaliação fonética nesta versão.**
- **Tradução editorial** — hoje disponível apenas no material autoral de exemplo.

## Limites inegociáveis

1. Função indisponível informa "integração não configurada" — nunca um resultado plausível gerado localmente. (Constituição)
2. Reserva de orçamento antecede a inferência; timeout ambíguo mantém o valor reservado; sem repetição automática de chamada possivelmente cobrada. (Constituição)
3. Resultado truncado ou sem medição de uso não é apresentado como avaliação concluída.
4. Conteúdo gerado por IA não é tratado como transcrição verificada e não deve gerar ditado literal sem validação.
5. Preço vencido (31 dias sobre `AI_PRICES_REVIEWED_ON`) bloqueia novas chamadas.
6. Troca de modelo exige revisão de preço, modalidades e regressão — o adaptador está calibrado para Flash-Lite com thinking minimal.

## Registro do piloto

Quando o piloto de 7 passos de [`../INTEGRACOES.md`](../INTEGRACOES.md) for executado, crie aqui `piloto-<data>.md` (frontmatter `estado: real`) registrando, por passo: o que foi enviado, o resultado observado, o uso retornado, a reserva liberada e a comparação com a fatura do projeto. Enquanto esse arquivo não existir, a tabela acima permanece como está.

Papel responsável, com veto sobre ativação: [`ia-orcamento`](../../.claude/agents/ia-orcamento.md).

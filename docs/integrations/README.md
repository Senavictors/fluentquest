# Integrações

> **Fonte primária para ativação, preços e piloto: [`../INTEGRACOES.md`](../INTEGRACOES.md).** Esta pasta não repete as instruções de configuração — ela registra o mapa das integrações e o estado de cada uma.

## Estado atual

| Integração | Usada por | Estado hoje |
|---|---|---|
| **Google Gemini** | `src/server/providers.ts` — tutor, geração de atividade, transcrição, feedback de fala | **Desligada.** `AI_ENABLED=false`. Implementada e verificada por tipos e contratos locais; nenhuma chamada paga jamais executada. |
| **YouTube Data API** | `src/server/providers.ts` (`youtube`) — metadados via `videos.list` | Opcional. Sem `YOUTUBE_API_KEY`, o player continua funcionando; só os metadados ficam indisponíveis. |
| **Player YouTube (iframe)** | `src/client/Study.tsx`, no navegador | Ativa. É a única saída de rede do cliente. |
| **ffprobe** (`ffprobe-static`) | `src/server/media.ts` | Ativa. Verifica duração e conteúdo real de mídia enviada. |
| **PostgreSQL** | `src/server/db.ts`, `pg-boss` | Ativa. Tratada como parte do sistema, não como serviço externo — ver [`../architecture/containers.md`](../architecture/containers.md). |

## Contrato comum dos adaptadores

As integrações de IA passam pelas interfaces `TutorProvider`, `LessonGenerator`, `SpeechTranscriber` e `VideoMetadataProvider`, em `src/server/providers.ts`. Regras que valem para qualquer provedor novo:

1. `requireAI()` antes de qualquer chamada; sem credencial, a resposta é "integração não configurada" — nunca um resultado plausível gerado localmente.
2. `reserveBudget` antes da inferência; `settleBudget` ou `failBudget` depois. Timeout ambíguo **mantém** o valor reservado.
3. Saída validada por schema Zod, com verificação dos IDs de origem citados.
4. `normalizeUsage` converte a medição do provedor sem contar `thinking` duas vezes e sem tratar medição ausente como chamada gratuita.
5. Resultado truncado ou sem medição não é apresentado como avaliação concluída.
6. Cache em `result_cache`, privado por usuário, conteúdo, áudio, modelo, schema e versão de prompt.

## Limites deliberados

- O suporte do Gemini a URL de vídeo **não** está habilitado nesta implementação.
- Não há avaliação fonética, e transcrição e feedback são etapas separadas.
- Sem scraping, download de mídia do YouTube ou acesso universal a legendas.
- O servidor nunca faz fetch de URL arbitrária fornecida pelo usuário.

## Antes de ativar qualquer provedor pago

Execute o piloto de 7 passos de [`../INTEGRACOES.md`](../INTEGRACOES.md) e registre o resultado em [`../ai/README.md`](../ai/README.md). O papel [`ia-orcamento`](../../.claude/agents/ia-orcamento.md) tem veto sobre ativação.

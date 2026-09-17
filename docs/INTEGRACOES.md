---
estado: real
fonte: src/server/providers.ts, src/server/budget.ts, src/worker.ts, src/client/Practice.tsx
ultima-revisao: 2026-09-17 (TASK-001 a TASK-012)
---

# Provedores de IA

O aplicativo separa o provedor de texto (`AI_TEXT_PROVIDER`) do caminho de vídeo e fala. **O piloto Gemini de texto foi executado em 15/09/2026 no tier gratuito.** Geração e tutor funcionaram com uso conciliado. A transcrição direta de URL chegou ao Gemini, mas o serviço devolveu HTTP 500/503 por alta demanda; nenhum segmento foi salvo por esse caminho. Em contrapartida, a legenda fornecida pelo proprietário carregou 53 trechos do vídeo escolhido e gerou uma atividade baseada neles. Resultados em [VALIDACAO.md](VALIDACAO.md).

## Onde ficam as chaves

Há dois caminhos, e o da interface tem precedência.

**Ajustes → Integrações** cadastra a chave de Gemini, OpenAI e YouTube direto na tela. A chave é cifrada com AES-256-GCM antes de tocar o banco (chave derivada de `BETTER_AUTH_SECRET`), nunca volta por nenhuma rota — só os quatro últimos caracteres — e vale para o servidor e para o worker **sem reiniciar nada**. Salvar não dispara chamada ao provedor: validar custaria uma inferência sem reserva prévia. Detalhes e alternativas descartadas em [ADR-005](../.agents/decisions/ADR-005-chaves-de-api-cifradas-no-banco.md).

**`.env.local`** continua valendo como fallback, para quem já tem a instalação configurada. A tela mostra de onde a chave em uso está vindo (`cadastrada aqui` ou `lida de GEMINI_API_KEY`). Alterar o arquivo ainda exige reiniciar aplicação e worker.

O que **não** é cadastrável pela interface, de propósito, porque decide gasto real: `AI_ENABLED`, `AI_TEXT_PROVIDER` e as datas de revisão de preço. Os blocos `dotenv` abaixo continuam sendo a referência dessas variáveis; a linha `*_API_KEY` é opcional quando a chave for cadastrada na tela.

## Gemini

Preços de entrada e saída precisam estar preenchidos, finitos e positivos: não há valores implícitos. Revisão inválida, futura ou vencida bloqueia chamadas e mantém a integração indisponível na interface. Retries do SDK estão explicitamente desativados. Timeout HTTP 408 mantém a reserva para conciliação; 429 explícito libera a reserva sem repetir a chamada.

Antes de pedir feedback de voz, a tela exige consentimento para envio ao Gemini e informa o risco do tier gratuito registrado no ADR-001. Gravar e ouvir localmente não envia áudio ao provedor. Evidências em [VALIDACAO.md](VALIDACAO.md).

Configure somente no arquivo privado `.env.local`:

```dotenv
AI_ENABLED=true
GEMINI_API_KEY=SUA_CHAVE
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_VIDEO_MODEL=gemini-3.5-flash-lite
AI_PRICES_REVIEWED_ON=AAAA-MM-DD
GEMINI_INPUT_USD_PER_MILLION=PRECO_VERIFICADO
GEMINI_OUTPUT_USD_PER_MILLION=PRECO_VERIFICADO
GEMINI_VIDEO_INPUT_USD_PER_MILLION=PRECO_VERIFICADO
GEMINI_VIDEO_OUTPUT_USD_PER_MILLION=PRECO_VERIFICADO
```

## OpenAI (texto)

OpenAI é o provedor alternativo de tutor, geração de atividade e tradução. Selecione-o sem alterar a configuração de vídeo:

```dotenv
AI_ENABLED=true
AI_TEXT_PROVIDER=openai
OPENAI_API_KEY=SUA_CHAVE
OPENAI_MODEL=gpt-4o-mini
OPENAI_PRICES_REVIEWED_ON=AAAA-MM-DD
OPENAI_INPUT_USD_PER_MILLION=PRECO_VERIFICADO
OPENAI_OUTPUT_USD_PER_MILLION=PRECO_VERIFICADO
```

O adaptador usa a API Responses com `store:false`, schema JSON estrito para atividades, timeout de 60 segundos e `maxRetries:0`. A cada uso, a reserva registra provedor e modelo; `usage_events.price_version` é salvo como `openai:AAAA-MM-DD` ou `gemini:AAAA-MM-DD`, permitindo conciliar cada estimativa com a tabela de preço revisada. Preço ausente, vencido ou inválido bloqueia somente o provedor correspondente.

O adaptador de fala da OpenAI não é ativado: a resposta de transcrição disponível no contrato usado não devolve uma medição de tokens auditável. Para preservar a regra de contabilizar antes de concluir uma avaliação, transcrição de fala permanece no Gemini; o feedback textual posterior pode usar o provedor de texto selecionado. Nunca use OpenAI para baixar, extrair ou transcrever áudio de links do YouTube.

Os preços configurados devem ser copiados da página oficial do modelo na data indicada em `OPENAI_PRICES_REVIEWED_ON`; a revisão vence em 31 dias. Reinicie aplicação e worker após alterar qualquer chave ou variável.

Revise os preços em https://ai.google.dev/gemini-api/docs/pricing. A revisão vence em 31 dias: novas chamadas ficam bloqueadas até atualização. Reinicie aplicação e worker após configurar.

O adaptador usa `@google/genai`, Interactions, `store:false`, sem ferramentas e com prompt versionado. Tutor recebe contexto textual limitado quando Gemini é o provedor selecionado. Atividades usam schema Zod/JSON Schema e verificação de IDs de origem. A transcrição de vídeo usa `interactions.create` com blocos `text` e `video` apontando para a URL pública canônica do YouTube, timeout de 180 segundos e nenhuma repetição do SDK. A saída JSON é validada localmente antes de persistir todos os segmentos em uma única transação. Transcrição de fala e feedback continuam separados, sem alegar alinhamento acústico ou avaliação fonética.

O cache de resultado é privado por usuário, conteúdo, áudio, modelo, schema e versão de prompt. Tutor transmite texto por SSE. Resultados truncados ou sem medição de uso não são apresentados como avaliações concluídas. Uma desconexão do navegador não elimina a conciliação de custo da chamada já iniciada.

Reservas de orçamento antecedem a inferência. Limite padrão US$ 40/mês, alerta US$ 25. Há no máximo duas reservas ativas por usuário; timeout e HTTP 5xx mantêm valor reservado para conciliação. O disjuntor conta falhas ambíguas por provedor e modelo, evitando que a indisponibilidade de um modelo bloqueie um fallback revisado. Não se repete automaticamente uma inferência que pode ter sido cobrada. O livro-razão é estimativa por uso retornado, e precisa ser comparado à fatura.

## YouTube

Metadados são consultados mesmo com IA desligada e sem legenda, quando a chave está presente. Sem legenda, fonte e job ficam em `no_transcript`. Vídeo não incorporável fica `unavailable`, sem player ou preparo; acrescentar legenda preserva esse bloqueio. O formulário distingue autoria de licença/autorização da legenda.

`YOUTUBE_API_KEY` habilita consultas `videos.list` para metadados. O iframe oficial funciona sem essa chave. URLs são validadas por host exato e ID; o servidor não faz fetch de URLs arbitrárias fornecidas pelo usuário.

O proprietário pode escolher entre colar uma legenda autorizada e pedir transcrição ao Gemini. A opção de IA exige confirmação explícita após mostrar reserva máxima estimada e saldo do teto do aplicativo. São aceitos vídeos públicos, incorporáveis, com duração conhecida de até 15 minutos e direitos registrados como link público, conteúdo próprio ou licenciado. A URL canônica é enviada ao Gemini; o servidor não baixa áudio ou vídeo.

Trechos gerados recebem `origin=provider_video_url`, `time_accuracy=approximate` e `quality_status=ai_unreviewed`. O modelo e o provedor ficam registrados na fonte. Nenhum trecho parcial é salvo em timeout, resposta incompleta, JSON inválido ou indisponibilidade. Sem transcrição, o player e a prática independente continuam disponíveis. Não há scraping nem acesso universal a legendas.

## Piloto antes de uso regular

1. Configurar chave e limites no provedor. O ADR-001 aceitou o tier gratuito do Gemini e seu risco de privacidade; isso impede concluir a comparação com fatura da etapa 5. Projeto pago exige revisão dos parâmetros.
2. Começar com teto de US$ 1 no aplicativo e um texto próprio curto.
3. Comparar a atividade com a fonte e conferir os IDs de evidência.
4. Enviar uma gravação autorizada curta; comparar transcrição e feedback com avaliação humana.
5. Comparar uso retornado, reserva liberada e fatura do projeto.
6. Testar timeout, 429, saída truncada e mudança de modelo com fixtures anonimizadas antes de ampliar o volume.
7. Montar o corpus autorizado de 12–20 trechos e revisar os 100 itens previstos no documento original. Não declarar as metas de WER, timestamps ou qualidade atingidas antes dessa avaliação.

Troca de modelo requer revisão de preço, thinking, modalidades e regressão. Não substitua o nome por outro modelo sem ajustar suas capacidades.

## Configuração atual após os pilotos

Gemini está configurado localmente para vídeo por URL e fala; OpenAI está configurado como provedor de texto `gpt-4o-mini`. O teto inicial é US$ 1 e o alerta US$ 0,80. AI Studio mostra nível gratuito sem faturamento: estimativa local do Gemini não representa cobrança. YouTube Data API v3 está configurada com chave separada e restrita à API correta. O fluxo real confirmou `videos.list`, a tela Ajustes mostra YouTube como configurado e o vídeo escolhido pelo proprietário salvou título, canal e duração oficiais. A chamada direta por URL alcançou o endpoint Interactions, mas retornou 500/503 por alta demanda; as reservas ambíguas permanecem contabilizadas até conciliação — que agora tem caminho próprio, `npm run budget:reconcile` (ADR-003): o comando relata por padrão e só move a reserva para `reconciled` com `--liberar "motivo"`, registrando data e justificativa. Em 17/09/2026 dez reservas ambíguas de 15 a 17/09 foram conciliadas com base no nível gratuito sem faturamento, devolvendo US$ 0,5897 ao teto. Para o vídeo com legenda disponível, a transcrição fornecida pelo proprietário carregou 53 trechos e a atividade baseada nesses trechos ficou disponível no estudo.

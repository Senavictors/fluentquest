# Conectar provedores posteriormente

As integrações foram implementadas e verificadas por tipos, contratos locais e estados sem credenciais. **Nenhuma chamada paga foi realizada.** Qualidade pedagógica, disponibilidade na conta, latência e fatura não foram validadas nesta entrega.

## Gemini

Configure somente no arquivo privado `.env.local`:

```dotenv
AI_ENABLED=true
GEMINI_API_KEY=SUA_CHAVE
GEMINI_MODEL=gemini-3.5-flash-lite
AI_PRICES_REVIEWED_ON=AAAA-MM-DD
GEMINI_INPUT_USD_PER_MILLION=PRECO_VERIFICADO
GEMINI_OUTPUT_USD_PER_MILLION=PRECO_VERIFICADO
```

Revise os preços em https://ai.google.dev/gemini-api/docs/pricing. A revisão vence em 31 dias: novas chamadas ficam bloqueadas até atualização. Reinicie aplicação e worker após configurar.

O adaptador usa `@google/genai`, Interactions, `store:false`, sem ferramentas e com prompt versionado. Tutor recebe contexto textual limitado. Atividades usam schema Zod/JSON Schema e verificação de IDs de origem. Transcrição e feedback são etapas separadas; o adaptador de transcrição usa áudio no Gemini Flash-Lite, sem alegar alinhamento acústico ou avaliação fonética. O modelo especializado Transcribe documentado no estudo continua como alternativa a avaliar no piloto, não como integração validada.

O cache de resultado é privado por usuário, conteúdo, áudio, modelo, schema e versão de prompt. Tutor transmite texto por SSE. Resultados truncados ou sem medição de uso não são apresentados como avaliações concluídas. Uma desconexão do navegador não elimina a conciliação de custo da chamada já iniciada.

Reservas de orçamento antecedem a inferência. Limite padrão US$ 40/mês, alerta US$ 25. Há no máximo duas reservas ativas por usuário; timeout ambíguo mantém valor reservado. Não se repete automaticamente uma inferência que pode ter sido cobrada. O livro-razão é estimativa por uso retornado, e precisa ser comparado à fatura.

## YouTube

`YOUTUBE_API_KEY` habilita consultas `videos.list` para metadados. O iframe oficial funciona sem essa chave. URLs são validadas por host exato e ID; o servidor não faz fetch de URLs arbitrárias fornecidas pelo usuário.

O MVP prioriza texto e legenda fornecidos legitimamente. Sem transcrição, o vídeo permanece disponível para reprodução e prática independente. Não há scraping, download de áudio/vídeo do YouTube ou acesso universal a legendas. O suporte Gemini a URL de vídeo não está ativado nesta implementação: qualquer extensão desse caminho exige piloto, registro de direitos, limites específicos de mídia e medição de custo.

## Piloto antes de uso regular

1. Usar uma chave de projeto pago apropriada para gravações pessoais e configurar limites também no provedor.
2. Começar com teto de US$ 1 no aplicativo e um texto próprio curto.
3. Comparar a atividade com a fonte e conferir os IDs de evidência.
4. Enviar uma gravação autorizada curta; comparar transcrição e feedback com avaliação humana.
5. Comparar uso retornado, reserva liberada e fatura do projeto.
6. Testar timeout, 429, saída truncada e mudança de modelo com fixtures anonimizadas antes de ampliar o volume.
7. Montar o corpus autorizado de 12–20 trechos e revisar os 100 itens previstos no documento original. Não declarar as metas de WER, timestamps ou qualidade atingidas antes dessa avaliação.

Troca de modelo requer revisão de preço, thinking, modalidades e regressão. O adaptador inicial é configurado para Flash-Lite com thinking minimal; não substitua o nome por outro modelo sem ajustar suas capacidades.

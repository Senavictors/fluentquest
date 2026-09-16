---
estado: real
fonte: tests/, scripts/integration.ts, scripts/qa-isolated.ts, scripts/source-qa.mjs
ultima-revisao: 2026-09-15 (TASK-001 a TASK-008)
---

# Validação e pendências de implementação

**Atualização:** os pilotos reais de texto e metadados do YouTube foram concluídos em 15/09. O fluxo de transcrição por URL foi implementado e chegou ao Gemini, mas a inferência de vídeo permaneceu indisponível por HTTP 500/503 de alta demanda. A alternativa de legenda fornecida concluiu o ciclo real de vídeo para estudo e gerou atividade baseada nos trechos. Veja as seções finais para evidências e pendências.

## Revisão de 15/09/2026

O fluxo local de estudo está implementado. As integrações externas precisam de configuração e piloto. Fixtures não demonstram qualidade pedagógica, preço real, latência ou disponibilidade do modelo na conta.

| Task | Implementação verificada | Pendência |
|---|---|---|
| TASK-001 | Preços obrigatórios, datas válidas, retries desligados, timeout conservador, consentimento de voz e piloto real de texto. | Piloto de voz autorizado e comparação pedagógica humana. |
| TASK-002 | Metadados independentes de IA; estados sem legenda e indisponível; direitos de legenda; chave restrita; vídeos reais curto, longo, indicado pelo proprietário e não incorporável. | Concluída. |
| TASK-003 | Schema e migração aditiva; intenção, consentimento, job, proveniência e persistência atômica cobertos por integração. | Concluída. |
| TASK-004 | Adaptador Interactions, URL canônica, limite de 15 min, reserva por duração, timeout de 180 s, SDK sem retries e disjuntor por provedor/modelo. | Piloto direto chegou ao Google, mas todas as inferências válidas retornaram 500/503 por alta demanda; custo por minuto ainda não pôde ser medido. |
| TASK-005 | Escolha manual/IA, estimativa e saldo no servidor, consentimento, SSE persistente e marcação de transcrição automática, incluindo QA da proveniência com fixture declarada. | Concluída. |
| TASK-006 | Registro de preços, credenciais, cache, disjuntor e reserva agora são específicos do provedor; `price_version` identifica provedor e revisão. | Teste real de paridade Gemini após a refatoração ainda depende do provedor voltar a aceitar chamadas de vídeo. |
| TASK-007 | OpenAI `gpt-4o-mini` integrado para tutor, atividade e tradução; piloto real de atividade e tutor conciliado no livro-razão. | Comparação pedagógica humana e conciliação com o painel de faturamento da OpenAI. Fala continua Gemini porque a transcrição OpenAI não devolve uso auditável no contrato adotado. |
| TASK-008 | QA isolado e documentação das evidências locais. | Sem pendência de produto neste escopo. |

O ADR-001 exige fases sequenciais. O proprietário autorizou avançar para a Fase B mesmo com voz e comparação humana pendentes na TASK-001. A implementação da Fase B está concluída localmente; falta somente a disponibilidade do provedor para obter e revisar uma transcrição real.

## Evidências executadas

- `npm run typecheck`: passou.
- `npm test`: **35 testes passaram**, domínio e adaptadores com respostas controladas.
- `npm run test:integration`: **30 cenários passaram** em banco PostgreSQL temporário; nenhuma chamada de IA ou YouTube.
- `npm run build`: passou, quatro rotas compiladas.
- `scripts/browser-qa.mjs`: Edge em 1440×1000 e 390×844; sem erros JavaScript ou transbordamento; microfone sintético gravado e descartado.
- `scripts/accessibility-qa.mjs`: **zero violações axe em nove telas/estados**.
- `scripts/source-qa.mjs`: legenda salva e preservada após recarregar; feedback e transcrição de vídeo bloqueados sem IA; claro/escuro em 1440/390 com **zero violações e transbordamentos**. Capturas inspecionadas visualmente.
- Detector Impeccable: nenhum achado nos componentes alterados.

QA de navegador realizado em banco descartável com proprietário fictício. Relatórios e capturas em `.impeccable/review/`, ignorado pelo Git. Uma falha inicial de configuração do contexto Playwright/axe no teste específico foi corrigida; sua reexecução passou.

### Repetir o QA isolado

Com PostgreSQL, `.env.setup` existentes e porta 3215 livre:

```bash
npm run build
node node_modules/tsx/dist/cli.mjs --env-file=.env.local scripts/qa-isolated.ts
```

O runner recusa substituir servidor existente, cria `fluentquest_test_qa_<timestamp>`, inicia o build em loopback, executa os três scripts e encerra o próprio processo e banco. `--source-only` repete apenas legenda e consentimento. Resíduos ficam sob `data/tests/`, nunca em `data/objects/`.

Scripts originais chamados diretamente ainda usam `.env.owner`; prefira o runner. A linha da lista de gravações é uma referência fictícia para testar consentimento, não áudio avaliado. A gravação do teste usa microfone sintético e é descartada.

## Piloto Gemini

| Etapa | Resultado |
|---|---|
| 1 — credencial e limites | Concluída para Gemini; chave válida, preços revisados, teto US$ 1 e alerta US$ 0,80. YouTube usa chave separada e validada. |
| 2 — teto inicial e texto próprio | Concluída com o exemplo autoral do aplicativo autorizado pelo proprietário. |
| 3 — atividade e evidência | Chamada real concluída e IDs de evidência válidos; revisão pedagógica humana ainda pendente. |
| 4 — voz e comparação humana | Pendente de material autorizado e chamada real; consentimento implementado. |
| 5 — uso, reserva e fatura | Não concluído; tier gratuito não permite a comparação com fatura prevista. |
| 6 — timeout, 429 e truncamento | Testes locais passaram: falha ambígua/408/5xx mantém reserva; 429 explícito libera; resposta truncada com uso é conciliada sem salvar resultado. SDK sem retries. Provedor real ainda por medir. |
| 7 — corpus e 100 itens | Pendente; fora do piloto inicial da TASK-001. |

## Limites

Microfone/codecs não verificados em aparelho físico. Backup continua manual. Duas migrações aditivas foram aplicadas antes do piloto de vídeo; não houve publicação ou commit nesta revisão. O projeto Gemini permanece no nível gratuito; os valores registrados são estimativas equivalentes da tabela paga.

## Piloto real de texto — 15/09/2026, 10:17 Brasília

Autorizado explicitamente pelo proprietário nesta sessão: ativar Gemini e usar somente o exemplo autoral do aplicativo, com teto inicial US$ 1. Executado via API autenticada e worker, sem upload de voz. Configuração local: Gemini 3.5 Flash-Lite, thinking minimal, AI_ENABLED=true, revisão de preços em 15/09/2026. Teto mensal reduzido pela rota PATCH /api/profile para US$ 1; alerta US$ 0,80. Nenhum limite foi alterado no provedor.

| Verificação | Resultado |
|---|---|
| Credencial Gemini / models.get | HTTP 200; modelo disponível para consulta na conta. |
| Geração pelo worker | Job ready, 1993 ms. Atividade Investigating Flaky Tests salva como gemini_unreviewed. |
| Evidência da atividade | Os três segmentIds existem na fonte. Inspeção do agente: pergunta e resposta esperada correspondem ao problema de fixture compartilhada sob carga e ao teste com um worker; expressões flakes out e narrow down ocorrem no texto. Não substitui avaliação pedagógica humana. |
| Tutor por SSE | HTTP 200, eventos text e done; 14284 ms. Explicou under load em português e pediu uma frase original. |
| Uso de geração | 437 tokens de entrada, 341 de saída; US$ 0,000984 estimados. |
| Uso de tutor | 205 tokens de entrada, 97 de saída; US$ 0,000304 estimados. |
| Livro-razão | Total US$ 0,001288; duas reservas settled; saldo reservado US$ 0. |
| Faturamento | Tela Spend do AI Studio conferida no Chrome: nível gratuito, projeto sem faturamento configurado. Valor local é equivalente estimado da tabela paga, não cobrança. |
| Chave YouTube | A primeira chave retornou 401 por estar vinculada à Gemini API. Depois da correção pelo proprietário, a nova chave separada retornou HTTP 200 em `videos.list` e permaneceu somente em `.env.local`. |

Preços oficiais consultados: entrada US$ 0,30 e saída US$ 2,50 por milhão de tokens, modalidade Standard, em https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite. Modelo confirmado também em https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite.

O piloto de texto foi concluído. Não repetir essas inferências automaticamente. Evidência detalhada local em data/tests/text-pilot-20260915.json (ignorado pelo Git). Permanecem pendentes na TASK-001: áudio autorizado, avaliação humana, limites de taxa e corpus. A tela Ajustes e a integração YouTube foram verificadas depois do reinício. A Fase B ainda não está liberada.

## Validação real do YouTube — 15/09/2026, 10:36 Brasília

O proprietário criou uma chave separada, sem conta de serviço e restrita à YouTube Data API v3. A chave não foi exibida nem copiada para documentação.

| Verificação | Resultado |
|---|---|
| Credencial | `videos.list` retornou HTTP 200. Ajustes exibiu YouTube como **Configurado**. |
| Vídeo indicado | `mDxeUnbUOn0`: **How We Built a Custom AI System for a Real Business**, canal **Dev Shah**, `PT8M15S`, incorporável. |
| Fluxo completo | A fonte `5c21c12e-be0d-47cb-84b8-e1760d8cecd9` salvou título, canal, `duration_ms=495000`, `metadata_updated_at` e estado `no_transcript`; o navegador exibiu o player e a orientação para legenda autorizada. |
| Vídeo curto | `Im69kzhpR3I`: `PT3M35S`, incorporável. |
| Vídeo longo | `PkZNo7MFNFg`: `PT3H26M43S`; confirmou o parser com horas. |
| Não incorporável | `3xlegeyULX8`: a API retornou `embeddable=false`. O contrato do worker, o estado `unavailable` e a mensagem sem player já estavam cobertos no teste de integração. |

A consulta usa somente IDs validados e `videos.list`; não houve scraping, download de mídia nem obtenção automática de legenda.

## Piloto real de transcrição por URL — 15/09/2026

Autorizado explicitamente pelo proprietário para o vídeo `mDxeUnbUOn0`, **How We Built a Custom AI System for a Real Business**, com 8 min 15 s e teto do aplicativo mantido em US$ 1. A URL pública foi enviada ao Gemini pelo contrato oficial de vídeo do Interactions; o servidor não baixou mídia.

| Verificação | Resultado |
|---|---|
| Elegibilidade | Vídeo público, incorporável, `duration_ms=495000`, abaixo do limite de 15 min; consentimento explícito registrado antes de cada job. |
| Estimativa | No modelo final `gemini-3.5-flash-lite`, reserva máxima mostrada antes da confirmação: cerca de US$ 0,05, usando 100 tokens/s, 4096 tokens de margem, até 8000 de saída e folga 1,25. |
| Transporte | `interactions.create` com bloco `video` para URL canônica do YouTube, JSON validado localmente, timeout 180 s e `maxRetries: 0`. |
| Resultado externo | Gemini 3.8 Flash, 3.1 Flash-Lite e 3.5 Flash-Lite responderam HTTP 503 `UNAVAILABLE` por alta demanda. Após a correção para o contrato atual de Interactions, 3.5 Flash-Lite respondeu HTTP 500 com a mesma indicação de alta demanda. O 2.5 Flash-Lite respondeu 404 para conta nova e indicou migrar ao 3.5 Flash-Lite; essa reserva foi liberada. |
| Integridade | Zero segmentos persistidos, `transcript_provider`/`transcript_model` nulos e fonte em `needs_review`. Nenhuma transcrição foi simulada ou parcialmente salva. |
| Livro-razão | HTTP 5xx permanece `unknown` para conciliação, como exige o guardrail. Após a última tentativa: US$ 0,342540 reservados como `unknown`; com US$ 0,001288 confirmado do piloto de texto, o painel mostra cerca de US$ 0,34 de uso protegido sob o teto de US$ 1. Falhas 4xx confirmadas ficam `released`. Nenhum `usage_event` de vídeo foi criado porque o provedor não devolveu medição de uso. |
| Disjuntor | A migração 004 registra provedor/modelo na reserva e conta falhas ambíguas por essa identidade, preservando o bloqueio por modelo sem impedir fallback revisado. |
| Custo por minuto | Pendente: não existe uso real retornado pelo provedor para calcular. O valor exibido é teto conservador, não cobrança confirmada. |

Validação local da Fase B: 35 testes, 30 cenários de integração, build de produção, QA isolado e axe em 1440×1000 e 390×844 nos temas claro/escuro. O fluxo sem IA mostra a opção desabilitada, a fixture declarada confirma a proveniência automática, e o fluxo real com IA mostrou custo, saldo, consentimento, fila e progresso por SSE. A tentativa final após a correção de contrato retornou HTTP 500 por alta demanda. Uma nova tentativa só deve ocorrer por ação consciente do proprietário em outro momento; o SDK não repete chamadas.

## Fluxo real por legenda fornecida — 15/09/2026

O vídeo público `fwe81ITBSfI`, **A Day in the Life of an Amazon Software Engineer**, de Sarah Li, exibe transcrição no próprio YouTube. O proprietário autorizou o uso da legenda nessa fonte de estudo. A transcrição auto-gerada em inglês foi exportada pela interface oficial do YouTube, convertida em WebVTT localmente e colada no fluxo de legenda fornecida; o servidor não baixou mídia nem fez scraping.

| Verificação | Resultado |
|---|---|
| Trechos | 53 trechos em inglês carregados; a tela os identifica como `Tempo aproximado · legenda fornecida`. |
| Proveniência | A fonte permanece vinculada ao vídeo original pelo player oficial e à legenda fornecida pelo proprietário. |
| Atividade | Worker concluiu a geração e a tela exibiu **Work Culture and Team Environment**. A pergunta pede 2–3 frases sobre como a autora descreve a cultura e o ritmo de trabalho na organização Amazon, com referência aos trechos carregados. |
| Custo da atividade | Evento conciliado `Preparação` às 15:14:35 Brasília: 862 tokens de entrada, 271 de saída, **US$ 0,000937** estimados. É a geração associada a esta fonte no fluxo observado. |
| Limite de custo | Painel do aplicativo permaneceu sob o teto: US$ 0,34 de US$ 1,00. A exibição arredondada não é uma fatura; inclui reservas ambíguas de tentativas anteriores de transcrição direta por URL. |

Esse fluxo prova o caminho de produto “vídeo → legenda legítima → trechos → atividade”; ele não substitui a pendência de TASK-004, que exige medir a transcrição direta de URL pelo Gemini.

## Piloto OpenAI de texto — 15/09/2026, 16:48 Brasília

O proprietário autorizou o piloto e registrou uma chave apenas em `.env.local`. O modelo selecionado foi `gpt-4o-mini`, com preços revisados em 15/09/2026 (US$ 0,15 por milhão de tokens de entrada; US$ 0,60 de saída). O teto do aplicativo permaneceu em US$ 1, sem retentativas automáticas.

| Verificação | Resultado |
|---|---|
| Geração de atividade | Job `ready` na fonte **A Day in the Life of an Amazon Software Engineer**. A unidade `Explorando a Cultura de Trabalho` foi persistida como `openai_unreviewed`, com IDs de evidência válidos. |
| Tutor por SSE | A pergunta sobre o uso de `fast-paced` retornou explicação em português, exemplo em inglês e pedido de frase autoral. |
| Uso da atividade | 876 tokens de entrada, 203 de saída, **US$ 0,000254** estimados. |
| Uso do tutor | 526 tokens de entrada, 87 de saída, **US$ 0,000132** estimados. |
| Livro-razão | Duas reservas `settled`; modelo `gpt-4o-mini`; `price_version=openai:2026-09-15`; total do piloto **US$ 0,000386**. |
| Qualidade | Inspeção técnica confirmou que a atividade referencia o trecho sobre cultura da organização. Ela não substitui o juízo humano de utilidade pedagógica, que permanece pendente. |

O painel da OpenAI precisa ser consultado após o uso aparecer no provedor antes de declarar a conciliação com faturamento. A transcrição de voz não foi enviada à OpenAI: o adaptador mantém a regra de só concluir avaliações quando há uso retornado e auditável.

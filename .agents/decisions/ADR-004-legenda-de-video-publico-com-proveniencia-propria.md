---
id: ADR-004
title: Legenda de vídeo público tem proveniência própria, em vez de se disfarçar de material do proprietário
status: accepted
date: 2026-09-17
---

# ADR-004 — Legenda de vídeo público tem proveniência própria

## Contexto

`POST /api/sources/:id/segments` aceitava apenas `rights: "owned" | "licensed"`, sobrescrevia `sources.rights` com o valor recebido e gravava todo trecho com `origin='user_upload'`.

Em 2026-09-17 o proprietário quis estudar uma entrevista pública de 1h10 usando a legenda automática que o próprio YouTube exibe. O caminho da transcrição por IA não serve: `MAX_VIDEO_TRANSCRIPTION_MS` limita a 15 minutos. Sobrava a rota de legenda — e passar por ela exigia declarar que uma entrevista de terceiros era material próprio ou licenciado, e que o texto era um envio do proprietário. Três afirmações falsas gravadas exatamente nos campos que existem para registrar a origem, além de reclassificar a fonte de `public_link` para outra coisa.

A Constituição admite "legendas fornecidas legitimamente pelo proprietário", e o papel `fontes-proveniencia` é explícito: "Conteúdo gerado por IA nunca é tratado como transcrição verificada" e "`quality_status` e `origin` precisam refletir a origem real". O produto não tinha vocabulário para o caso real, e a ausência de vocabulário estava empurrando para a mentira.

## Decisão

O caso ganha rótulo próprio em vez de vaga sob um rótulo existente.

- `rights` passa a aceitar `public_link` nesta rota, e **apenas** quando a fonte já foi criada como link público. Caso contrário, `RIGHTS_MISMATCH`. Não é um caminho para reclassificar fonte.
- Com `public_link`, os direitos da fonte **não** mudam: a fonte continua sendo um link público, que é o que ela é.
- Os trechos entram com `origin='public_caption'` e `quality_status='ai_unreviewed'` — legenda de máquina, não revisada, com o mesmo estado da transcrição do Gemini, para não virar cartão sem alguém ter lido. `time_accuracy` continua vindo do arquivo, tipicamente `approximate`.
- A tela nomeia isso ao pé do trecho: "Legenda automática do vídeo público, não revisada · tempo aproximado".

## Alternativas consideradas

- **Declarar `licensed` e seguir.** Uma linha, nenhum código novo, e o registro passaria a afirmar uma licença inexistente enquanto reclassificava a fonte. É exatamente a classe de mentira que `origin` e `quality_status` existem para impedir. Rejeitada.
- **Não permitir.** Mantém o contrato intacto e deixa o proprietário sem caminho para estudar vídeo público com mais de 15 minutos — que é o caso comum da biblioteca dele. Rejeitada.
- **Estender a transcrição por IA para vídeos longos.** Resolveria outro problema (custo e limite de duração), não este, e continuaria sem vocabulário para legenda que não veio do nosso provedor. Fora de escopo.

## Consequências

- Existe um terceiro valor de `origin` (`public_caption`) além de `user_upload`, `provider_video_url`, `example`. Nenhuma migração: a coluna é texto sem CHECK.
- O contrato público mudou; `docs/API.md` foi atualizado junto.
- Trechos assim nascem `ai_unreviewed`, então continuam pedindo revisão humana antes de virar cartão. Isso é intencional: a legenda automática do YouTube erra nomes próprios e pontuação.
- A obtenção da legenda continua fora do servidor. O servidor não busca, não baixa e não raspa nada; ele recebe um texto que o proprietário forneceu, e agora consegue dizer a verdade sobre o que recebeu.
- Permanece a tensão declarada na Constituição sobre raspagem: o ADR não a resolve, apenas garante que, qualquer que seja a forma de obtenção, o registro não minta sobre a origem.

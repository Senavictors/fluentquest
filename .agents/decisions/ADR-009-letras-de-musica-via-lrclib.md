---
id: ADR-009
title: Letras de música vêm do LRCLIB por host fixo, com proveniência própria e tempo aproximado
status: accepted
date: 2026-10-14
deciders: [Senavictors]
related_tasks: [TASK-018, TASK-019, TASK-020, TASK-021, TASK-022]
---

# ADR-009 — Letras de música vêm do LRCLIB por host fixo, com proveniência própria e tempo aproximado

## Contexto

O proprietário já estuda música no FluentQuest, mas pelo caminho errado: a fonte `Drake - Not You Too (feat. Chris Brown)` foi criada como **Material próprio**, com 67 trechos colados à mão e sem tempo. Isso tem três defeitos:

1. **Proveniência falsa.** A letra não é material do proprietário — é o mesmo problema que o ADR-004 resolveu para legenda de vídeo público.
2. **Trabalho manual.** Buscar, copiar e colar cada letra.
3. **Sem sincronização.** Sem `start_ms`, a sala de estudo não acompanha a música; o recurso mais forte do app (ouvir e ler ao mesmo tempo, modo cinema) fica de fora.

Levantamento de APIs feito em 14/10/2026:

| Plataforma | Gratuita | Letra | Letra sincronizada | Observação |
|---|---|---|---|---|
| LRCLIB (`lrclib.net`) | Sim, sem chave | Sim | Sim (LRC por linha; às vezes por palavra) | CORS aberto; exige `User-Agent` identificado; respeitar `429` + `Retry-After` |
| Spotify Web API | Restrita (dev mode exige Premium do dono, 5 usuários) | **Não existe endpoint** | Não | Útil só para metadados |
| Musixmatch | Não (a partir de US$ 49/mês, 500 letras/dia) | Sim | Só a partir de US$ 199/mês | Único caminho licenciado |
| Genius | Sim (metadados) | Não — só URL da página | Não | Obter a letra exigiria scraping |
| Letras.mus.br | Sem API pública | — | — | Só scraping |
| Vagalume | Exigia chave | Sim | Não | API respondeu 503 no levantamento |

Restrições que pesam (Constituição e regras globais):

- **Sem scraping.** Genius e Letras.mus.br ficam fora por definição.
- **O servidor nunca faz fetch de URL arbitrária vinda do usuário.** Há precedente de host fixo: `src/server/providers.ts` consulta `https://www.googleapis.com/youtube/v3/videos` com parâmetros validados.
- **Não introduzir dependência nova.** `fetch` nativo e Zod bastam.
- **Nunca inventar sincronização** (`fontes-proveniencia`, regra 1).

## Decisão

1. **O formato LRC passa a ser lido pelo domínio** (`parseContent` em `src/domain/content.ts`), sem rede. Isso por si só já permite importar um arquivo `.lrc` manualmente.
2. **Busca e obtenção no LRCLIB por um adaptador de host fixo** em `src/server/`, só `GET https://lrclib.net/api/search` e `GET https://lrclib.net/api/get/{id}`. O usuário nunca fornece URL; fornece termo de busca ou ID numérico. `User-Agent: FluentQuest/<versão> (https://github.com/Senavictors/fluentquest)`, timeout de 15 s, `429` vira erro honesto com o `Retry-After` informado — **sem nova tentativa automática**.
3. **Proveniência própria.** Trechos de letra entram com `origin='lyrics_catalog'`, `quality_status='community_unreviewed'` e `time_accuracy='approximate'` quando vierem de `syncedLyrics` (ou `'none'` quando só houver `plainLyrics`). A tela rotula: "Letra da comunidade (LRCLIB), não revisada · tempo aproximado".
4. **Atribuição persistida.** A fonte guarda `catalog_provider='lrclib'`, `catalog_id`, artista, álbum e duração declarada, para reimportar e deduplicar.
5. **Música e vídeo são vinculáveis, não fundidos.** A fonte pode ser só letra (`kind='text'`) ou letra + vídeo oficial do YouTube (`kind='youtube'`, player oficial em iframe, já suportado). O servidor não baixa áudio.
6. **Desligável.** `LYRICS_CATALOG_ENABLED` (default `false` até a TASK-019 estar verde). Desligado, a aba mostra "integração não configurada" e o caminho manual de `.lrc` continua funcionando.

## Alternativas consideradas

### Alternativa A — Só importação manual de `.lrc` (sem rede)
Vantagens: zero dependência externa, zero risco de rede. Desvantagens: continua exigindo que o proprietário ache e baixe o arquivo. **Adotada como base (item 1)**, não como solução completa.

### Alternativa B — Cliente chama o LRCLIB direto do navegador (CORS aberto) e envia o texto ao servidor
Vantagens: o servidor não faz nenhum fetch novo, igual ao ADR-004 ("o servidor recebe um texto que o proprietário fornece"). Desvantagens: a resposta não é validada no servidor, a proveniência (`catalog_id`) passa a ser declarada pelo cliente e pode ser forjada, e o `User-Agent` não pode ser definido pelo navegador (teria de usar `X-User-Agent`). Rejeitada como caminho principal; continua como plano B se o host fixo for vetado.

### Alternativa C — Musixmatch (licenciado)
Vantagens: único caminho com licença explícita, inclui tradução. Desvantagens: US$ 49–199/mês para um app pessoal. Rejeitada agora; volta à mesa se o app deixar de ser de proprietário único.

## Consequências

### Positivas
- A letra deixa de se passar por material do proprietário.
- A música ganha tempo, então loop de trecho, salto e modo cinema passam a funcionar com ela.
- Nenhuma dependência nova; o padrão de host fixo já existe no projeto.

### Negativas
- Mais uma integração externa para manter (formato da resposta pode mudar — mitigado por schema Zod e `lyricsfile` ignorado na primeira versão).
- Tempo do LRC é de comunidade: pode estar deslocado da gravação do vídeo escolhido.

### Riscos
- **Direitos autorais** (impacto médio): letras são obras protegidas; o LRCLIB é base comunitária, não licenciada. Aceitável enquanto o app for de proprietário único, atrás de login e sem rota pública. Se isso mudar, reavaliar (Alternativa C).
- **Descompasso de tempo** (impacto baixo): o vídeo do YouTube pode ter introdução diferente da gravação do LRC. Mitigação: ajuste de deslocamento na sala (TASK-022) e rótulo "tempo aproximado".
- **Indisponibilidade/limite do LRCLIB** (impacto baixo): letra já importada fica no banco; só a busca nova falha.

## Plano de adoção

TASK-018 (domínio, sem rede) → TASK-019 (adaptador e rota de busca) → TASK-020 (persistência e proveniência, migração 008) → TASK-021 (interface de importação) → TASK-022 (karaokê na sala de estudo). TASK-018 entrega valor sozinha e não depende desta decisão ser aceita por completo.

## Validação

- Importar `Not You Too` pelo fluxo novo gera trechos com `start_ms` crescente, origem `lyrics_catalog` e rótulo correto na tela.
- `docs/API.md` lista as rotas novas; `scripts/integration.ts` cobre busca com o adaptador simulado, `429` e catálogo desligado — **sem chamada real ao LRCLIB nos testes**.

## Revisão

Quando o app passar a ter mais de um usuário, quando o LRCLIB passar a exigir chave, ou em 2027-04-14 — o que vier primeiro.

## Perguntas abertas para o proprietário

- `sources.rights` para letra: reaproveitar `public_link` (só quando há vídeo) ou criar um valor novo, como `third_party`? A TASK-020 propõe `third_party`.

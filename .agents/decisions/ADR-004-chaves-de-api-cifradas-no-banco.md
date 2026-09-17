---
id: ADR-004
title: Chaves de provedor cadastráveis pela interface, cifradas no banco, com o ambiente como fallback
status: accepted
date: 2026-09-17
---

# ADR-004 — Chaves de provedor cadastráveis pela interface, cifradas no banco, com o ambiente como fallback

## Contexto

Até aqui, registrar ou trocar uma chave de provedor exigia editar `.env.local` e reiniciar web e worker. Para um aplicativo de proprietário único, rodando em loopback, isso significa sair da aplicação, abrir um arquivo de texto e derrubar dois processos para uma operação que é do próprio dono do sistema — e a tela Ajustes só sabia dizer "não configurado", sem oferecer o caminho.

O acoplamento também esconde diagnóstico. Um provedor de texto pronto depende de três coisas independentes: chave presente, preço revisado dentro dos 31 dias e `AI_ENABLED=true`. A tela colapsava as três num único rótulo, então "não configurado" não distinguia "falta a chave" de "o preço venceu ontem".

## Decisão

A chave passa a ser um dado do proprietário, guardado no banco e cadastrável em Ajustes. `AI_ENABLED`, `AI_TEXT_PROVIDER` e as datas de revisão de preço **continuam no ambiente**.

- Migração 007 cria `integration_credentials` (`user_id`, `provider`, ciphertext, iv, tag, `hint`). Provedores aceitos: `gemini`, `openai`, `youtube`.
- A chave é cifrada com AES-256-GCM antes de tocar o banco, com chave derivada por SHA-256 de `BETTER_AUTH_SECRET` sob rótulo próprio (`fluentquest:credential:v1:`). O motivo é concreto: `scripts/backup.ts` despeja o banco, e um dump com credencial em texto puro transforma cópia de segurança em vazamento.
- `hint` guarda os quatro últimos caracteres em claro. É o que a interface mostra; a chave em si **nunca** volta por nenhuma rota, e `GET /api/account/export` lista tabelas por allowlist, onde a tabela nova não entra.
- A chave cadastrada tem precedência sobre a variável de ambiente, e a ausência dela cai de volta no ambiente. Quem já tem `.env.local` funcionando não recadastra nada, e a tela diz de onde a chave em uso está vindo (`origin`: `interface` ou `ambiente`).
- `integrationStatus()` passa a expor `enabled`, `keys` e `detail` — para cada provedor de texto, `key`, `prices` e `ready` separados, de modo que a tela nomeie o requisito que falta.
- Salvar uma chave **não** dispara chamada de validação ao provedor. Verificar custaria uma inferência real, e a regra de que a reserva antecede a inferência não abre exceção para teste de credencial.

## Alternativas consideradas

- **Escrever `.env.local` a partir da interface.** Mantém uma única fonte de verdade e nenhuma cifragem nova, ao custo de exigir reinício de web e worker para a chave valer — exatamente o incômodo que motivou a mudança — e de dar à aplicação permissão de escrita sobre o próprio arquivo de configuração. Rejeitada.
- **Guardar a chave em claro numa coluna.** Menos código e nenhuma dependência de `BETTER_AUTH_SECRET`. Rejeitada pelo backup: o dump sai do controle do banco e circula como arquivo.
- **Trazer também `AI_ENABLED` e a revisão de preço para a interface.** Tornaria a ativação inteira autocontida, mas são justamente os dois controles que autorizam gasto real; mantê-los como ato deliberado no ambiente preserva o freio descrito em ADR-001. Adiada, não descartada.
- **Validar a chave ao salvar, com uma chamada barata.** Daria certeza imediata. Rejeitada: seria inferência sem reserva prévia, e uma chave inválida já falha de forma legível na primeira utilização real.

## Consequências

- Trocar uma chave passa a valer sem reinício. O worker é outro processo e lê o banco a cada job (`refreshCredentials(job.user_id)`); o servidor recarrega a cada requisição, com cache de 10 s.
- `credential()` é síncrona e lê um cache de processo, porque `providerConfig()` e `youtube.get()` são chamados longe de qualquer `userId`. O cache é global e guarda o `userId` carregado — correto porque a instalação é de proprietário único por construção (`scripts/owner.ts` recusa criar um segundo). Se o projeto algum dia aceitar mais de um usuário, este cache precisa virar contexto por requisição.
- Trocar `BETTER_AUTH_SECRET` torna as chaves guardadas ilegíveis. O comportamento escolhido é degradar para "sem chave" — o estado verdadeiro — em vez de erro: a tela continua abrindo e o proprietário recadastra.
- A tabela entra no backup cifrada, e não entra na exportação de dados do proprietário.

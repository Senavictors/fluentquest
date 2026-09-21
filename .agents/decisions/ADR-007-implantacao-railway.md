---
id: ADR-007
title: Implantar no Railway com PostgreSQL vazio e arquivos em volume persistente
status: accepted
date: 2026-09-19
deciders: [Victor Sena]
related_tasks: [TASK-016]
---

# ADR-007 — Implantar no Railway com PostgreSQL vazio e arquivos em volume persistente

## Contexto

Em 19/09/2026, o proprietário decidiu começar com um banco vazio e preparar o FluentQuest para Railway. O `.env.local` e o PostgreSQL da máquina antiga não estão disponíveis. O repositório não contém dump válido para recuperação, e as credenciais antigas de `BETTER_AUTH_SECRET` também não estão disponíveis.

O código atual é Next.js 16 com API e um worker `pg-boss`. Gravações e uploads são gravados em `DATA_DIR/objects`; web e worker precisam enxergar o mesmo diretório. A Constituição mantém a IA desativada por padrão, e o produto aceita apenas um proprietário, sem cadastro público.

## Decisão

- Railway será o destino de hospedagem, conectado ao repositório `Senavictors/FluentQuest` na branch `main`.
- Criar um serviço PostgreSQL gerenciado vazio e aplicar as migrações versionadas como comando pre-deploy. Não importar dados antigos nem executar o setup local, que cria roles/bancos e recusa entidades existentes.
- Manter web e worker no mesmo serviço Railway, uma réplica, para compartilhar um volume persistente montado em `/app/data`. O volume inicial configurado é 1 GiB.
- O app recebe `DATABASE_URL` por referência privada ao serviço PostgreSQL. A imagem Docker executa Next em `0.0.0.0` usando `PORT` do Railway e mantém `AI_ENABLED=false`.
- `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` ficam como variáveis de ambiente geridas no Railway, preservadas pela configuração. O segredo deve ser criado antes de deixar o app utilizável e não deve ser versionado.
- A origem de autenticação será a URL HTTPS definitiva. Cadastro permanece desabilitado; o proprietário é criado uma única vez com `owner:create:railway` depois de as migrações terminarem.
- Nenhum domínio público é declarado na IaC. A publicação do app e geração de domínio serão uma etapa explícita no projeto Railway dedicado.

## Alternativas consideradas

- **Importar banco ou segredos locais antigos.** Rejeitada: o arquivo e os backups não estão disponíveis; sem o antigo segredo as credenciais de provedores criptografadas seriam ilegíveis. O proprietário escolheu começar vazio.
- **Separar web e worker em dois serviços.** Rejeitada: uploads e gravações usam armazenamento de arquivos local; um volume Railway só pode ser anexado a um serviço, e os dois processos precisam ver os mesmos arquivos.
- **Manter somente serviço local.** Rejeitada pelo objetivo explícito de preparar o app para Railway.
- **Ativar IA na primeira implantação.** Rejeitada: exigiria credenciais e uma autorização de custo independente; a implantação começa com IA desligada.

## Consequências

- O primeiro uso remoto começa sem fontes, cartões, revisões ou conta proprietária. As migrações criam o schema e o proprietário será criado pela operação de bootstrap.
- Uploads dependem do volume persistente; backups desse volume e do PostgreSQL são responsabilidades distintas.
- O worker fica na mesma réplica da web. Escalar a réplica ou separar os processos exigiria reavaliar exclusividade de arquivo e processamento da fila.
- A aplicação passará a ter endereço público apenas quando o proprietário gerar um domínio para o serviço. A autenticação deve usar exatamente esse endereço.
- A mudança não provisiona recursos nem publica código; `railway config plan` deve ser revisto antes de qualquer aplicação na conta.

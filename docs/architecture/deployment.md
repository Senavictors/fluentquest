---
estado: real
fonte: package.json, Dockerfile, .railway/railway.ts, scripts/migrate.ts, scripts/setup.ts
ultima-revisao: 2026-09-30 (TASK-016, ADR-007)
---

# Implantação

## Railway — provisionado em 21/09, sem proprietário e sem domínio

O proprietário escolheu iniciar com um banco novo e vazio. A configuração versionada declara o repositório `Senavictors/FluentQuest` (`main`), um PostgreSQL gerenciado, o app e um volume inicial de 1 GiB. Ela foi aplicada em 21/09 no projeto dedicado `FluentQuest` (região `us-west2`); o projeto `PhisioFlow` da mesma conta não deve ser usado.

Estado conferido em 05/10: app e Postgres no ar, domínio `https://fluentquest.up.railway.app`, `BETTER_AUTH_URL` igual a esse endereço, código da `main` até `0104dd1` publicado com `railway up` (o Railway **não** faz deploy automático dos pushes), nenhum usuário e sem backups — o backup nativo do Railway exige o plano Pro e foi dispensado por ora, então não grave dado que não possa perder. Detalhe e próximos passos em `.agents/tasks/active/TASK-016-preparar-implantacao-railway.md`.

**Primeiro acesso (ADR-008, TASK-017).** O caminho recomendado para criar a conta é a tela: defina `FQ_SETUP_TOKEN` no serviço (16+ caracteres aleatórios, em *Variables*), abra o domínio e preencha e-mail, senha e esse código. A tela só existe enquanto não há usuário; **remova `FQ_SETUP_TOKEN` assim que a conta for criada**. O comando por SSH do passo 6 continua válido como alternativa — o `railway ssh` interativo falhou no PowerShell do Windows (o Enter não chega ao container).

`Dockerfile` instala dependências, gera o build Next.js e mantém as dependências necessárias ao worker. `.dockerignore` exclui arquivos `.env*`, dados locais e diretórios privados do contexto de build. `npm run start:railway` inicia web e worker juntos: o Next escuta em `0.0.0.0` usando `PORT`, e ambos compartilham o volume `/app/data`. O serviço fica com uma réplica porque esse volume e os processos locais de arquivo não foram projetados para múltiplas réplicas.

| Recurso | Configuração |
|---|---|
| Serviço de app | Imagem Docker, Next + worker em um processo supervisionado por `concurrently`, 1 réplica |
| PostgreSQL | Serviço gerenciado novo; `DATABASE_URL` injetado como referência privada |
| Migrações | `npm run db:migrate:railway` em pre-deploy, antes da inicialização do app |
| Arquivos privados | Volume de 1 GiB montado em `/app/data`; `DATA_DIR=/app/data` |
| IA | `AI_ENABLED=false`; nenhuma chave de provedor é declarada |
| Domínio | Não é criado pela IaC. Publicação fica para uma ação explícita no serviço Railway |

### Preparação para aplicar

1. Instale/atualize a [Railway CLI](https://docs.railway.com/cli), autentique e crie um projeto Railway vazio dedicado ao FluentQuest. Não conecte esta configuração a outro projeto com serviços que devam ser preservados.
2. No diretório do repositório, faça `railway link` para selecionar esse projeto e o ambiente desejado.
3. Execute `railway config plan`. Revise se o plano adiciona somente o serviço do app, o PostgreSQL e o volume, sem remover recursos.
4. Depois de revisar o plano, execute `railway config apply`. Essa etapa cria recursos e pode gerar cobrança.
5. Configure `BETTER_AUTH_SECRET` como variável secreta com valor aleatório forte (pelo menos 32 caracteres). A configuração usa `preserve()` para manter esse valor; ela não inventa nem grava um segredo no Git. Se o app falhar antes da variável existir, salve o segredo e redeploye.
6. Confirme que as migrações terminaram e o app subiu. Antes de publicar um domínio, crie o único proprietário via shell do serviço: no Railway, copie o **Service Instance ID** do app e conecte com `ssh <SERVICE_INSTANCE_ID>@ssh.railway.com` (o primeiro uso pode pedir para registrar uma chave SSH). Dentro do container, leia os dados sem colocá-los no histórico do shell:

   ```sh
   read -r -p "E-mail do proprietário: " OWNER_EMAIL
   read -r -s -p "Senha (12+ caracteres): " OWNER_PASSWORD
   printf '\n'
   export OWNER_EMAIL OWNER_PASSWORD
   npm run owner:create:railway
   unset OWNER_EMAIL OWNER_PASSWORD
   ```

   O comando recusa criar uma segunda conta. Não salve a senha como variável permanente do Railway.
7. Quando estiver pronto para acessar pela internet, gere o domínio do serviço pela interface Railway, configure `BETTER_AUTH_URL` com a origem HTTPS exata (por exemplo `https://nome.up.railway.app`) e redeploye. Better Auth valida essa origem; endereço divergente causa 403 no login.

`BETTER_AUTH_SECRET` também deriva a chave que cifra credenciais de provedores guardadas no PostgreSQL. Depois de configurar, mantenha o mesmo segredo em todos os deploys e backups. O cadastro pela interface continua desabilitado; a IA continua desligada até autorização e configuração próprias.

O app, banco e volume devem permanecer na mesma região. A configuração omite uma região específica para usar a seleção padrão do projeto Railway. Se a região for escolhida manualmente, mantenha app, PostgreSQL e volume juntos; mudar o posicionamento do volume pode afetar dados persistidos.

O backup do PostgreSQL e o do volume são independentes. Configure e verifique os backups de cada recurso na Railway antes de guardar gravações importantes; o `npm run backup` atual é um procedimento local, não um backup automático dos serviços Railway.

## Ambiente local

Desde 30/09 o PostgreSQL local roda em Docker, não como serviço do Windows: container `fluentquest-postgres` (`postgres:18`, volume nomeado `fluentquest-pgdata`, `--restart unless-stopped`) publicado só em `127.0.0.1:5433` — a 5432 é do PhisioFlow. `.env.setup` aponta para o superusuário desse container; `npm run setup` criou o banco e o usuário `fluentquest` e gravou `.env.local`. O proprietário local é uma conta de teste cujas credenciais estão só em `.env.owner`. Não há dado de estudo antigo nesse banco.

Sem binários do PostgreSQL no Windows, `PG_BIN` de `.env.local` não aponta para nada: `npm run backup` e `restore` não funcionam até `pg_dump`/`pg_restore` existirem no host ou os scripts passarem a usar o container.

## Processos/serviços

| Serviço | Processo | Porta | Path público | Env relevantes |
|---|---|---|---|---|
| Web | `next dev --hostname 127.0.0.1 --port 3215` (dev) / `next start --hostname 127.0.0.1 --port 3215` (produção local) | 3215 | nenhum — só loopback | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AI_ENABLED`, `DATA_DIR` |
| Worker | `tsx watch --env-file=.env.local src/worker.ts` (dev) / `tsx --env-file=.env.local src/worker.ts` | — | — | as mesmas, mais `PG_BIN` para manutenção |
| PostgreSQL | container Docker `fluentquest-postgres` | 5433 (loopback) | — | — |

`npm run dev` sobe web e worker juntos via `concurrently -k`; `Ctrl+C` encerra os dois.

## Roteamento/proxy

Não há. A escolha de `--hostname 127.0.0.1` é deliberada: a aplicação **não** escuta em interface de rede e não é alcançável por outro computador. A porta 3215 foi escolhida por não colidir com os outros projetos locais do proprietário (3000, 3900, 4300 e 5000 estão ocupadas por outros serviços).

**Armadilha conhecida, já observada na prática**: Better Auth valida a origem contra `BETTER_AUTH_URL`. Com a base em `http://localhost:3215`, abrir a aplicação por `http://127.0.0.1:3215` faz toda mutação responder **403 `Invalid origin`** — inclusive o login, que falha *antes* de a senha ser avaliada. Use sempre `localhost`, ou ajuste `BETTER_AUTH_URL`. O arquivo `.claude/launch.json` já fixa a URL correta do preview.

## Variáveis de ambiente relevantes

- `DATABASE_URL` — conexão do usuário exclusivo `fluentquest`. Gerada com senha aleatória por `scripts/setup.ts`.
- `BETTER_AUTH_SECRET` — segredo de sessão, mínimo de 32 caracteres.
- `BETTER_AUTH_URL` — base e origem confiável da autenticação. Default `http://localhost:3215`.
- `AI_ENABLED` — default `false`. Enquanto falso, as funções de IA informam "integração não configurada".
- `AI_TEXT_PROVIDER` — seleciona `gemini` ou `openai` para tutor, atividade e tradução.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION`, `AI_PRICES_REVIEWED_ON` — Gemini para texto quando selecionado, vídeo por URL e transcrição de fala; a revisão vence em 31 dias.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`, `OPENAI_PRICES_REVIEWED_ON` — OpenAI para texto; a revisão vence em 31 dias. A chave nunca é exposta ao cliente.
- `YOUTUBE_API_KEY` — opcional; só habilita metadados. O player funciona sem ela.

As três chaves (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`) também podem ser cadastradas em Ajustes → Integrações, onde ficam cifradas na tabela `integration_credentials` e valem para web e worker sem reinício; a chave cadastrada tem precedência sobre a variável correspondente, que permanece como fallback (ADR-005). `AI_ENABLED`, `AI_TEXT_PROVIDER` e as datas de revisão de preço continuam exclusivamente no ambiente. Trocar `BETTER_AUTH_SECRET` torna as chaves guardadas ilegíveis e elas passam a contar como ausentes.
- `DATA_DIR` — raiz dos arquivos privados (default `./data`).
- `PG_BIN` — caminho dos binários do PostgreSQL, usado por backup e restauração.

Arquivos de ambiente: `.env.local` (aplicação), `.env.setup` (credencial administrativa para provisionamento) e `.env.owner` (credenciais do proprietário). Nenhum é versionado; `.env.example` é o modelo.

## Boot da aplicação

1. Provisionamento, uma única vez: `npm run setup` cria banco e usuário (recusa sobrescrever existentes) e `npm run db:migrate` aplica as migrações.
2. Criação do proprietário, uma única vez: `npm run owner:create` lê `.env.owner`. O script recusa criar um segundo proprietário e o cadastro pela interface é desabilitado.
3. `npm run dev` sobe web e worker. O worker conecta ao `pg-boss` e informa o estado das integrações no log.
4. O cliente carrega `GET /api/bootstrap`, que responde 401 enquanto não há sessão — é o comportamento esperado na tela de login.

## Armazenamento de arquivos

`data/objects/`, fora de qualquer pasta pública, com `DATA_DIR` configurável. Gravações têm `expires_at` padrão de 7 dias e sinalizador `preserve`; a expiração é executada pelo worker. Backups manuais vão para `backups/<timestamp>/` via `npm run backup`.

## Observabilidade

Log de console dos dois processos, `job_events` como trilha persistente por job e `usage_events` como livro-razão de custo de IA. Não há métricas, tracing ou alerta externo.

## Divergência conhecida

Nenhuma divergência entre este documento e o código. Pendência operacional registrada em [`../OPERACAO.md`](../OPERACAO.md): o backup é manual, e nenhuma tarefa agendada do Windows foi criada.

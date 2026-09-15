# FluentQuest

Aplicativo pessoal de inglês para desenvolvedores: conteúdo, produção, fala e revisão. Implementado a partir da documentação e dos mockups fornecidos, com PostgreSQL local e integrações de IA desativadas por padrão.

## Abrir neste computador

O projeto está em **`C:\Users\Essencis007\Documents\FluentQuest`**.

1. Abra um terminal nessa pasta.
2. Execute `npm run dev`.
3. Acesse **http://localhost:3215**.
4. Entre com o e-mail e a senha definidos em **`.env.owner`**, na raiz do projeto. Esse arquivo local não é versionado. Não use a senha administrativa do PostgreSQL para entrar no aplicativo.

`npm run dev` inicia a interface e o worker persistente. Encerre ambos com Ctrl+C. A aplicação escuta somente em loopback: não está publicada nem disponível para outros computadores.

O banco e o usuário exclusivos `fluentquest` já foram criados. As credenciais do banco estão em `.env.local`. Bancos de outros projetos não são alterados.

## Primeiro ciclo de estudo

1. Ajuste seu perfil e objetivos em **Hoje → Ajustar meu perfil**.
2. Inicie uma sessão. Sem fontes, o aplicativo oferece o texto autoral de exemplo “Debugging a flaky test”. Ele não é atribuído a um vídeo real.
3. Leia os trechos, revele a tradução disponível e escolha **Preparar cartão**. Revise expressão, sentido e exemplo antes de salvar.
4. Abra **Atividade**, tente responder sem consultar e registre a tentativa. O exemplo libera uma resposta de referência depois do envio; não finge avaliar sua resposta.
5. Vá a **Praticar**, autorize o microfone, grave até 90 segundos, ouça e salve. Você pode descartar antes de salvar ou responder por texto.
6. Em **Revisar**, recupere a expressão antes de revelar. Escolha Esqueci, Difícil, Bom ou Fácil. O FSRS agenda o próximo encontro; um toque errado pode ser corrigido.
7. Encerre por Hoje. A Jornada registra a prática sem convertê-la em certificado de fluência.

## O que funciona sem IA

- Login restrito ao proprietário; perfil e preferências persistentes.
- Biblioteca de URLs YouTube, texto, SRT/VTT e mídia própria autorizada de até 25 MB/30 minutos.
- Player oficial YouTube e mídia própria, texto segmentado, retomada de posição e ferramentas, modo imersão e tradução editorial do exemplo.
- Atividades de produção independentes e resposta de referência do exemplo.
- Gravação, reprodução, exclusão e preservação opcional de amostras. O servidor verifica o conteúdo real e a duração do áudio usando ffprobe.
- Cartões confirmados, revisão FSRS, histórico, XP, reflexão de nova tentativa e desafio semanal.
- Temas claro/escuro, layout para celular, atalhos R/T configuráveis, exportação e exclusão.
- Controle de orçamento, fila persistente, retenção e scripts de backup/restauração.

Tutor, tradução automática, geração de atividades e feedback de fala informam **“integração não configurada”** até ativar os provedores. Não existe avaliação fonética nesta versão. Os resultados de IA, latência e custos reais precisam do piloto descrito em [INTEGRACOES.md](docs/INTEGRACOES.md).

## Instalação em outro ambiente local

Requisitos: Node.js compatível com Next.js (testado com 26.4.0), npm e PostgreSQL 18. Não é necessário Docker.

```powershell
npm ci
```

Crie `.env.setup` localmente:

```dotenv
ADMIN_DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/postgres
```

Execute `npm run setup` e `npm run db:migrate`. O setup recusa sobrescrever banco ou usuário já existentes e gera uma senha aleatória para a aplicação.

Crie `.env.owner`:

```dotenv
OWNER_EMAIL=seu-email@example.com
OWNER_NAME=Seu nome
OWNER_PASSWORD=uma-senha-exclusiva-com-12-ou-mais-caracteres
```

Execute `npm run owner:create`. O comando recusa criar outra conta se já existir um proprietário. O cadastro pela interface está desabilitado.

Para uso sem o servidor de desenvolvimento: `npm run build`, depois `npm start` e, em outro terminal, `npm run worker`.

## Verificação

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
```

Os testes de integração criam um banco temporário com prefixo `fluentquest_test_`, aplicam migrações, testam o ciclo e removem somente esse banco. Precisam de `.env.setup`. Não usam dados de estudo do proprietário e não chamam IA.

O script `scripts/browser-qa.mjs` verifica as telas no Edge instalado, em 1440×1000 e 390×844, com microfone sintético. Ele usa a conta local, carrega o material de exemplo, cria/retoma sessão e troca temporariamente o tema. Não registra uma tentativa fictícia como aprendizado do proprietário.

Evidências e limites de validação estão em [VALIDACAO.md](docs/VALIDACAO.md).

## Organização

- `src/client`: telas e componentes do produto.
- `src/domain`: fontes, contratos, revisão e XP.
- `src/server`: HTTP, autenticação, PostgreSQL/Drizzle, arquivos, orçamento e provedores.
- `src/worker.ts`: fila pg-boss, preparo e manutenção periódica.
- `migrations`: migrações SQL versionadas, aplicadas transacionalmente.
- `data/objects`: arquivos privados, nunca servidos como pasta pública.
- `docs`: documentação, contratos, operação e referências originais.

Guia operacional: [OPERACAO.md](docs/OPERACAO.md). API: [API.md](docs/API.md).

## Limites deliberados

Uso local e pessoal. Sem Live, avatar 3D, certificados, pagamentos, publicação, aplicativo nativo ou scraping. A interface móvel foi verificada por emulação; microfone e codecs em um celular físico ainda exigem teste no dispositivo. Conteúdo gerado por IA não é tratado como transcrição verificada e não deve gerar ditado literal sem validação.

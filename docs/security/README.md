# Segurança e privacidade

O FluentQuest guarda material sensível de uma pessoa só: gravações da própria voz, textos que ela escreve tentando se expressar, e o histórico do que ainda não sabe dizer. O modelo de ameaça aqui é menos "invasor remoto" e mais "vazamento acidental" — por isso as defesas abaixo priorizam confinamento.

## Superfície de ataque real

| Vetor | Defesa vigente | Onde |
|---|---|---|
| Acesso remoto à aplicação | Escuta apenas em loopback (`--hostname 127.0.0.1`); nada publicado em rede | `package.json`, scripts `dev` e `start` |
| Sessão roubada | Cookie HttpOnly; `secure` automático quando a base é HTTPS | `src/server/auth.ts` |
| CSRF | Mutação exige `Origin` igual a `BETTER_AUTH_URL`; origem diferente recebe 403 | `src/server/auth.ts`, `src/server/api.ts` |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` |
| Acesso indevido a câmera | `Permissions-Policy: camera=(), microphone=(self)` | `next.config.ts` |
| SSRF por URL do usuário | Validação de host exato e ID em `youtubeId`; o servidor nunca faz fetch de URL arbitrária | `src/domain/content.ts` |
| Upload malicioso | Conteúdo real verificado por `file-type`/`music-metadata` e duração por `ffprobe`; nome e MIME do cliente não são confiáveis; limite de 25 MB / 30 min | `src/server/media.ts` |
| Leitura de arquivo de outro usuário | Toda consulta de domínio verifica o proprietário; `data/objects/` nunca é pasta pública | `src/server/api.ts`, `src/server/storage.ts` |
| XSS por dado externo ou resposta de IA | Renderizados como texto, nunca como HTML executável | [`../API.md`](../API.md) |
| Cadastro indevido | Cadastro pela interface desabilitado; `scripts/owner.ts` recusa criar um segundo proprietário | `scripts/owner.ts` |
| Abuso por repetição | `rate_limits` no banco; teto de duas reservas de IA ativas | `src/server/budget.ts` |

## Dados pessoais armazenados

- **Áudio da própria voz** em `data/objects/`, com consentimento explícito, `expires_at` padrão de 7 dias e sinalizador `preserve` para manter além disso. Expiração executada pelo worker.
- **Texto produzido pelo proprietário** em `attempts` e `tutor_messages`.
- **Identidade**: nome e e-mail em `"user"`, com hash de senha (scrypt do Better Auth) em `account`.

Exportação é completa e **sem credenciais** (cenário verificado). Exclusão de conta revoga a sessão, cancela jobs pendentes, remove os arquivos por `removeUserObjects` e preserva apenas um tombstone.

## Segredos

`.env.local`, `.env.setup` e `.env.owner` **não são versionados** — o `.gitignore` ignora `.env*` exceto `.env.example`, além de `secrets/`, `credentials/`, `*.pem`, `*.key`, `backups/` e `dumps/`. `.env.setup` contém a senha administrativa do PostgreSQL e é a credencial mais perigosa do repositório; `.env.owner` contém a senha do proprietário em texto claro, por exigência do fluxo de criação.

Para bloquear commit de segredo também fora de uma sessão de IA, rode a skill `bootstrap-install-hook` uma vez nesta máquina.

## Limitações conhecidas

- Não há criptografia em repouso: banco e arquivos ficam em claro no disco do proprietário.
- O backup é manual e também fica em claro, em `backups/`.
- Não há rotação de `BETTER_AUTH_SECRET` nem expiração ativa de sessões antigas.
- O modelo de ameaça assume máquina confiável e usuário único — nada aqui protege contra quem já tem acesso ao Windows do proprietário.

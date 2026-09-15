# Teste de Sanidade — FluentQuest

Este arquivo tem duas seções com propósitos diferentes. Não misture o conteúdo delas — um `bootstrap-audit` futuro precisa poder checar as duas separadamente.

## Constituição do projeto

Princípios inegociáveis, declarados pelo proprietário na inicialização (`bootstrap-init`, 2026-09-14). Qualquer proposta de mudança que contradiga um item aqui deve ser sinalizada explicitamente antes de prosseguir — não corrigida ou ignorada silenciosamente.

- **IA nunca simula avaliação.** Com `AI_ENABLED=false`, funções indisponíveis informam "integração não configurada". Nunca fabricar tradução, feedback de fala, avaliação fonética ou resposta de tutor. Resultado truncado ou sem medição de uso não é apresentado como avaliação concluída.
- **Sem scraping ou download do YouTube.** Apenas o player oficial em iframe e legendas fornecidas legitimamente pelo proprietário. O servidor nunca faz fetch de URL arbitrária vinda do usuário; hosts e IDs são validados por correspondência exata.
- **Orçamento é reservado antes da inferência.** A reserva precede a chamada; timeout ambíguo mantém o valor reservado; nunca repetir automaticamente uma inferência que pode já ter sido cobrada. No máximo duas reservas ativas por usuário.
- **XP não mede proficiência.** XP nunca recompensa playback e não é convertido em certificado nem em alegação de fluência. A Jornada registra prática, não competência.

_Atualize esta seção quando o proprietário declarar uma nova restrição inegociável — não adicione itens aqui por conta própria._

## Perguntas de sanidade

Perguntas específicas deste projeto que o agente deve responder corretamente, mentalmente, antes de começar a codificar uma task nova. Não é exame com nota — é uma checagem de que o contexto da sessão não perdeu uma regra arquitetural importante.

1. **Qual camada nunca pode depender de qual outra, e por quê?** `src/domain/` (`content.ts`, `review.ts`) é puro e não pode importar `src/server/`, `pg` ou nada de Next — é o que permite testá-lo sem banco em `tests/domain.test.ts` e o que impede regra de negócio duplicada entre domínio e HTTP.
2. **Que operação neste projeto exige confirmação humana antes de executar?** Qualquer mudança destrutiva de banco (`DROP`, `DELETE` sem `WHERE`, editar migração já aplicada, rodar `scripts/setup.ts` sobre um banco existente) e qualquer ativação de IA que possa gerar cobrança real.
3. **Quando uma função de IA está indisponível, o que a interface mostra?** "Integração não configurada" — nunca um resultado plausível gerado localmente, nunca uma avaliação simulada. Ver o cenário "IA desligada sem resposta simulada" em `scripts/integration.ts`.
4. **Por que o login falha ao acessar por `127.0.0.1:3215` em vez de `localhost:3215`?** Better Auth valida a origem contra `BETTER_AUTH_URL` e responde 403 antes de checar a senha (`src/server/auth.ts`). É erro de origem, não de credencial.

`bootstrap-audit` relê esta seção como parte da checagem de sanidade.

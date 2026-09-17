# Qualidade e validação

## Evidências de 2026-09-14

Execução completa da bateria descrita no `README.md` da raiz, nesta data:

| Verificação    | Comando                             | Resultado                                 |
| -------------- | ----------------------------------- | ----------------------------------------- |
| Tipos          | `npm run typecheck`                 | 0 erros                                   |
| Unitários      | `npm test`                          | 11/11                                     |
| Integração     | `npm run test:integration`          | 23/23 cenários, nenhuma chamada de IA     |
| Build          | `npm run build`                     | compilou em ~1s, 4 rotas                  |
| Acessibilidade | `node scripts/accessibility-qa.mjs` | `violations: []` em 9 rotas               |
| Navegador      | `node scripts/browser-qa.mjs`       | 0 erros, 0 overflows, 1440×1000 e 390×844 |

Resultados brutos dos dois últimos ficam em `.impeccable/review/` (não versionado).

## Forma da pirâmide

A cobertura é deliberadamente concentrada: `tests/domain.test.ts` (11 casos) cobre a lógica pura e delicada — validação de fonte e proveniência, agendamento FSRS, e aritmética de orçamento em micros. Os 11 módulos de `src/server/` **não têm teste unitário**; são cobertos por `scripts/integration.ts`, que sobe um banco temporário `fluentquest_test_*`, aplica as migrações, exercita 23 cenários de ponta a ponta e remove apenas esse banco.

É uma escolha defensável para um projeto local de usuário único, mas vale saber: uma regressão em `src/server/` só aparece na suíte de integração, que é mais lenta e exige PostgreSQL e `.env.setup`.

## O que os 23 cenários protegem

Autenticação e isolamento por proprietário; idempotência de importação concorrente; ausência de resposta simulada com IA desligada; retomada de sessão; não duplicação de cartões equivalentes; aplicação única de FSRS e XP em duas abas; conflito por versão obsoleta; desfazer com restauração de estado; liberação de referência só após a tentativa; upload validado com áudio privado e `Range`; ausência de avaliação fictícia de fala; recompensa única no desafio semanal; persistência de falha e não duplicação de preparo no worker; recuperação após interrupção; reserva atômica sob concorrência; conciliação idempotente de custo; exportação sem credenciais; exclusão com revogação de sessão, cancelamento de jobs e tombstone.

## Lacunas conhecidas

1. **Sem `npm run lint`**: Prettier está instalado como devDependency, sem script. Não há verificação automática de formatação.
2. **Mobile só emulado**: 390×844 com microfone sintético. Microfone e codecs em aparelho físico nunca foram testados — é a lacuna mais provável de esconder um defeito real.
3. **IA sem evidência de qualidade**: ver [`../ai/README.md`](../ai/README.md).
4. **Sem CI**: toda a bateria é executada manualmente.

## Definição de pronto

- `npm run typecheck` limpo.
- `npm test` para mudança em `src/domain/`; `npm run test:integration` para mudança em servidor ou worker.
- `node scripts/accessibility-qa.mjs` com `violations: []` para mudança de tela.
- Evidência registrada na task, em `.agents/tasks/`.

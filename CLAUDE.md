@AGENTS.md

# Instruções para Claude Code — FluentQuest

A fonte principal é `AGENTS.md`, na raiz (importado acima).

Leia nesta ordem:
1. `AGENTS.md`
2. `.agents/context/CONTEXT.md`
3. task ativa em `.agents/tasks/active/` (se houver)
4. o subagente especializado relevante em `.claude/agents/`

Subagentes: `.claude/agents/` (`dominio-revisao`, `fontes-proveniencia`, `dados-persistencia`, `ia-orcamento`, `interface-editorial`)
Regras globais: `.claude/rules/global.md`
Adaptador Codex equivalente: `.codex/agents/` (mesmo conteúdo, formato TOML)

Não trate este arquivo como documentação completa. Siga os links indicados e registre o estado necessário à continuidade em `.agents/tasks/` e `.agents/handoffs/`.

#!/usr/bin/env bash
# KROK 0 — usunięcie plików z dysku. Ścieżki POTWIERDZONE przez operatora 2026-09-28 (KROK0-DECYZJE.md, „Pliki do usunięcia”).
# Uruchamia OPERATOR, po krok0_komendy.sh, przy zamkniętej aplikacji Claude. Kopia: ~/claude-konto-kopie/2026-09-28-przed-krok0/
# (skills/, agents/, hooks/ — pełne katalogi; log bash-command-log.txt NIE ma kopii — decyzja operatora: usunąć).
set -euo pipefail

SCIEZKI=(
  "$HOME/.claude/skills/find-skills"
  "$HOME/.claude/skills/graphify"
  "$HOME/.claude/skills/ralph-tui-create-beads"
  "$HOME/.claude/skills/ralph-tui-create-beads-rust"
  "$HOME/.claude/skills/ralph-tui-create-json"
  "$HOME/.claude/skills/ralph-tui-prd"
  "$HOME/.claude/agents/architecture-strategist.md"
  "$HOME/.claude/agents/auto-error-resolver.md"
  "$HOME/.claude/agents/best-practices-researcher.md"
  "$HOME/.claude/agents/code-simplicity-reviewer.md"
  "$HOME/.claude/agents/e2e-browser-verifier.md"
  "$HOME/.claude/agents/framework-docs-researcher.md"
  "$HOME/.claude/agents/kieran-typescript-reviewer.md"
  "$HOME/.claude/agents/learnings-researcher.md"
  "$HOME/.claude/agents/performance-oracle.md"
  "$HOME/.claude/agents/repo-research-analyst.md"
  "$HOME/.claude/agents/security-sentinel.md"
  "$HOME/.claude/agents/spec-flow-analyzer.md"
  "$HOME/.claude/agents/web-research-specialist.md"
  "$HOME/.claude/hooks/error-handling-reminder.sh"
  "$HOME/.claude/hooks/skill-activation-prompt.sh"
  "$HOME/.claude/hooks/stop-build-check-enhanced.sh"
  "$HOME/.claude/bash-command-log.txt"
)

for s in "${SCIEZKI[@]}"; do
  if [ -e "$s" ]; then rm -rf -- "$s" && echo "usunięto  ${s/#$HOME/~}"; else echo "brak      ${s/#$HOME/~}"; fi
done
echo "Gotowe: ${#SCIEZKI[@]} ścieżek. ~/.claude/hooks/hook_handler.py zostaje (hook Stop)."

#!/usr/bin/env bash
# KROK 0 — zmiany na koncie Claude Code wg decyzji operatora (KROK0-DECYZJE.md, 2026-09-28).
# Uruchamia OPERATOR w Terminal.app, przy ZAMKNIĘTEJ aplikacji Claude i zamkniętych sesjach `claude`
# (sesje piszą ~/.claude.json i ~/.claude/settings.json — równoległy zapis mógłby cofnąć zmiany).
# Kopia sprzed zmian: ~/claude-konto-kopie/2026-09-28-przed-krok0/. Skrypt NICZEGO nie kasuje z dysku
# (skille / agenci / pliki hooków do usunięcia — osobno, po potwierdzeniu ścieżek: krok0_usun.sh).
set -euo pipefail

W="$HOME/Documents/kacper_trzepiecinski_workspace"
SKRYPTY="$(cd "$(dirname "$0")" && pwd)"
krok() { printf '\n=== %s\n' "$*"; }
# Wypisuje tylko 4 pierwsze słowa komendy: przy `claude mcp add-json <nazwa> <json>` pełny wydruk pokazał klucz API (wykonanie 2026-09-29).
w_projekcie() { local kat="$1"; shift; printf '  [%s] %s …\n' "${kat/#$HOME/~}" "${*:1:4}"; (cd "$kat" && "$@"); }
mcp_json() { python3 -c 'import json,os,sys; print(json.dumps(json.load(open(os.path.expanduser("~/.claude.json")))["mcpServers"][sys.argv[1]]))' "$1"; }

krok "1. Pluginy TYLKO W PROJEKCIE kacper_trzepiecinski_workspace: najpierw włączam tam (--scope local), potem wyłączam globalnie"
for p in aibiz@aibiz figma@claude-plugins-official posthog@claude-plugins-official skill-creator@claude-plugins-official; do
  w_projekcie "$W" claude plugin install "$p" --scope local
  claude plugin disable "$p" --scope user
done

krok "1. dev-browser: wyłączam globalnie; zostaje w 24 projektach, które mają go włączonego u siebie"
claude plugin disable dev-browser@dev-browser-marketplace --scope user

krok "1. Pluginy USUŃ: odinstalowanie z poziomu user"
for p in ccc-skills@ccc discord@claude-plugins-official hookify@claude-plugins-official hostinger@claude-plugins-official \
         security-guidance@claude-plugins-official sentry@claude-plugins-official supabase@claude-plugins-official telegram@claude-plugins-official; do
  claude plugin uninstall "$p" --scope user
done

krok "1. ccc-skills USUŃ: także trzy instalacje --scope local w projektach"
for kat in "$W" "$W/Zadania/projekty/live/2026-09-17-claude-code-od-zera/materialy" "$W/Zadania/projekty/mapowanie-tworcow"; do
  w_projekcie "$kat" claude plugin uninstall ccc-skills@ccc --scope local
done

krok "3. MCP TYLKO W PROJEKCIE kacper_trzepiecinski_workspace: kopiuję konfigurację do --scope local (wartości nie są wypisywane), potem usuwam z user"
for s in airtable Fakturownia; do
  w_projekcie "$W" claude mcp add-json "$s" "$(mcp_json "$s")" --scope local
  claude mcp remove "$s" --scope user
done

krok "3. mobbin: workspace ma już identyczny wpis --scope local — usuwam tylko z user"
claude mcp remove mobbin --scope user

krok "3. MCP USUŃ"
claude mcp remove context7 --scope user
claude mcp remove playwright --scope user

krok "4. Skille TYLKO W PROJEKCIE kacper_trzepiecinski_workspace: przenoszę katalogi (bez kasowania)"
for s in puls remotion-best-practices skool; do
  if [ -e "$W/.claude/skills/$s" ]; then echo "  POMIJAM $s — w workspace już istnieje .claude/skills/$s"; continue; fi
  mv "$HOME/.claude/skills/$s" "$W/.claude/skills/$s" && echo "  przeniesiono $s"
done

krok "2/4/6/7 + env: ~/.claude/settings.json (hooki, CALLME_*, pluginy/skille/konektory claude.ai, cleanupPeriodDays)"
python3 "$SKRYPTY/krok0_ustawienia.py" --wykonaj

krok "Gotowe. Ręcznie zostaje: rozszerzenie airtable-mcp-server w aplikacji Claude (Ustawienia → Rozszerzenia → usuń) i krok0_usun.sh po potwierdzeniu ścieżek."

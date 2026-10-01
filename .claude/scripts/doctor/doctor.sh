#!/usr/bin/env bash
#
# doctor.sh — sprawdza, czy maszyna ma wszystko, czego projekt wymaga od pipeline'u dev-* (PLAN-POPRAWY P2).
# Lista jest wyliczana z projektu: narzędzia warunkowe (np. supabase CLI) wchodzą tylko, gdy projekt ich używa.
# Po co: brak narzędzia ma wyjść przed startem, nie w środku runu autopilota.
#
# Użycie:
#   doctor.sh [katalog-projektu]    domyślnie: $CLAUDE_PROJECT_DIR / git toplevel / pwd
#
# Wynik: tabela Markdown (Element | Stan | Wersja / szczegół | Instalacja) i linia WYNIK.
#   OK         jest
#   BRAK       brak obowiązkowego — run pipeline'u by się na tym zatrzymał
#   UWAGA      brak zalecanego — nie blokuje runu
#   nie dotyczy  projekt tego nie używa
# Kod wyjścia: 0 = wszystkie obowiązkowe są, 1 = brak co najmniej jednego obowiązkowego, 2 = zły argument.
# Skrypt nie używa jq: plik JSON czyta node, a sam brak node zgłasza jako BRAK.

set -uo pipefail

if [[ "$#" -gt 1 ]]; then
  echo "Użycie: $0 [katalog-projektu]" >&2
  exit 2
fi
if [[ -n "${1:-}" ]]; then
  PROJEKT="$1"
elif [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  PROJEKT="$CLAUDE_PROJECT_DIR"
elif PROJEKT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  PROJEKT="$(pwd)"
fi
[[ -d "$PROJEKT" ]] || { echo "BŁĄD: $PROJEKT nie jest katalogiem." >&2; exit 2; }

KATALOG_DOCTORA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAKI=""
UWAGI=0

# wiersz <element> <stan> <szczegół> <instalacja>
wiersz() {
  printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"
  case "$2" in
    BRAK) BRAKI="${BRAKI:+$BRAKI, }$1" ;;
    UWAGA) UWAGI=$((UWAGI + 1)) ;;
  esac
}

# Pierwsza niepusta linia wersji narzędzia.
wersja() {
  "$@" 2>/dev/null | grep -m1 . || echo "?"
}

# coolify CLI wypisuje przed wersją komunikat „A new version … is available” na stdout.
wersja_coolify() {
  coolify version 2>/dev/null | grep -v -m1 -i -e 'new version' -e '^$' || echo "?"
}

# narzedzie <nazwa> <stan-gdy-brak: BRAK|UWAGA> <instalacja> [komenda wersji…]
narzedzie() {
  local nazwa="$1" stan_braku="$2" instalacja="$3"
  shift 3
  [[ "$#" -gt 0 ]] || set -- "$nazwa" --version
  if command -v "$nazwa" >/dev/null 2>&1; then
    wiersz "$nazwa" OK "$(wersja "$@")" "—"
  else
    wiersz "$nazwa" "$stan_braku" "brak w PATH" "$instalacja"
  fi
}

sprawdz_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    wiersz gh BRAK "brak w PATH" "brew install gh && gh auth login"
  elif gh auth status >/dev/null 2>&1; then
    wiersz gh OK "$(wersja gh --version) — zalogowany" "—"
  else
    wiersz gh BRAK "$(wersja gh --version) — niezalogowany" "gh auth login"
  fi
}

nie_dotyczy() {
  wiersz "$1" "nie dotyczy" "$2" "—"
}

# Menedżer pakietów z lockfile (pierwsze trafienie): bez niego `pnpm install`/`pnpm test` w runie padają.
sprawdz_menedzera() {
  local lockfile menedzer instalacja
  for lockfile in pnpm-lock.yaml yarn.lock bun.lock bun.lockb package-lock.json; do
    [[ -f "$PROJEKT/$lockfile" ]] && break
    lockfile=""
  done
  case "$lockfile" in
    pnpm-lock.yaml) menedzer=pnpm; instalacja="npm install -g pnpm" ;;
    yarn.lock) menedzer=yarn; instalacja="npm install -g yarn" ;;
    bun.lock|bun.lockb) menedzer=bun; instalacja="npm install -g bun" ;;
    package-lock.json) menedzer=npm; instalacja="brew install node" ;;
    *) nie_dotyczy "menedżer pakietów" "brak lockfile"; return ;;
  esac
  if command -v "$menedzer" >/dev/null 2>&1; then
    wiersz "$menedzer" OK "$(wersja "$menedzer" --version)" "—"
  else
    wiersz "$menedzer" BRAK "brak w PATH (lockfile: $lockfile)" "$instalacja"
  fi
}

# agent-browser musi być w PATH: skill agent-browser i feature-tester-e2e wołają gołe `agent-browser`,
# więc sama devDependency projektu (node_modules/.bin) w runie go nie znajdzie.
sprawdz_agent_browser() {
  local lokalny="$PROJEKT/node_modules/.bin/agent-browser" instalacja="npm install -g agent-browser && agent-browser install"
  if command -v agent-browser >/dev/null 2>&1; then
    wiersz agent-browser OK "$(wersja agent-browser --version)" "—"
  elif [[ -x "$lokalny" ]]; then
    wiersz agent-browser BRAK "$(wersja "$lokalny" --version) tylko w node_modules/.bin — pipeline woła agent-browser z PATH" "$instalacja"
  else
    wiersz agent-browser BRAK "brak w PATH" "$instalacja"
  fi
}

ma_hook_z_jq() {
  grep -qw jq "$PROJEKT"/.claude/hooks/*.sh 2>/dev/null
}

ma_scenariusze_e2e() {
  [[ -d "$PROJEKT/docs" ]] && grep -rqE --include='*.md' '^[[:space:]]*- \[[ xX]\] .*\[E2E\]' "$PROJEKT/docs"
}

ma_coolify() {
  grep -qi coolify "$PROJEKT/CLAUDE.md" "$PROJEKT/.env.example" "$PROJEKT"/.github/workflows/* 2>/dev/null
}

ma_dockerfile() {
  [[ -n "$(find "$PROJEKT" -maxdepth 3 -name node_modules -prune -o -name Dockerfile -print 2>/dev/null | head -1)" ]]
}

# Pluginy projektu i Dynamic Workflows — z plików JSON, przez node (wiersze TSV z ustawienia.mjs).
sprawdz_ustawienia() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "ustawienia Claude Code" UWAGA "nie sprawdzono pluginów i Dynamic Workflows (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/ustawienia.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "ustawienia Claude Code" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "popraw JSON w plikach settings"
    return
  fi
  while IFS=$'\t' read -r element stan szczegol instalacja; do
    wiersz "$element" "$stan" "$szczegol" "$instalacja"
  done <<< "$wynik"
}

# Świeżość telemetrii (decyzja O5 It. 1): hook Stop dopisuje rekordy po każdej sesji; brak zapisu z ostatniej doby
# = hook mógł nie działać, więc doctor nadrabia pełnym skanem. Nie blokuje — błąd skanu to UWAGA.
sprawdz_telemetrie() {
  local dane="$HOME/.claude/telemetry/pipeline.jsonl" zbierz="$KATALOG_DOCTORA/../telemetria/zbierz.mjs" wynik
  if [[ -n "$(find "$dane" -mmin -1440 2>/dev/null)" ]]; then
    wiersz telemetria OK "ostatni zapis < 24 h" "—"
  elif ! command -v node >/dev/null 2>&1; then
    wiersz telemetria UWAGA "brak zapisu z ostatniej doby, skan niemożliwy (brak node)" "brew install node"
  elif wynik="$(node "$zbierz" --skan 2>&1)"; then
    wiersz telemetria OK "brak zapisu z ostatniej doby — skan: ${wynik%% →*}" "—"
  else
    wiersz telemetria UWAGA "skan z błędami: $(printf '%s\n' "$wynik" | grep -m1 .)" "log: ~/.claude/telemetry/zbierz-bledy.log"
  fi
}

echo "DOCTOR: $PROJEKT"
echo
echo "| Element | Stan | Wersja / szczegół | Instalacja |"
echo "|---|---|---|---|"
narzedzie git BRAK "brew install git"
sprawdz_gh
narzedzie node BRAK "brew install node"
sprawdz_menedzera
if ma_hook_z_jq; then narzedzie jq BRAK "brew install jq"; else nie_dotyczy jq "hooki projektu go nie wołają"; fi
if [[ -d "$PROJEKT/supabase" ]]; then
  narzedzie supabase BRAK "brew install supabase/tap/supabase"
else
  nie_dotyczy supabase "brak katalogu supabase/"
fi
if ma_scenariusze_e2e; then sprawdz_agent_browser; else nie_dotyczy agent-browser "brak checkboxów [E2E] w docs/"; fi
if ma_coolify; then
  narzedzie coolify UWAGA "bash .claude/skills/coolify-manager/scripts/install_coolify_cli.sh" wersja_coolify
else
  nie_dotyczy coolify "brak konfiguracji Coolify (CLAUDE.md, .env.example, .github/workflows/)"
fi
if ma_dockerfile; then narzedzie docker UWAGA "brew install --cask docker"; else nie_dotyczy docker "brak Dockerfile"; fi
sprawdz_ustawienia
sprawdz_telemetrie
echo

if [[ -n "$BRAKI" ]]; then
  echo "WYNIK: BRAK obowiązkowych: $BRAKI — zainstaluj (kolumna Instalacja) i uruchom doctor ponownie."
  exit 1
fi
echo "WYNIK: OK — wszystkie obowiązkowe są (uwagi: $UWAGI)."

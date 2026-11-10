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

# Narzędzie jazdy testera E2E z adaptera stacku (e2e/adapter.mjs) musi być w PATH — wiersz liczy narzedzie-jazdy.mjs.
# Argumenty: katalog projektu albo `--nie-dotyczy <powód>`.
sprawdz_narzedzie_jazdy() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "narzędzie jazdy E2E" UWAGA "nie sprawdzono (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/narzedzie-jazdy.mjs" "$@" 2>&1)"; then
    wiersz "narzędzie jazdy E2E" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź .claude/scripts/e2e/adapter.mjs"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
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

# Zależności bramek domknięcia (P6) — z plików JSON, przez node (wiersz TSV z zaleznosci-bramek.mjs).
sprawdz_bramki() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "bramki domknięcia" UWAGA "nie sprawdzono devDependencies bramek (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/zaleznosci-bramek.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "bramki domknięcia" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "popraw JSON w package.json"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Runner testów projektu (P22 A1): vitest/jest nie może zbierać testów maszynerii z .claude/** — bez configu z wykluczeniem
# `npm test` autopilota pada na 113 plikach node:test (live-10-demo). Wiersz TSV z runner-testow.mjs; problem = BRAK.
sprawdz_runner() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "runner testów" UWAGA "nie sprawdzono configu vitest/jest (brak node)" "brew install node"
    return
  fi
  # Ostrzeżenia node na stderr nie mogą rozbić wiersza TSV — wiersz to linia zaczynająca się od nazwy elementu.
  if ! wynik="$(node "$KATALOG_DOCTORA/runner-testow.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "runner testów" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź package.json i config vitest/jest"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$(printf '%s\n' "$wynik" | grep -m1 "^runner testów"$'\t')"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Zapis hooków (P22 A2): hook piszący w drzewie projektu zostawia nieśledzone pliki, a bramka gotowości i autopilot
# zatrzymują się na brudnym drzewie. Wiersz TSV z zapis-hookow.mjs; problem = UWAGA z naprawą.
sprawdz_zapis_hookow() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "zapis hooków" UWAGA "nie sprawdzono plików .claude/hooks/ (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/zapis-hookow.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "zapis hooków" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź pliki .claude/hooks/"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Higiena projektu (02.11): stara baza wiedzy, kontekst startowy agenta, pozostałości starego zestawu w .claude/, hooki
# wskazujące usunięte pliki, pliki maszynerii poza .gitignore, bajty sterujące w wiedzy, CodeRabbit. /sync-template przenosi
# tylko maszynerię .claude/, więc te rzeczy przechodziły niezauważone. Wiersze TSV z higiena.mjs; problem = UWAGA z naprawą.
sprawdz_higiene() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "higiena projektu" UWAGA "nie sprawdzono (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/higiena.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "higiena projektu" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "node .claude/scripts/doctor/higiena.mjs ."
    return
  fi
  while IFS=$'\t' read -r element stan szczegol instalacja; do
    [[ -n "$element" ]] && wiersz "$element" "$stan" "$szczegol" "$instalacja"
  done <<< "$wynik"
}

# Advisors Supabase (P17) — lint bazy e2e po migracjach fazy: ref z .env.e2e i token Management API, przez node
# (wiersz TSV z advisors.mjs). Brak to UWAGA: run idzie dalej, security sprawdza migracje ręcznie.
sprawdz_advisors() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "advisors (baza e2e)" UWAGA "nie sprawdzono tokenu Supabase (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/advisors.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "advisors (baza e2e)" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź .env.e2e"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Port serwera E2E (P19): 5173 = port zwykłego dev servera Vite, uruchomiony obok zatrzymuje start E2E — UWAGA z naprawą.
sprawdz_port_e2e() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "port E2E" UWAGA "nie sprawdzono portu z .env.e2e (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/port-e2e.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "port E2E" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź .env.e2e"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Uwaga stacku z adaptera E2E (e2e/adapter.mjs): wiersz tylko wtedy, gdy stack ma co zgłosić.
sprawdz_uwage_stacku() {
  local wynik element stan szczegol instalacja
  command -v node >/dev/null 2>&1 || return 0
  if ! wynik="$(node "$KATALOG_DOCTORA/uwaga-stacku.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "uwaga stacku" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź .claude/scripts/e2e/adapter.mjs"
    return
  fi
  [[ -n "$wynik" ]] || return 0
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
}

# Dopasowanie warstwy stacku do projektu (znaleziska 2026-11-02 pkt 26): projekt bez Supabase albo z sygnałem drugiego
# wariantu szablonu dostaje wiersz na element z tym, czego nie stosować. Wiersze TSV z dopasowanie-stacku.mjs, żaden nie blokuje.
sprawdz_dopasowanie_stacku() {
  local wynik element stan szczegol instalacja
  command -v node >/dev/null 2>&1 || return 0
  if ! wynik="$(node "$KATALOG_DOCTORA/dopasowanie-stacku.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "stack: dopasowanie" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź .claude/stack/profil.json i package.json"
    return
  fi
  while IFS=$'\t' read -r element stan szczegol instalacja; do
    [[ -n "$element" ]] && wiersz "$element" "$stan" "$szczegol" "$instalacja"
  done <<< "$wynik"
}

# Warstwa stała plików ról (P11) — liczba poleceń i zasady pisania, przez node (wiersz TSV z warstwa-rol.mjs).
# Naruszenie to UWAGA: rola działa, tylko jej plik odjechał od szablonu.
sprawdz_warstwe() {
  local wynik element stan szczegol instalacja
  if ! command -v node >/dev/null 2>&1; then
    wiersz "warstwa stała ról" UWAGA "nie policzono poleceń plików ról (brak node)" "brew install node"
    return
  fi
  if ! wynik="$(node "$KATALOG_DOCTORA/warstwa-rol.mjs" "$PROJEKT" 2>&1)"; then
    wiersz "warstwa stała ról" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź pliki .claude/agents/"
    return
  fi
  IFS=$'\t' read -r element stan szczegol instalacja <<< "$wynik"
  wiersz "$element" "$stan" "$szczegol" "$instalacja"
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

# Klucze w transkryptach (znaleziska 2026-11-02 pkt 32): wynik testu wypisał klucz z .env do transkryptu agenta. Skan robi
# telemetria z hooka Stop, a hook jest niemy, więc trafienie pokazuje dopiero ten wiersz: UWAGA z komendą potwierdzenia
# po rotacji klucza. Wiersze TSV z telemetria/klucze.mjs (bez wartości klucza), żaden nie blokuje.
sprawdz_klucze() {
  local wynik element stan szczegol instalacja
  command -v node >/dev/null 2>&1 || return 0
  if ! wynik="$(node "$KATALOG_DOCTORA/../telemetria/klucze.mjs" --doctor "$PROJEKT" 2>&1)"; then
    wiersz "klucz w transkryptach" UWAGA "nie odczytano: $(printf '%s\n' "$wynik" | grep -m1 -i error)" "sprawdź ~/.claude/telemetry/klucze-transkryptow.jsonl"
    return
  fi
  while IFS=$'\t' read -r element stan szczegol instalacja; do
    [[ -n "$element" ]] && wiersz "$element" "$stan" "$szczegol" "$instalacja"
  done <<< "$wynik"
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
if ma_scenariusze_e2e; then sprawdz_narzedzie_jazdy "$PROJEKT"; else sprawdz_narzedzie_jazdy --nie-dotyczy "brak checkboxów [E2E] w docs/"; fi
if ma_coolify; then
  if [[ -f "$KATALOG_DOCTORA/../../skills/coolify-manager/scripts/install_coolify_cli.sh" ]]; then
    narzedzie coolify UWAGA "bash .claude/skills/coolify-manager/scripts/install_coolify_cli.sh" wersja_coolify
  else
    narzedzie coolify UWAGA "instalacja wg dokumentacji Coolify CLI" wersja_coolify
  fi
else
  nie_dotyczy coolify "brak konfiguracji Coolify (CLAUDE.md, .env.example, .github/workflows/)"
fi
if ma_dockerfile; then narzedzie docker UWAGA "brew install --cask docker"; else nie_dotyczy docker "brak Dockerfile"; fi
sprawdz_ustawienia
sprawdz_bramki
sprawdz_runner
sprawdz_zapis_hookow
sprawdz_advisors
sprawdz_port_e2e
sprawdz_uwage_stacku
sprawdz_dopasowanie_stacku
sprawdz_warstwe
sprawdz_higiene
sprawdz_telemetrie
sprawdz_klucze
echo

if [[ -n "$BRAKI" ]]; then
  echo "WYNIK: BRAK obowiązkowych: $BRAKI — usuń braki wg kolumny Instalacja (narzędzie albo wpis do configu) i uruchom doctor ponownie."
  exit 1
fi
echo "WYNIK: OK — wszystkie obowiązkowe są (uwagi: $UWAGI)."

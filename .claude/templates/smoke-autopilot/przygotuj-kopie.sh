#!/usr/bin/env bash
#
# przygotuj-kopie.sh — kopia projektu do smoke'a pipeline'u dev-autopilot-wf (PLAN-POPRAWY P0, HANDOFF §7).
# Oryginał zostaje nietknięty: kopia to lokalny klon bez remote (push niemożliwy), bez .env i supabase/.temp,
# na gałęzi test/smoke-autopilot, z maszynerią zsynchronizowaną z LOKALNEGO szablonu i z fixture smoke'a.
# Po skrypcie git kopii jest czysty (dwa commity: sync szablonu, fixture), a bazowe bramki (`pnpm typecheck`, `pnpm test`)
# zielone — inaczej skrypt kończy się kodem 7 i runu nie wolno odpalać (smoke P0: domknięcie execute uruchamia CAŁE
# `pnpm test` projektu, więc zastany czerwony test zatrzymuje run niezależnie od pakietu fixture).
# Przed bramkami doctor kopii (P2): brak obowiązkowego narzędzia = kod 8, runu też nie odpalać.
#
# Użycie:
#   przygotuj-kopie.sh <projekt-źródłowy> <katalog-kopii> [--env <plik>] [--dry-run]
#     --env <plik>  atrapy zmiennych (BEZ sekretów) kopiowane jako .env kopii — dla testów, które bez nich nie startują
#     --dry-run     tylko pokaż kroki, nic nie twórz
#
# Fixture: w projekcie pnpm workspace (pnpm-workspace.yaml) kod zadania trafia do osobnego pakietu
# packages/smoke-autopilot — objętego `pnpm -r run test/typecheck` kopii i odciętego od zastanych błędów projektu.
# Bez workspace: src/lib (jak przed P0).
# Bramki (P6): pakiet dostaje konfiguracje z .claude/templates/bramki i devDependencies bramek (wstaw-pakiet.mjs),
# a fixture zadania — defekt mechaniczny: pusty catch i edycje pierwszej migracji projektu ({{MIGRACJA}}; projekt
# bez migracji — linie z defektem migracji usuniete).

set -euo pipefail

SZABLON_SMOKE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SZABLON="$(cd "$SZABLON_SMOKE/../../.." && pwd)"
GALAZ="test/smoke-autopilot"
PAKIET="packages/smoke-autopilot"

DRY_RUN=0
PLIK_ENV=""
declare -a POZYCYJNE=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --env) [[ -n "${2:-}" ]] || { echo "BŁĄD: --env wymaga ścieżki pliku." >&2; exit 2; }; PLIK_ENV="$2"; shift ;;
    -*) echo "Nieznana opcja: $1" >&2; exit 2 ;;
    *) POZYCYJNE+=("$1") ;;
  esac
  shift
done
[[ "${#POZYCYJNE[@]}" -eq 2 ]] || { echo "Użycie: $0 <projekt-źródłowy> <katalog-kopii> [--env <plik>] [--dry-run]" >&2; exit 2; }
[[ -z "$PLIK_ENV" || -f "$PLIK_ENV" ]] || { echo "BŁĄD: plik atrap zmiennych $PLIK_ENV nie istnieje." >&2; exit 2; }
ZRODLO="$(cd "${POZYCYJNE[0]}" && pwd)"
KOPIA="${POZYCYJNE[1]}"

git -C "$ZRODLO" rev-parse --git-dir >/dev/null 2>&1 || { echo "BŁĄD: $ZRODLO nie jest repozytorium git." >&2; exit 3; }
[[ ! -e "$KOPIA" ]] || { echo "BŁĄD: $KOPIA już istnieje — skrypt nie nadpisuje katalogów." >&2; exit 4; }
[[ -n "$(git -C "$SZABLON" status --porcelain -- .claude)" ]] && \
  echo "UWAGA: .claude/ szablonu ma niezacommitowane zmiany — sync bierze pliki śledzone przez gita." >&2

if [[ -f "$ZRODLO/pnpm-workspace.yaml" ]]; then KATALOG_KODU="$PAKIET/src"; else KATALOG_KODU="src/lib"; fi
# Pierwsza migracja śledzona w gicie źródła = ta sama w klonie.
MIGRACJA="$(git -C "$ZRODLO" ls-files 'supabase/migrations/*.sql' | sort | head -1)"

# Każdy krok przez `krok`: w --dry-run tylko wypisany, inaczej wypisany i wykonany.
krok() {
  echo "+ $*"
  [[ "$DRY_RUN" -eq 1 ]] || "$@"
}

# Fixture zadania: docs/active/smoke-autopilot + docs/plans, katalog kodu w miejsce {{KATALOG_KODU}}, migracja defektu
# w miejsce {{MIGRACJA}} (bez migracji — linie z {{MIGRACJA}} znikają).
podstaw() {
  if [[ -n "$MIGRACJA" ]]; then
    sed -e "s#{{KATALOG_KODU}}#$KATALOG_KODU#g" -e "s#{{MIGRACJA}}#$MIGRACJA#g" "$1"
  else
    sed -e "s#{{KATALOG_KODU}}#$KATALOG_KODU#g" -e '/{{MIGRACJA}}/d' "$1"
  fi
}

wstaw_fixture_zadania() {
  mkdir -p "$KOPIA/docs/active/smoke-autopilot" "$KOPIA/docs/plans"
  for plik in smoke-autopilot-plan.md smoke-autopilot-zadania.md smoke-autopilot-kontekst.md; do
    podstaw "$SZABLON_SMOKE/$plik" > "$KOPIA/docs/active/smoke-autopilot/$plik"
  done
  podstaw "$SZABLON_SMOKE/plan-techniczny-smoke-autopilot.md" > "$KOPIA/docs/plans/plan-techniczny-smoke-autopilot.md"
}

echo "Źródło: $ZRODLO"
echo "Kopia:  $KOPIA"
echo "Kod zadania: $KATALOG_KODU"
echo "Migracja defektu: ${MIGRACJA:-brak (projekt bez supabase/migrations — defekt migracji pominięty)}"
krok git clone --quiet "$ZRODLO" "$KOPIA"
krok git -C "$KOPIA" remote remove origin
krok git -C "$KOPIA" switch --quiet -c "$GALAZ"
krok rm -rf "$KOPIA/.env" "$KOPIA/supabase/.temp"
[[ -z "$PLIK_ENV" ]] || krok cp "$PLIK_ENV" "$KOPIA/.env"
echo "+ echo '.claude/.backups/' >> $KOPIA/.git/info/exclude"
[[ "$DRY_RUN" -eq 1 ]] || echo '.claude/.backups/' >> "$KOPIA/.git/info/exclude"

krok env TEMPLATE_LOCAL_SRC="$SZABLON" PROJECT_DIR="$KOPIA" bash "$SZABLON/.claude/skills/sync-template/scripts/sync-template.sh" --force
krok git -C "$KOPIA" add -A
krok git -C "$KOPIA" commit --quiet -m "chore(smoke): sync szablonu z $SZABLON"

echo "+ fixture zadania → docs/active/smoke-autopilot, docs/plans"
[[ "$DRY_RUN" -eq 1 ]] || wstaw_fixture_zadania
if [[ "$KATALOG_KODU" == "$PAKIET/src" ]]; then
  krok node "$SZABLON_SMOKE/wstaw-pakiet.mjs" "$KOPIA/$PAKIET"
fi
krok pnpm install --dir "$KOPIA" --silent
krok git -C "$KOPIA" add -A
krok git -C "$KOPIA" commit --quiet -m "test(smoke): fixture smoke-autopilot"

# Doctor kopii (PLAN-POPRAWY P2): brak narzędzia, którego wymaga projekt (supabase CLI, agent-browser, gh…), wychodzi
# teraz — w runie zatrzymałby fazę w połowie. Kod 8 = brak obowiązkowego, runu nie odpalać.
if ! krok bash "$KOPIA/.claude/scripts/doctor/doctor.sh" "$KOPIA"; then
  echo "BRAK NARZĘDZIA: doctor kopii zgłosił brak obowiązkowego (wiersze BRAK wyżej) — run zatrzymałby się w środku." >&2
  echo "Zainstaluj (kolumna Instalacja) i sprawdź ponownie: bash $KOPIA/.claude/scripts/doctor/doctor.sh $KOPIA" >&2
  exit 8
fi

# Log bramek w .git/ — nie brudzi drzewa kopii.
LOG_BRAMEK="$KOPIA/.git/smoke-bramki.log"
echo "+ bazowe bramki kopii: pnpm typecheck, pnpm test (log: $LOG_BRAMEK)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: nic nie utworzono."
  exit 0
fi
if ! (cd "$KOPIA" && pnpm typecheck && pnpm test) > "$LOG_BRAMEK" 2>&1; then
  echo "BAZA CZERWONA: bramki kopii padają PRZED runem — run zatrzymałby się w domknięciu execute." >&2
  grep -E "FAIL |error TS|Tests .*failed|ERR_PNPM" "$LOG_BRAMEK" | head -20 >&2 || true
  echo "Napraw zastane błędy w kopii osobnym commitem (oryginał nietknięty) i sprawdź ponownie: (cd $KOPIA && pnpm typecheck && pnpm test)" >&2
  exit 7
fi
echo "GOTOWE. Git kopii: $(git -C "$KOPIA" status --porcelain | wc -l | tr -d ' ') zmian (oczekiwane 0), gałąź $GALAZ, bramki zielone."
echo "Otwórz $KOPIA w osobnej sesji desktop (efort medium) i uruchom: /dev-autopilot-wf docs/active/smoke-autopilot"

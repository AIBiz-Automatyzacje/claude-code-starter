#!/usr/bin/env bash
#
# przygotuj-kopie.sh — kopia projektu Expo do smoke'a pipeline'u dev-autopilot-wf.
# Oryginał zostaje nietknięty: kopia to lokalny klon bez remote (push niemożliwy), bez .env i supabase/.temp,
# na gałęzi feature/smoke-autopilot (= linia Branch: planu zadania z generatora), z maszynerią zsynchronizowaną z LOKALNEGO szablonu i z fixture smoke'a.
# Po skrypcie git kopii jest czysty (dwa commity: sync szablonu, fixture), a bazowe bramki (typecheck, testy) zielone.
# Inaczej skrypt kończy się kodem 7 i runu nie wolno odpalać: domknięcie execute uruchamia wszystkie testy projektu,
# więc zastany czerwony test zatrzymuje run niezależnie od fixture'u. Przed bramkami doctor kopii: brak narzędzia = kod 8.
#
# Użycie:
#   przygotuj-kopie.sh <projekt-źródłowy> <katalog-kopii> [--env <plik>] [--dry-run]
#     --env <plik>  atrapy zmiennych (BEZ sekretów) kopiowane jako .env kopii, dla testów, które bez nich nie startują
#     --dry-run     tylko pokaż kroki, nic nie twórz
#
# Fixture: kod zadania w src/lib (projekt bez src/: lib), linie smoke'a na ekranie głównym, defekt w pierwszej migracji projektu
# (projekt bez migracji: linie z defektem migracji usunięte). Dev-client nie jest częścią kopii: leży na urządzeniu pod tym samym bundle ID.

set -euo pipefail

SZABLON_SMOKE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SZABLON="$(cd "$SZABLON_SMOKE/../../.." && pwd)"
GALAZ="feature/smoke-autopilot"

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
[[ -n "$(git -C "$SZABLON" status --porcelain -- .claude 2>/dev/null)" ]] && \
  echo "UWAGA: .claude/ szablonu ma niezacommitowane zmiany — sync bierze pliki śledzone przez gita." >&2

# Ekran główny: najpłytszy plik index trasy śledzony w gicie, także w grupie tras (app/(tabs)/index.tsx).
EKRAN_GLOWNY="$(git -C "$ZRODLO" ls-files | grep -E '^(src/)?app/(.*/)?index\.(tsx|jsx)$' | awk -F/ '{ print NF "\t" $0 }' | sort -n | head -1 | cut -f2 || true)"
[[ -n "$EKRAN_GLOWNY" ]] || { echo "BŁĄD: brak ekranu głównego (index.tsx w src/app albo app, śledzony w gicie)." >&2; exit 5; }

# Tabela plików planu wymaga liczby linii; fixture dopisuje na ekranie najwyżej 3.
LINIE_EKRANU="$(git -C "$ZRODLO" show "HEAD:$EKRAN_GLOWNY" | wc -l | tr -d ' ')"
LINIE_EKRANU="$LINIE_EKRANU → $((LINIE_EKRANU + 3))"

if [[ -n "$(git -C "$ZRODLO" ls-files 'src/*')" ]]; then KATALOG_KODU="src/lib"; else KATALOG_KODU="lib"; fi
# Pierwsza migracja śledzona w gicie źródła = ta sama w klonie.
MIGRACJA="$(git -C "$ZRODLO" ls-files 'supabase/migrations/*.sql' | sort | head -1)"

# Menedżer z lockfile projektu; jego odpowiednik `npx` uruchamia Expo CLI projektu.
if [[ -f "$ZRODLO/pnpm-lock.yaml" ]]; then PM="pnpm"; PM_EXEC="pnpm exec"
elif [[ -f "$ZRODLO/yarn.lock" ]]; then PM="yarn"; PM_EXEC="yarn"
elif [[ -f "$ZRODLO/bun.lock" || -f "$ZRODLO/bun.lockb" ]]; then PM="bun"; PM_EXEC="bunx"
else PM="npm"; PM_EXEC="npx"; fi

# Każdy krok przez `krok`: w --dry-run tylko wypisany, inaczej wypisany i wykonany.
krok() {
  echo "+ $*"
  [[ "$DRY_RUN" -eq 1 ]] || "$@"
}

# Nawiasy grupy tras w ścieżce są w zamienniku sed dosłowne.
podstaw() {
  local -a wspolne=(-e "s#{{KATALOG_KODU}}#$KATALOG_KODU#g" -e "s#{{EKRAN_GLOWNY}}#$EKRAN_GLOWNY#g" -e "s#{{LINIE_EKRANU}}#$LINIE_EKRANU#g")
  if [[ -n "$MIGRACJA" ]]; then
    sed "${wspolne[@]}" -e "s#{{MIGRACJA}}#$MIGRACJA#g" "$1"
  else
    sed "${wspolne[@]}" -e '/{{MIGRACJA}}/d' "$1"
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
echo "Ekran główny: $EKRAN_GLOWNY"
echo "Menedżer pakietów: $PM"
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
# Zapis przeglądu spójności planu fixture'u (walidacja 51–55, punkt 56): autopilot zatrzymuje świeże zadanie bez ważnego
# przeglądu, a fixture go nie miał — smoke stawał na starcie. Odcisk planu liczy się po podstawieniu placeholderów, więc
# zapis powstaje tutaj, nie w szablonie; faza spoza planu albo czerwony stan kończy skrypt (kod wyjścia plan.mjs).
# Fixture nie przechodzi przez recenzenta spójności, więc obie fazy zamyka zapis bez czytania (analiza vibersi
# audyt-paczki-1-2): bramka jest zielona „z zastrzeżeniem”, a autopilot pokazuje to jako uwagę, nie STOP.
krok node "$KOPIA/.claude/scripts/plan/plan.mjs" spojnosc docs/plans/plan-techniczny-smoke-autopilot.md --zapisz --fazy 1,2 --otwarte 0 --bez-czytania 1,2 --projekt "$KOPIA"
# Instalacja przed commitem: może poprawić lockfile, a git kopii ma zostać czysty.
echo "+ (cd $KOPIA && $PM install)"
[[ "$DRY_RUN" -eq 1 ]] || (cd "$KOPIA" && "$PM" install --silent)
# Bez tego typecheck na czystym checkoucie pada na plikach .css (`.claude/stack/walidacja.md`, sekcja „Runner testów i build”).
echo "+ (cd $KOPIA && $PM_EXEC expo customize tsconfig.json)"
# shellcheck disable=SC2086
[[ "$DRY_RUN" -eq 1 ]] || (cd "$KOPIA" && $PM_EXEC expo customize tsconfig.json)
krok git -C "$KOPIA" add -A
krok git -C "$KOPIA" commit --quiet -m "test(smoke): fixture smoke-autopilot"

# Doctor kopii: brak narzędzia, którego wymaga projekt (Maestro, supabase CLI, gh…), wychodzi teraz, a nie w połowie fazy.
if ! krok bash "$KOPIA/.claude/scripts/doctor/doctor.sh" "$KOPIA"; then
  echo "BRAK NARZĘDZIA: doctor kopii zgłosił brak obowiązkowego (wiersze BRAK wyżej) — run zatrzymałby się w środku." >&2
  echo "Zainstaluj (kolumna Instalacja) i sprawdź ponownie: bash $KOPIA/.claude/scripts/doctor/doctor.sh $KOPIA" >&2
  exit 8
fi

# Log bramek w .git/ — nie brudzi drzewa kopii.
LOG_BRAMEK="$KOPIA/.git/smoke-bramki.log"
echo "+ bazowe bramki kopii: $PM run typecheck, $PM test (log: $LOG_BRAMEK)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: nic nie utworzono."
  exit 0
fi
if ! (cd "$KOPIA" && "$PM" run typecheck && CI=1 "$PM" test) > "$LOG_BRAMEK" 2>&1; then
  echo "BAZA CZERWONA: bramki kopii padają PRZED runem — run zatrzymałby się w domknięciu execute." >&2
  grep -E "FAIL |error TS|Tests: .*failed|ERR_" "$LOG_BRAMEK" | head -20 >&2 || true
  echo "Napraw zastane błędy w kopii osobnym commitem (oryginał nietknięty) i sprawdź ponownie: (cd $KOPIA && $PM run typecheck && CI=1 $PM test)" >&2
  exit 7
fi
echo "GOTOWE. Git kopii: $(git -C "$KOPIA" status --porcelain | wc -l | tr -d ' ') zmian (oczekiwane 0), gałąź $GALAZ, bramki zielone."
echo "Otwórz $KOPIA w osobnej sesji desktop (efort medium) i uruchom osobną wiadomością z samym tym poleceniem: /dev-autopilot-wf docs/active/smoke-autopilot"

#!/usr/bin/env bash
#
# przygotuj-kopie.sh — kopia projektu do smoke'a pipeline'u dev-autopilot-wf (PLAN-POPRAWY P0, HANDOFF §7).
# Oryginał zostaje nietknięty: kopia to lokalny klon bez remote (push niemożliwy), bez .env i supabase/.temp,
# na gałęzi test/smoke-autopilot, z maszynerią zsynchronizowaną z LOKALNEGO szablonu i z fixture smoke'a.
# Po skrypcie git kopii jest czysty (dwa commity: sync szablonu, fixture) — autopilot może startować od razu.
#
# Użycie:
#   przygotuj-kopie.sh <projekt-źródłowy> <katalog-kopii>             # przygotuj kopię
#   przygotuj-kopie.sh <projekt-źródłowy> <katalog-kopii> --dry-run   # tylko pokaż kroki, nic nie twórz
#
# Fixture: w projekcie pnpm workspace (pnpm-workspace.yaml) kod zadania trafia do osobnego pakietu
# packages/smoke-autopilot — objętego `pnpm -r run test/typecheck` kopii i odciętego od zastanych błędów projektu.
# Bez workspace: src/lib (jak przed P0).

set -euo pipefail

SZABLON_SMOKE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SZABLON="$(cd "$SZABLON_SMOKE/../../.." && pwd)"
GALAZ="test/smoke-autopilot"
PAKIET="packages/smoke-autopilot"

DRY_RUN=0
declare -a POZYCYJNE=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "Nieznana opcja: $arg" >&2; exit 2 ;;
    *) POZYCYJNE+=("$arg") ;;
  esac
done
[[ "${#POZYCYJNE[@]}" -eq 2 ]] || { echo "Użycie: $0 <projekt-źródłowy> <katalog-kopii> [--dry-run]" >&2; exit 2; }
ZRODLO="$(cd "${POZYCYJNE[0]}" && pwd)"
KOPIA="${POZYCYJNE[1]}"

git -C "$ZRODLO" rev-parse --git-dir >/dev/null 2>&1 || { echo "BŁĄD: $ZRODLO nie jest repozytorium git." >&2; exit 3; }
[[ ! -e "$KOPIA" ]] || { echo "BŁĄD: $KOPIA już istnieje — skrypt nie nadpisuje katalogów." >&2; exit 4; }
[[ -n "$(git -C "$SZABLON" status --porcelain -- .claude)" ]] && \
  echo "UWAGA: .claude/ szablonu ma niezacommitowane zmiany — sync bierze pliki śledzone przez gita." >&2

if [[ -f "$ZRODLO/pnpm-workspace.yaml" ]]; then KATALOG_KODU="$PAKIET/src"; else KATALOG_KODU="src/lib"; fi

# Każdy krok przez `krok`: w --dry-run tylko wypisany, inaczej wypisany i wykonany.
krok() {
  echo "+ $*"
  [[ "$DRY_RUN" -eq 1 ]] || "$@"
}

# Fixture zadania: docs/active/smoke-autopilot + docs/plans, katalog kodu wstawiony w miejsce {{KATALOG_KODU}}.
wstaw_fixture_zadania() {
  mkdir -p "$KOPIA/docs/active/smoke-autopilot" "$KOPIA/docs/plans"
  for plik in smoke-autopilot-plan.md smoke-autopilot-zadania.md smoke-autopilot-kontekst.md; do
    sed "s#{{KATALOG_KODU}}#$KATALOG_KODU#g" "$SZABLON_SMOKE/$plik" > "$KOPIA/docs/active/smoke-autopilot/$plik"
  done
  sed "s#{{KATALOG_KODU}}#$KATALOG_KODU#g" "$SZABLON_SMOKE/plan-techniczny-smoke-autopilot.md" \
    > "$KOPIA/docs/plans/plan-techniczny-smoke-autopilot.md"
}

wstaw_pakiet() {
  mkdir -p "$KOPIA/$PAKIET/src"
  cp "$SZABLON_SMOKE/pakiet/package.json" "$SZABLON_SMOKE/pakiet/tsconfig.json" "$SZABLON_SMOKE/pakiet/vitest.config.ts" "$KOPIA/$PAKIET/"
}

echo "Źródło: $ZRODLO"
echo "Kopia:  $KOPIA"
echo "Kod zadania: $KATALOG_KODU"
krok git clone --quiet "$ZRODLO" "$KOPIA"
krok git -C "$KOPIA" remote remove origin
krok git -C "$KOPIA" switch --quiet -c "$GALAZ"
krok rm -rf "$KOPIA/.env" "$KOPIA/supabase/.temp"
echo "+ echo '.claude/.backups/' >> $KOPIA/.git/info/exclude"
[[ "$DRY_RUN" -eq 1 ]] || echo '.claude/.backups/' >> "$KOPIA/.git/info/exclude"

krok env TEMPLATE_LOCAL_SRC="$SZABLON" PROJECT_DIR="$KOPIA" bash "$SZABLON/.claude/skills/sync-template/scripts/sync-template.sh" --force
krok git -C "$KOPIA" add -A
krok git -C "$KOPIA" commit --quiet -m "chore(smoke): sync szablonu z $SZABLON"

echo "+ fixture zadania → docs/active/smoke-autopilot, docs/plans"
[[ "$DRY_RUN" -eq 1 ]] || wstaw_fixture_zadania
if [[ "$KATALOG_KODU" == "$PAKIET/src" ]]; then
  echo "+ pakiet fixture → $PAKIET"
  [[ "$DRY_RUN" -eq 1 ]] || wstaw_pakiet
fi
krok pnpm install --dir "$KOPIA" --silent
krok git -C "$KOPIA" add -A
krok git -C "$KOPIA" commit --quiet -m "test(smoke): fixture smoke-autopilot"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: nic nie utworzono."
else
  echo "GOTOWE. Git kopii: $(git -C "$KOPIA" status --porcelain | wc -l | tr -d ' ') zmian (oczekiwane 0), gałąź $GALAZ."
  echo "Otwórz $KOPIA w osobnej sesji desktop (efort medium) i uruchom: /dev-autopilot-wf docs/active/smoke-autopilot"
fi

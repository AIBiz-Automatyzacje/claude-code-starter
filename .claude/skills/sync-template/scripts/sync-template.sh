#!/usr/bin/env bash
#
# sync-template.sh — synchronizuje maszynerię workflow (.claude/) z repo szablonu
# claude-code-starter do bieżącego projektu. "Szablon zawsze wygrywa": pliki wspólne
# są nadpisywane wersją z szablonu, ale nadpisywane/usuwane pliki najpierw lądują
# w backupie (ścieżka odwrotu). Pliki lokalne, których szablon nigdy nie miał
# (np. własne skille projektu), pozostają nietknięte.
#
# Użycie:
#   sync-template.sh              # sprawdź + zaaplikuj zmiany (tryb domyślny)
#   sync-template.sh --dry-run    # tylko pokaż co by się zmieniło, nic nie ruszaj
#   sync-template.sh --force      # aplikuj nawet gdy SHA szablonu == ostatni sync
#
# Zmienne środowiskowe (nadpisania, głównie do testów):
#   TEMPLATE_REPO_URL   domyślnie https://github.com/AIBiz-Automatyzacje/claude-code-starter.git
#   TEMPLATE_BRANCH     domyślnie main
#   TEMPLATE_LOCAL_SRC  lokalna ścieżka do źródła zamiast klonowania (do testów)
#   PROJECT_DIR         katalog projektu docelowego (domyślnie: $CLAUDE_PROJECT_DIR / git toplevel / pwd)

set -euo pipefail

REPO_URL="${TEMPLATE_REPO_URL:-https://github.com/AIBiz-Automatyzacje/claude-code-starter.git}"
BRANCH="${TEMPLATE_BRANCH:-main}"
LOCAL_SRC="${TEMPLATE_LOCAL_SRC:-}"

MANAGED_ROOT=".claude"
# Pliki lokalne (nietrackowane w szablonie) — nigdy nie ruszamy, nawet gdyby
# przypadkiem pojawiły się w źródle.
EXCLUDE_PATHS=(".claude/settings.local.json")

DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    *) echo "Nieznany argument: $arg" >&2; exit 2 ;;
  esac
done

# --- Ustal katalog projektu docelowego ---
if [[ -n "${PROJECT_DIR:-}" ]]; then
  :
elif [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  PROJECT_DIR="$CLAUDE_PROJECT_DIR"
elif PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  PROJECT_DIR="$(pwd)"
fi

command -v git >/dev/null 2>&1 || { echo "BŁĄD: brak 'git' w PATH." >&2; exit 3; }

VERSION_FILE="$PROJECT_DIR/$MANAGED_ROOT/.template-version"
MANIFEST_FILE="$PROJECT_DIR/$MANAGED_ROOT/.template-manifest"
# Odciski plików (hash gita) z chwili syncu — telemetria porównuje z nimi skrypt, który się faktycznie wykonał
# (`run.szablon.zgodny`, .claude/scripts/telemetria/szablon.mjs). Osobny plik, żeby nie zmieniać formatu manifestu,
# na którym stoi wykrywanie usuniętych plików (REMOVE).
HASHES_FILE="$PROJECT_DIR/$MANAGED_ROOT/.template-hashes"
# Wywolywana po zapisie manifestu. Jeden proces gita dla wszystkich plików (stdin-paths), wiersz: <hash>\t<ścieżka względna>.
zapisz_hashe() {
  local hashe
  hashe="$(printf '%s\n' "${MANAGED[@]/#/$PROJECT_DIR/}" | git hash-object --stdin-paths)"
  paste <(printf '%s\n' "$hashe") <(printf '%s\n' "${MANAGED[@]}") > "$HASHES_FILE"
}

# Pierwsza instalacja (brak .template-version przed syncem): doctor projektu (PLAN-POPRAWY P2) — brak narzędzia ma
# wyjść teraz, nie w pierwszym runie. Wynik doctora nie zmienia kodu wyjścia syncu: sync się udał, braki to zadanie
# dla usera (tabela z komendami instalacji). Szablon sprzed P2 nie ma doctora — wtedy krok się nie odbywa.
doctor_pierwszej_instalacji() {
  local doctor="$PROJECT_DIR/$MANAGED_ROOT/scripts/doctor/doctor.sh" kod=0
  [[ -z "$LOCAL_SHA" && -f "$doctor" ]] || return 0
  echo "--- DOCTOR (pierwsza instalacja) ---"
  bash "$doctor" "$PROJECT_DIR" || kod=$?
  echo "DOCTOR_KOD: $kod"
}


# --- Przygotuj źródło (klon albo lokalna ścieżka) ---
TMP_CLONE=""
# `return 0` na końcu jest istotne: funkcja biegnie z trapu EXIT, więc jej kod wyjścia
# NADPISUJE kod wyjścia skryptu. Bez tego przy TEMPLATE_LOCAL_SRC (pusty TMP_CLONE)
# nieudany test `[[ -n "" ]]` zamieniał udany sync w exit 1.
cleanup() { [[ -n "$TMP_CLONE" && -d "$TMP_CLONE" ]] && rm -rf "$TMP_CLONE"; return 0; }
trap cleanup EXIT

if [[ -n "$LOCAL_SRC" ]]; then
  SRC="$LOCAL_SRC"
  [[ -d "$SRC/$MANAGED_ROOT" ]] || { echo "BŁĄD: $SRC nie zawiera $MANAGED_ROOT." >&2; exit 4; }
  UPSTREAM_SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo "local-src")"
else
  TMP_CLONE="$(mktemp -d "${TMPDIR:-/tmp}/sync-template.XXXXXX")"
  # Klonujemy do podkatalogu (git wymaga pustego celu); log błędu trzymamy obok,
  # żeby nie "zabrudzić" katalogu docelowego przed klonem.
  clone_dir="$TMP_CLONE/repo"
  clone_err="$TMP_CLONE/clone.err"
  if ! git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$clone_dir" 2>"$clone_err"; then
    echo "BŁĄD: nie udało się sklonować szablonu z $REPO_URL (branch $BRANCH)." >&2
    echo "--- git clone stderr ---" >&2
    cat "$clone_err" >&2 2>/dev/null || true
    echo "Sprawdź dostęp do repo (prywatne? wymaga logowania: 'gh auth login' lub git credentials) i połączenie sieciowe." >&2
    exit 5
  fi
  SRC="$clone_dir"
  UPSTREAM_SHA="$(git -C "$SRC" rev-parse HEAD)"
fi

LOCAL_SHA=""
[[ -f "$VERSION_FILE" ]] && LOCAL_SHA="$(tr -d ' \n' < "$VERSION_FILE" 2>/dev/null || true)"

# --- Szybkie wyjście, gdy nic się nie zmieniło ---
if [[ "$FORCE" -eq 0 && -n "$LOCAL_SHA" && "$LOCAL_SHA" == "$UPSTREAM_SHA" ]]; then
  echo "STATUS: UP_TO_DATE"
  echo "SHA: $UPSTREAM_SHA"
  echo "Szablon jest aktualny — brak zmian w workflow do zaciągnięcia."
  exit 0
fi

# --- Zbuduj listę plików zarządzanych przez szablon ($MANAGED_ROOT/**, trackowane, bez wykluczeń) ---
is_excluded() {
  local p="$1"
  for ex in "${EXCLUDE_PATHS[@]}"; do [[ "$p" == "$ex" ]] && return 0; done
  return 1
}

declare -a MANAGED=()
while IFS= read -r -d '' rel; do
  is_excluded "$rel" && continue
  MANAGED+=("$rel")
done < <(git -C "$SRC" ls-files -z "$MANAGED_ROOT")

if [[ "${#MANAGED[@]}" -eq 0 ]]; then
  echo "BŁĄD: źródło nie ma żadnych trackowanych plików w $MANAGED_ROOT (nieoczekiwane)." >&2
  exit 6
fi

# --- Klasyfikuj: ADD (nowy), UPDATE (różny), SAME (identyczny) ---
declare -a ADD=() UPDATE=() SAME=()
for rel in "${MANAGED[@]}"; do
  local_path="$PROJECT_DIR/$rel"
  src_path="$SRC/$rel"
  if [[ ! -e "$local_path" ]]; then
    ADD+=("$rel")
  elif cmp -s "$src_path" "$local_path"; then
    SAME+=("$rel")
  else
    UPDATE+=("$rel")
  fi
done

# --- REMOVE: pliki z poprzedniego manifestu, których szablon już nie ma i które
#     nadal istnieją lokalnie (usunięte upstream — nie lokalne dodatki projektu). ---
# Bash 3.2 (macOS) nie ma associative arrays — członkostwo sprawdzamy grepem po
# newline-delimited liście plików zarządzanych.
MANAGED_NL="$(printf '%s\n' "${MANAGED[@]}")"
in_managed() { printf '%s\n' "$MANAGED_NL" | grep -qxF -- "$1"; }

declare -a REMOVE=()
if [[ -f "$MANIFEST_FILE" ]]; then
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    is_excluded "$rel" && continue
    if ! in_managed "$rel" && [[ -e "$PROJECT_DIR/$rel" ]]; then
      REMOVE+=("$rel")
    fi
  done < "$MANIFEST_FILE"
fi

# --- Raport nagłówkowy ---
echo "STATUS: CHANGES"
echo "SHA_FROM: ${LOCAL_SHA:-<brak / pierwszy sync>}"
echo "SHA_TO: $UPSTREAM_SHA"
echo "COUNTS: nowe=${#ADD[@]} zmienione=${#UPDATE[@]} usuniete=${#REMOVE[@]} bez_zmian=${#SAME[@]}"

# Uwaga: pod bash 3.2 (macOS) + `set -u` rozwinięcie PUSTEJ tablicy "${arr[@]}"
# rzuca "unbound variable", dlatego wszędzie używamy idiomu "${arr[@]+"${arr[@]}"}".
print_list() { local label="$1"; shift; [[ "$#" -eq 0 ]] && return; printf '%s:\n' "$label"; printf '  %s\n' "$@"; }
print_list "NOWE" "${ADD[@]+"${ADD[@]}"}"
print_list "ZMIENIONE" "${UPDATE[@]+"${UPDATE[@]}"}"
print_list "USUNIETE" "${REMOVE[@]+"${REMOVE[@]}"}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY_RUN: nic nie zapisano."
  exit 0
fi

if [[ "${#ADD[@]}" -eq 0 && "${#UPDATE[@]}" -eq 0 && "${#REMOVE[@]}" -eq 0 ]]; then
  # Treść identyczna, różnił się tylko SHA — zaktualizuj marker i wyjdź.
  printf '%s\n' "$UPSTREAM_SHA" > "$VERSION_FILE"
  printf '%s\n' "${MANAGED[@]}" > "$MANIFEST_FILE"
  zapisz_hashe
  echo "APPLIED: brak różnic w plikach — zaktualizowano tylko marker wersji."
  doctor_pierwszej_instalacji
  exit 0
fi

# --- Bramka składni workflowów (audyt 2026-09-06, N1) ---
# Powód: commit 5775b79 wniósł do szablonu nieescapowany backtick wewnątrz template
# literala w dev-docs-execute-wf.js. Plik przestał być poprawnym ESM, więc runtime
# NIE rejestrował workflowu — a autopilot padał dopiero przy wejściu w fazę 1 na
# "no workflow with that name", po całym bootstrapie. Sync roznosił ten defekt do
# każdego projektu, a dwa z nich diagnozowały go niezależnie.
# Sprawdzamy ŹRÓDŁO przed apply: zepsuty workflow ma tu nie wejść do projektu.
# `node --check` się nie nadaje (workflowy mają `return` na górnym poziomie), więc
# parsujemy tak jak runtime: opakowane w funkcję async, bez wykonania.
if command -v node >/dev/null 2>&1; then
  WF_ZLE=""
  for rel in "${ADD[@]+"${ADD[@]}"}" "${UPDATE[@]+"${UPDATE[@]}"}"; do
    case "$rel" in
      "$MANAGED_ROOT"/workflows/*.js) ;;
      *) continue ;;
    esac
    if ! node -e '
      const fs = require("fs"), vm = require("vm");
      const src = fs.readFileSync(process.argv[1], "utf8").replace(/^export\s+const\s/m, "const ");
      new vm.Script("(async () => {\n" + src + "\n})()", { filename: process.argv[1] });
    ' "$SRC/$rel" 2>/dev/null; then
      WF_ZLE="$WF_ZLE  $rel"$'\n'
    fi
  done
  if [[ -n "$WF_ZLE" ]]; then
    echo "BŁĄD: workflow(y) w szablonie nie parsują się — NIE aplikuję zmian."
    printf '%s' "$WF_ZLE"
    echo "Runtime nie zarejestrowałby tych workflowów, a błąd wyszedłby dopiero przy ich wywołaniu."
    echo "Najczęstsza przyczyna: nieescapowany backtick albo \${...} w treści promptu wewnątrz template literala."
    echo "Napraw w repo szablonu i ponów sync. Projekt pozostaje nietknięty."
    exit 1
  fi
fi

# --- Backup nadpisywanych/usuwanych plików (ścieżka odwrotu) ---
BACKUP_DIR="$PROJECT_DIR/$MANAGED_ROOT/.backups/$(date +%Y%m%d-%H%M%S)"
backup_file() {
  local rel="$1" dest="$BACKUP_DIR/$1"
  mkdir -p "$(dirname "$dest")"
  cp -p "$PROJECT_DIR/$rel" "$dest"
}
for rel in "${UPDATE[@]+"${UPDATE[@]}"}"; do backup_file "$rel"; done
for rel in "${REMOVE[@]+"${REMOVE[@]}"}"; do backup_file "$rel"; done

# --- Aplikuj ---
copy_in() {
  local rel="$1" dest="$PROJECT_DIR/$1"
  mkdir -p "$(dirname "$dest")"
  cp -p "$SRC/$rel" "$dest"
}
for rel in "${ADD[@]+"${ADD[@]}"}";       do copy_in "$rel"; done
for rel in "${UPDATE[@]+"${UPDATE[@]}"}"; do copy_in "$rel"; done
for rel in "${REMOVE[@]+"${REMOVE[@]}"}"; do rm -f "$PROJECT_DIR/$rel"; done

# --- Sprzątnij katalogi opróżnione przez REMOVE (audyt 2026-09-06, N8) ---
# Usunięcie skilla ze szablonu kasowało jego SKILL.md, ale zostawiało pusty
# katalog .claude/skills/<nazwa>/ — widmo mylące przy `ls`. Wspinamy się od
# katalogu pliku w górę, aż do $MANAGED_ROOT; `rmdir` odmawia na niepustym
# katalogu, więc nigdy nie usunie niczego, co zawiera lokalne pliki projektu.
prune_empty_dirs() {
  local d="$(dirname "$PROJECT_DIR/$1")" stop="$PROJECT_DIR/$MANAGED_ROOT"
  while [[ "$d" != "$stop" && "$d" == "$stop"/* ]] && rmdir "$d" 2>/dev/null; do
    d="$(dirname "$d")"
  done
}
for rel in "${REMOVE[@]+"${REMOVE[@]}"}"; do prune_empty_dirs "$rel"; done

# --- Zaktualizuj marker wersji i manifest ---
printf '%s\n' "$UPSTREAM_SHA" > "$VERSION_FILE"
printf '%s\n' "${MANAGED[@]}" > "$MANIFEST_FILE"
zapisz_hashe

echo "APPLIED: zaaplikowano zmiany."
if [[ "${#UPDATE[@]}" -gt 0 || "${#REMOVE[@]}" -gt 0 ]]; then
  echo "BACKUP: $BACKUP_DIR"
fi
# N2: instrukcje i skille są buforowane w sesji — autopilot w sesji sprzed syncu działałby na starej maszynerii.
echo "NOWA SESJA: .claude/ się zmieniło — otwórz nową sesję Claude Code przed /dev-autopilot-wf (bieżąca sesja ma w pamięci starą maszynerię)."
doctor_pierwszej_instalacji

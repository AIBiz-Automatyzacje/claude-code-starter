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

# --- Przygotuj źródło (klon albo lokalna ścieżka) ---
TMP_CLONE=""
cleanup() { [[ -n "$TMP_CLONE" && -d "$TMP_CLONE" ]] && rm -rf "$TMP_CLONE"; }
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
  echo "APPLIED: brak różnic w plikach — zaktualizowano tylko marker wersji."
  exit 0
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

# --- Zaktualizuj marker wersji i manifest ---
printf '%s\n' "$UPSTREAM_SHA" > "$VERSION_FILE"
printf '%s\n' "${MANAGED[@]}" > "$MANIFEST_FILE"

echo "APPLIED: zaaplikowano zmiany."
if [[ "${#UPDATE[@]}" -gt 0 || "${#REMOVE[@]}" -gt 0 ]]; then
  echo "BACKUP: $BACKUP_DIR"
fi

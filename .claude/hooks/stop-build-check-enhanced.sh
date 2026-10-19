#!/bin/bash

# Stop Build Check Enhanced
# Uruchamia TSC przy zakończeniu odpowiedzi Claude
# - 0 błędów: sukces (exit 0)
# - 1-3 błędy: ostrzeżenie (exit 1 = non-blocking)
# - >3 błędy: blokada (exit 2 = blocking)
#
# Claude Code hooks (Stop event):
# - exit 0 = sukces, stdout parsowany jako JSON
# - exit 2 = blocking — stderr przekazywany do Claude, Claude kontynuuje pracę
# - exit 1 = non-blocking — stderr widoczne TYLKO w verbose mode (Ctrl+O), Claude NIE widzi
# Dlatego używamy exit 2 gdy chcemy, żeby Claude zareagował na błędy.

set -e

WEJSCIE=$(cat)

# stop_hook_active: Claude kontynuuje juz po blokadzie hooka Stop — druga blokada w tej turze to petla.
if printf '%s' "$WEJSCIE" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
fi

# Konfiguracja
ERROR_THRESHOLD=3
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID=$(printf '%s' "$WEJSCIE" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]*"' | sed 's/.*"\([A-Za-z0-9_-]*\)"$/\1/' || true)
SESSION_ID="${SESSION_ID:-default}"
# Cache poza repo (katalog tymczasowy per projekt i sesja): zapis w drzewie projektu daje nieśledzone pliki,
# a autopilot i bramka gotowości zatrzymują się na brudnym drzewie.
PROJECT_KEY="$(basename "$PROJECT_DIR")-$(printf '%s' "$PROJECT_DIR" | cksum | cut -d' ' -f1)"
CACHE_DIR="${TMPDIR:-/tmp}"
CACHE_DIR="${CACHE_DIR%/}/claude-tsc-cache/$PROJECT_KEY/$SESSION_ID"

# Sprawdź czy projekt używa TypeScript
if [ ! -f "$PROJECT_DIR/tsconfig.json" ]; then
    exit 0
fi

# Sprawdź czy TypeScript jest zainstalowany
if [ ! -d "$PROJECT_DIR/node_modules/typescript" ]; then
    exit 0
fi

# Katalog cache; niezapisywalny TMPDIR nie wyłącza sprawdzenia, tylko zapis cache.
mkdir -p "$CACHE_DIR" 2>/dev/null || CACHE_DIR=""

# Przejdź do katalogu projektu
cd "$PROJECT_DIR"

# Wersja drzewa: HEAD, gałąź i długość reflogu HEAD (checkout tam i z powrotem też go wydłuża). Zmiana w trakcie tsc
# (np. `git checkout` gałęzi części PR przez workflow w tle) = tsc czytał listę plików ze starego drzewa.
wersja_drzewa() {
    git rev-parse HEAD 2>/dev/null || true
    git symbolic-ref -q HEAD 2>/dev/null || true
    REFLOG=$(git rev-parse --git-path logs/HEAD 2>/dev/null || true)
    if [ -n "$REFLOG" ] && [ -f "$REFLOG" ]; then wc -c < "$REFLOG"; fi
}

# --pretty false: bez kolorów ANSI, które psują wzorzec "error TS" przy "pretty": true w tsconfig.
TSC="npx tsc --noEmit --pretty false"
PRZED=$(wersja_drzewa)
TSC_OUTPUT=$($TSC 2>&1 || true)
if [ "$(wersja_drzewa)" != "$PRZED" ]; then
    # Drugi bieg na bieżącym drzewie; gdy drzewo zmienia się dalej, wynik nic nie mówi o kodzie sesji.
    PRZED=$(wersja_drzewa)
    TSC_OUTPUT=$($TSC 2>&1 || true)
    if [ "$(wersja_drzewa)" != "$PRZED" ]; then
        echo "TSC CHECK POMINIĘTY - drzewo zmieniało się w trakcie sprawdzenia (zmiana gałęzi)" >&2
        exit 0
    fi
fi

# TS6053 („File not found”) bez położenia, z plikiem dobranym wzorcem include („Matched by include pattern”), którego
# nie ma w bieżącym drzewie = ślad zmiany drzewa w trakcie tsc, nie błąd kodu: pomijamy go w liczniku i w wypisie.
# Brak pliku z listy "files", z /// <reference> albo z references zostaje błędem (inne wyjaśnienie albo położenie).
KANDYDACI=$(printf '%s\n' "$TSC_OUTPUT" | awk '
    { l[NR] = $0 }
    END {
        for (i = 1; i <= NR; i++) {
            if (l[i] !~ /^error TS6053: File \047.*\047 not found\./) continue
            for (j = i + 1; j <= i + 3 && j <= NR; j++) {
                if (l[j] ~ /Matched by include pattern/) {
                    f = l[i]; sub(/^error TS6053: File \047/, "", f); sub(/\047 not found\..*$/, "", f); print f; break
                }
            }
        }
    }')
BRAKUJACE=""
while IFS= read -r PLIK; do
    if [ -n "$PLIK" ] && [ ! -e "$PLIK" ]; then
        BRAKUJACE="$BRAKUJACE$PLIK
"
    fi
done <<< "$KANDYDACI"
POMINIETE=$(printf '%s' "$BRAKUJACE" | grep -c . || true)
if [ "$POMINIETE" -gt 0 ]; then
    TSC_OUTPUT=$(printf '%s\n' "$TSC_OUTPUT" | BRAKUJACE="$BRAKUJACE" awk '
        BEGIN { n = split(ENVIRON["BRAKUJACE"], b, "\n"); for (k = 1; k <= n; k++) if (b[k] != "") brak["error TS6053: File \047" b[k] "\047 not found."] = 1 }
        !($0 in brak)')
fi

# Zapisz output do cache
if [ -n "$CACHE_DIR" ]; then
    echo "$TSC_OUTPUT" > "$CACHE_DIR/last-errors.txt"
    echo "$TSC" > "$CACHE_DIR/tsc-commands.txt"
fi

# Zlicz błędy (wzorzec "error TS")
ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep "error TS" | wc -l | tr -d ' ')
ERROR_COUNT=${ERROR_COUNT:-0}

# Logika w zależności od liczby błędów
if [ "$ERROR_COUNT" -eq 0 ]; then
    # Sukces - brak błędów
    echo "TSC CHECK PASSED - brak błędów TypeScript" >&2
    if [ "$POMINIETE" -gt 0 ]; then
        echo "Pominięte TS6053 plików spoza bieżącego drzewa: $POMINIETE" >&2
    fi
    exit 0

elif [ "$ERROR_COUNT" -le "$ERROR_THRESHOLD" ]; then
    # Blocking — Claude zobaczy feedback i naprawić błędy
    {
        echo ""
        echo "⚠️  TSC CHECK: $ERROR_COUNT błąd(y)"
        echo ""
        echo "$TSC_OUTPUT" | grep "error TS" | head -10
        echo ""
        echo "Napraw błędy TypeScript przed zakończeniem: typ zamiast any, as tylko przy as const i zawężaniu DOM (reguły kodu, sekcja Type safety)."
        echo ""
    } >&2
    exit 2

else
    # Blokada - zbyt wiele błędów (blocking)
    {
        echo ""
        echo "❌ TSC CHECK FAILED: $ERROR_COUNT błędów"
        echo ""
        echo "Pierwsze 15 błędów:"
        echo "$TSC_OUTPUT" | grep "error TS" | head -15
        echo ""
        echo "INSTRUKCJA: Napraw błędy TypeScript zanim zakończysz (zacznij od pierwszych — kolejne często są kaskadą)."
        if [ -n "$CACHE_DIR" ]; then echo "Cache błędów: $CACHE_DIR/last-errors.txt"; fi
        echo ""
    } >&2
    exit 2
fi

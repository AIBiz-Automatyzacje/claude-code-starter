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

# Konfiguracja
ERROR_THRESHOLD=3
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CACHE_DIR="$PROJECT_DIR/.claude/tsc-cache/$SESSION_ID"

# Sprawdź czy projekt używa TypeScript
if [ ! -f "$PROJECT_DIR/tsconfig.json" ]; then
    exit 0
fi

# Sprawdź czy TypeScript jest zainstalowany
if [ ! -d "$PROJECT_DIR/node_modules/typescript" ]; then
    exit 0
fi

# Utwórz katalog cache jeśli nie istnieje
mkdir -p "$CACHE_DIR"

# Przejdź do katalogu projektu
cd "$PROJECT_DIR"

# Uruchom TSC i przechwyć output
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)

# Zapisz output do cache
echo "$TSC_OUTPUT" > "$CACHE_DIR/last-errors.txt"
echo "npx tsc --noEmit" > "$CACHE_DIR/tsc-commands.txt"

# Zlicz błędy (wzorzec "error TS")
ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep "error TS" | wc -l | tr -d ' ')
ERROR_COUNT=${ERROR_COUNT:-0}

# Logika w zależności od liczby błędów
if [ "$ERROR_COUNT" -eq 0 ]; then
    # Sukces - brak błędów
    echo "TSC CHECK PASSED - brak błędów TypeScript" >&2
    exit 0

elif [ "$ERROR_COUNT" -le "$ERROR_THRESHOLD" ]; then
    # Blocking — Claude zobaczy feedback i naprawić błędy
    {
        echo ""
        echo "⚠️  TSC CHECK: $ERROR_COUNT błąd(y)"
        echo ""
        echo "$TSC_OUTPUT" | grep "error TS" | head -10
        echo ""
        echo "Napraw błędy TypeScript przed zakończeniem (typuj poprawnie, nie używaj any/as)."
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
        echo "Cache błędów: $CACHE_DIR/last-errors.txt"
        echo ""
    } >&2
    exit 2
fi

#!/bin/bash

# Error Handling Reminder
# Hook Stop — sprawdza edytowane pliki pod kątem poprawnego error handlingu
# Wyłączony w projekcie z eslint.config.* z szablonu (.claude/templates/bramki) — tam pracę robi ESLint w bramkach.
#
# Frontend (src/): wykrywa console.log/warn/error → sugeruje Sentry
# Edge Functions (supabase/functions/, handler withSupabase albo Deno.serve): wymaga await captureError w catch
#
# Exit codes: 0 = OK, 2 = blocking (Claude widzi stderr i kontynuuje pracę)
# UWAGA: exit 1 = non-blocking, stderr trafia TYLKO do verbose mode — Claude NIE widzi!

set -e

# stop_hook_active: Claude kontynuuje juz po blokadzie hooka Stop — druga blokada w tej turze to petla.
if grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Projekt z konfiguracja ESLint z szablonu (komentarz ze sciezka .claude/templates/bramki): no-console, no-empty
# i no-floating-promises lapia to samo w bramce domkniecia fazy (PLAN-POPRAWY P6). Hook dziala w projektach bez niej.
if grep -qs '\.claude/templates/bramki' eslint.config.*; then
    exit 0
fi

# Pobierz listę zmienionych plików TS/TSX (staged + unstaged + untracked)
CHANGED_FILES=$(
    {
        git diff --name-only HEAD 2>/dev/null || true
        git diff --name-only 2>/dev/null || true
        git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u
)

if [ -z "$CHANGED_FILES" ]; then
    exit 0
fi

# Filtruj tylko pliki TS/TSX, pomiń testy i konfiguracje
FILES=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx)$' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -v '\.d\.ts$' \
    | grep -v '\.config\.' \
    | grep -v 'vite\.config' \
    | grep -v 'tailwind\.config' \
    | grep -v 'tsconfig' \
    | grep -v 'node_modules' \
    || true)

if [ -z "$FILES" ]; then
    exit 0
fi

WARNINGS=""
WARNING_COUNT=0

# === FRONTEND: sprawdź pliki w src/ ===
FRONTEND_FILES=$(echo "$FILES" | grep '^src/' || true)

for file in $FRONTEND_FILES; do
    [ -f "$PROJECT_DIR/$file" ] || continue

    # Sprawdź console.log/warn/error (pomiń komentarze)
    CONSOLE_HITS=$(grep -n 'console\.\(log\|warn\|error\)\s*(' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)

    if [ -n "$CONSOLE_HITS" ]; then
        WARNINGS="${WARNINGS}\n   ${file}"
        while IFS= read -r line; do
            LINE_NUM=$(echo "$line" | cut -d: -f1)
            CONTENT=$(echo "$line" | cut -d: -f2- | xargs)
            WARNINGS="${WARNINGS}\n     Linia ${LINE_NUM}: ${CONTENT}"
            WARNING_COUNT=$((WARNING_COUNT + 1))
        done <<< "$CONSOLE_HITS"
        WARNINGS="${WARNINGS}\n     → Nieoczekiwany błąd: logger.error() (frontend) albo await captureError() (Edge Functions) — zdarzenie Sentry; oczekiwana odmowa (walidacja, 401/403/404): logger.info() bez zdarzenia — skill sentry-integration"
        WARNINGS="${WARNINGS}\n"
    fi
done

# === EDGE FUNCTIONS: sprawdź pliki w supabase/functions/ ===
EDGE_FILES=$(echo "$FILES" | grep '^supabase/functions/' | grep -v '_shared/' || true)

for file in $EDGE_FILES; do
    [ -f "$PROJECT_DIR/$file" ] || continue

    CONTENT=$(cat "$PROJECT_DIR/$file")

    # Tylko główne pliki funkcji: handler withSupabase (wzorzec skilla) albo legacy Deno.serve
    echo "$CONTENT" | grep -qE 'withSupabase|Deno\.serve' || continue

    FILE_WARNINGS=""

    # Sprawdź czy ma try-catch
    if echo "$CONTENT" | grep -q 'try\s*{'; then

        # Sprawdź czy importuje Sentry
        if ! echo "$CONTENT" | grep -qE 'import.*sentry|from.*sentry'; then
            FILE_WARNINGS="${FILE_WARNINGS}\n     Brak importu Sentry — wymagany w Edge Functions"
        fi

        # Sprawdź captureError
        if ! echo "$CONTENT" | grep -q 'captureError\s*('; then
            FILE_WARNINGS="${FILE_WARNINGS}\n     Brak captureError() — wymagany w catch block"
        fi

        # captureError flushuje wewnętrznie (sentry-integration) — wymagane jest samo await
        if echo "$CONTENT" | grep -q 'captureError\s*(' && ! echo "$CONTENT" | grep -q 'await\s\+captureError\s*('; then
            FILE_WARNINGS="${FILE_WARNINGS}\n     captureError() bez await — event Sentry może nie zostać wysłany przed odpowiedzią"
        fi
    fi

    if [ -n "$FILE_WARNINGS" ]; then
        WARNINGS="${WARNINGS}\n   ${file}${FILE_WARNINGS}\n"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
done

# === OUTPUT ===
if [ "$WARNING_COUNT" -gt 0 ]; then
    {
        echo ""
        echo "⚠️  ERROR HANDLING CHECK: ${WARNING_COUNT} ostrzeżeń"
        echo ""
        echo -e "$WARNINGS"
        echo "Zastosuj wzorce z skill sentry-integration."
        echo "Zapytaj użytkownika: Czy chcesz, żebym naprawił powyższe ostrzeżenia? (tak/nie)"
        echo ""
    } >&2
    exit 2
fi

exit 0

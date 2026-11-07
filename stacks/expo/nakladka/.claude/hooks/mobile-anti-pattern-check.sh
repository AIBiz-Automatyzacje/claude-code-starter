#!/bin/bash

# Mobile Anti-Pattern Check
# Hook Stop: w zmienionych plikach szuka wzorców webowych, które nie działają w React Native.
# Reguły: .claude/rules/stack.md, sekcja „Prymitywy RN zamiast DOM i Web API”.
#
# Pomija pliki, w których web API jest poprawne: *.web.ts(x), +html.tsx, supabase/functions/ (Deno), testy, konfiguracje.
# Linie komentarzy (// i *) nie liczą się.
#
# Exit codes: 0 = OK, 2 = blocking (Claude widzi stderr i kontynuuje pracę).

set -e

# stop_hook_active: Claude kontynuuje już po blokadzie hooka Stop; druga blokada w tej turze to pętla.
if grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

CHANGED_FILES=$(
    {
        git diff --name-only HEAD 2>/dev/null || true
        git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u
)

[ -n "$CHANGED_FILES" ] || exit 0

WARNINGS=""
WARNING_COUNT=0

# Trafienia wzorca w pliku z numerami linii, bez komentarzy.
trafienia() {
    { grep -nE -- "$1" "$2" 2>/dev/null || true; } | { grep -vE '^[0-9]+:[[:space:]]*(//|\*)' || true; }
}

dopisz() {
    local hits="$1" message="$2" line
    [ -n "$hits" ] || return 0
    FILE_HITS="${FILE_HITS}\n     ${message}"
    while IFS= read -r line; do
        FILE_HITS="${FILE_HITS}\n        Linia ${line%%:*}"
    done <<< "$hits"
}

zglos_plik() {
    [ -n "$FILE_HITS" ] || return 0
    WARNINGS="${WARNINGS}\n   ${1}${FILE_HITS}\n"
    WARNING_COUNT=$((WARNING_COUNT + 1))
}

KOD=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx)$' \
    | grep -vE '\.(test|spec)\.|\.d\.ts$|\.config\.|node_modules|\.web\.tsx?$|(^|/)\+html\.tsx$|^supabase/functions/|(^|/)__tests__/' \
    || true)

while IFS= read -r file; do
    [ -n "$file" ] && [ -f "$file" ] || continue
    FILE_HITS=""

    # Klient Supabase w wariancie domyślnym (D9) używa polyfillu localStorage z expo-sqlite.
    if ! grep -q 'expo-sqlite/localStorage' "$file"; then
        dopisz "$(trafienia '\b(localStorage|sessionStorage)\b' "$file")" "localStorage/sessionStorage → expo-secure-store (sekrety) albo AsyncStorage (cache):"
    fi
    dopisz "$(trafienia '<(div|span|button|input|a)[ />]' "$file")" "HTML elementy → <View>, <Text>, <Pressable>, <TextInput>, <Link> z expo-router:"
    dopisz "$(trafienia "from ['\"]react-router(-dom)?['\"]" "$file")" "react-router → expo-router:"
    dopisz "$(trafienia '\b(useNavigate|useLocation)[[:space:]]*\(' "$file")" "useNavigate/useLocation → useRouter()/usePathname() z expo-router:"
    dopisz "$(trafienia '\b(window|document)\.' "$file")" "window./document. → crash w RN (brak DOM); plik .web.tsx albo warunek process.env.EXPO_OS === 'web':"
    dopisz "$(trafienia 'import\.meta\.env' "$file")" "import.meta.env → process.env.EXPO_PUBLIC_*:"
    dopisz "$(trafienia "import[^;]*\bSafeAreaView\b[^;]*from ['\"]react-native['\"]" "$file")" "SafeAreaView z react-native → react-native-safe-area-context:"
    dopisz "$(trafienia 'process\.env\[' "$file")" "process.env[...] → odczyt przez kropkę; Expo nie podstawi dynamicznego klucza:"

    zglos_plik "$file"
done <<< "$KOD"

KONFIGURACJA=$(echo "$CHANGED_FILES" | grep -E '^app\.(json|config\.(ts|js))$' || true)
while IFS= read -r file; do
    [ -n "$file" ] && [ -f "$file" ] || continue
    FILE_HITS=""
    dopisz "$(trafienia "[\"']?[a-zA-Z]+Permission[\"']?[[:space:]]*:[[:space:]]*false" "$file")" "Uprawnienie na false w config pluginie kasuje klucz Info.plist globalnie; usuń wpis:"
    zglos_plik "$file"
done <<< "$KONFIGURACJA"

if [ "$WARNING_COUNT" -gt 0 ]; then
    {
        echo ""
        echo "MOBILE ANTI-PATTERN CHECK: ${WARNING_COUNT} plik(ów) z wzorcami webowymi"
        echo ""
        echo -e "$WARNINGS"
        echo "React Native nie ma DOM ani Web API."
        echo "Reguły: .claude/rules/stack.md, sekcja „Prymitywy RN zamiast DOM i Web API”."
        echo ""
    } >&2
    exit 2
fi

exit 0

#!/bin/zsh
# Pomiar 1: ktore markery (CLAUDE.md, rules bez paths, rules z paths) docieraja do sesji glownej i subagentow.
R=$1; OUT=$2; mkdir -p $OUT; cd $R
FORMAT='Na koncu wypisz WYLACZNIE JSON: {"markery": [wszystkie ciagi pasujace do MARKER-[A-Z]+-[a-z0-9]{4}, ktore WIDZISZ w swoim kontekscie, instrukcjach lub przeczytanych plikach - przepisz dokladnie, nie zgaduj], "zrodlo": {marker: "instrukcje" | "plik"}}. Nic wiecej.'
run() { # nazwa, prompt
  echo "== $1"; claude -p --model sonnet --output-format json --permission-mode bypassPermissions --max-turns 12 "$2" > $OUT/$1.json 2> $OUT/$1.err; echo "exit $?"
}
run s0-main-bez-akcji "Nie czytaj zadnych plikow i nie uzywaj narzedzi. $FORMAT"
run s1-main-read-tsx "Przeczytaj narzedziem Read plik src/App.tsx. $FORMAT"
run s2-main-bash-cat-tsx "Uruchom Bash: cat src/App.tsx (nie uzywaj Read). $FORMAT"
run s3-main-read-migracja "Przeczytaj narzedziem Read plik supabase/migrations/001_init.sql. $FORMAT"
run s4-main-write-nowy-tsx "Utworz narzedziem Write nowy plik src/Nowy.tsx z trescia 'export const N = 1'. Nie czytaj innych plikow. $FORMAT"
run s5-main-read-test-i-docker "Przeczytaj narzedziem Read pliki src/util.test.ts i Dockerfile. $FORMAT"
run s6-main-glob-bez-otwierania "Uruchom Bash: ls -R src supabase (tylko lista plikow, NIE otwieraj zadnego). $FORMAT"
run s7-main-edit-tsx "Narzedziem Edit zamien w src/App.tsx slowo hello na witaj (najpierw Read jesli wymagane). $FORMAT"
run s8-agent-pelny-read-tsx "Uzyj narzedzia Agent z subagent_type 'pelny' i promptem: 'Przeczytaj narzedziem Read plik src/App.tsx i wypisz JSON markerow wg swojej instrukcji.' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s9-agent-goly-read-tsx "Uzyj narzedzia Agent z subagent_type 'goly' i promptem: 'Przeczytaj narzedziem Read plik src/App.tsx i wypisz JSON markerow wg swojej instrukcji.' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s10-agent-pelny-bez-akcji "Uzyj narzedzia Agent z subagent_type 'pelny' i promptem: 'Nie czytaj zadnych plikow. Wypisz JSON markerow wg swojej instrukcji.' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s11-agent-goly-bez-akcji "Uzyj narzedzia Agent z subagent_type 'goly' i promptem: 'Nie czytaj zadnych plikow. Wypisz JSON markerow wg swojej instrukcji.' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s12-agent-general-read-mig "Uzyj narzedzia Agent z subagent_type 'general-purpose' i promptem: 'Przeczytaj narzedziem Read plik supabase/migrations/001_init.sql. $FORMAT' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s13-agent-goly-bash-cat-mig "Uzyj narzedzia Agent z subagent_type 'goly' i promptem: 'Uruchom Bash: cat supabase/migrations/001_init.sql i wypisz JSON markerow wg swojej instrukcji.' Zwroc jego odpowiedz DOSLOWNIE jako swoja jedyna odpowiedz, bez komentarza."
run s14-main-workflow-dostepny "Czy masz dostepne narzedzie o nazwie Workflow? Odpowiedz WYLACZNIE JSON: {\"workflow\": true|false, \"narzedzia\": [lista nazw Twoich narzedzi]}."
echo DONE

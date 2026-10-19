#!/bin/bash
# Pilot A2: hook Stop (stary z main / nowy z galezi) na kopii vibersi, a w trakcie tsc `git checkout` commitu konca czesci 1
# (76f3c62 — bez plikow faz 4–6), jak workflow /dev-pr start w tle. Wynik: kod wyjscia, liczba TS6053, zapis w drzewie.
K="$1/vibersi"
for wariant in stary nowy; do
  git -C "$K" checkout -q main
  rm -rf "$K/.claude/tsc-cache"
  ( echo '{"session_id":"pilot","stop_hook_active":false}' | CLAUDE_PROJECT_DIR="$K" TMPDIR="$1/tmp-$wariant/" bash "$1/hook-$wariant.sh" > "$1/a2-$wariant.txt" 2>&1; echo "kod $?" >> "$1/a2-$wariant.txt" ) &
  perl -e "select(undef,undef,undef,$2)"
  git -C "$K" checkout -q 76f3c62
  wait
  echo "== $wariant: $(grep -m1 -E 'TSC CHECK|kod' "$1/a2-$wariant.txt") | TS6053: $(grep -c TS6053 "$1/a2-$wariant.txt") | $(tail -1 "$1/a2-$wariant.txt") | drzewo: $(git -C "$K" status --porcelain --untracked-files=all | wc -l | tr -d ' ') nieśledzonych"
  grep -E "Pominięte|POMINIĘTY" "$1/a2-$wariant.txt"
done
git -C "$K" checkout -q main

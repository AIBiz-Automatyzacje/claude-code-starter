#!/bin/bash
# Pilot B3: rebase czesci 2 etapu 4 vibersi (stan sprzed rebase'u z reflogu) i procedura regeneracji indeksu z polecenia
# dev-pr-wf (krok po kroku jak agent): konflikt tylko w docs/learned-patterns.md -> indeks z drzewa commitu, continue.
cd "$1" || exit 2
git switch -q -c pilot-cz2 3e1b2d9 2>/dev/null || git switch -q pilot-cz2
git rebase --onto a726c04 76f3c62 >/dev/null 2>&1
regeneracje=0
while test -d "$(git rev-parse --git-path rebase-merge)" || test -d "$(git rev-parse --git-path rebase-apply)"; do
  konflikty=$(git diff --name-only --diff-filter=U)
  if [ "$konflikty" != "docs/learned-patterns.md" ]; then
    echo "KONFLIKT: $konflikty (po $regeneracje regeneracjach; commit $(git rev-parse --short REBASE_HEAD 2>/dev/null))"
    exit 1
  fi
  git checkout --theirs -- docs/learned-patterns.md
  wynik=$(node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz)
  zapisany=$(printf '%s' "$wynik" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).zapisany))')
  echo "regeneracja $((regeneracje + 1)): commit $(git rev-parse --short REBASE_HEAD) zapisany=$zapisany"
  git add docs/learned-patterns.md
  GIT_EDITOR=true git rebase --continue >/dev/null 2>&1
  regeneracje=$((regeneracje + 1))
done
echo "OK: rebase dokonczony, regeneracji $regeneracje, czubek $(git rev-parse --short HEAD)"

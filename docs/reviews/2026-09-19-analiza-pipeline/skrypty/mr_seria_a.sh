#!/bin/zsh
# Mini-run seria A: przygotowanie i sprzatanie kopii wokol jednego przebiegu buildera (bez agentow).
# Uzycie: mr_seria_a.sh przed <n>   — wpisuje regule R (paths:) i linie S (SKILL.md) dla przebiegu A-<n>
#         mr_seria_a.sh po <n>      — zrzut nowych/zmienionych plikow + diff do scratchpad/mr/wyniki/A-<n>/, potem reset kopii
set -e
TRYB=$1; N=$2
BASE=/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline
SP=/private/tmp/claude-501/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/scratchpad
K=$SP/oferty-kopia; SKILL=.claude/skills/supabase-dev-guidelines/SKILL.md
cd $K
if [ "$TRYB" = przed ]; then
  [ -z "$(git status --porcelain -- apps supabase .claude)" ] || { echo "kopia nie jest czysta"; git status --short; exit 1; }
  python3 - "$BASE/dane/mr-markery.json" "A-$N" "$SKILL" <<'P'
import json, sys
m = json.load(open(sys.argv[1]))['runy'][sys.argv[2]]
open('.claude/rules/mr-migracje.md', 'w').write(m['regula_R'])
s = open(sys.argv[3]).read(); kotwica = '7. **Logger dla Błędów**: `logger.error()` zamiast `console.error()`'
assert s.count(kotwica) == 1
open(sys.argv[3], 'w').write(s.replace(kotwica, kotwica + '\n' + m['skill_S']))
print('R:', m['markery']['R'], ' S:', m['markery']['S'])
P
  git status --short
elif [ "$TRYB" = po ]; then
  O=$SP/mr/wyniki/A-$N; mkdir -p $O
  git status --porcelain > $O/status.txt
  git diff > $O/diff.txt
  git ls-files --others --exclude-standard -- apps supabase packages .claude | grep -v '^.claude/rules/mr-migracje.md$' | while read f; do mkdir -p $O/pliki/$(dirname $f); cp $f $O/pliki/$f; done
  git diff --name-only -- apps supabase packages | while read f; do mkdir -p $O/pliki/$(dirname $f); cp $f $O/pliki/$f; done
  git checkout -- apps supabase packages .claude
  git clean -fdq -- apps supabase packages .claude/rules
  echo "zrzut: $O"; ls -R $O/pliki 2>/dev/null | head -20; git status --short
else echo "tryb: przed|po"; exit 1; fi

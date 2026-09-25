#!/bin/zsh
# Test review (TEST-REVIEW-PLAN §3) — kopia kodu oferty-online w stanie z chwili historycznej, poza repo i poza Documents/Kodowanie.
# Zero agentow. oferty-online i workspace-template sa tylko czytane (clone --mirror, cp z .claude szablonu).
#
# Uzycie:
#   test_review_kopia.sh stan <przed|po>                 — dowod "bez zmian" (§3 pkt 7): refy + status oferty-online, status .claude/CLAUDE.md szablonu
#   test_review_kopia.sh narzedzia                       — jednorazowo: narzedzia bramek w ~/test-review/_narzedzia (NIE w kopii — package.json kopii zostaje czysty)
#   test_review_kopia.sh kopia <sha> <etykieta> <zadanie> [--bez-instalacji]
#        klon uciety na <sha> (tylko przodkowie), main = commit main z epoki, galaz feature/<zadanie>, overlay .claude/ szablonu z HEAD
#        (learned-patterns.md i CLAUDE.md zostaja z epoki), skip-worktree/exclude, pnpm install --frozen-lockfile, metadane.
set -euo pipefail
SRC=/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online
SZ=/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template
DANE=$SZ/docs/reviews/2026-09-19-analiza-pipeline/dane/test-review
TR=$HOME/test-review
MIR=$TR/_mirror
mkdir -p $TR/kopie $TR/meta $DANE

stan() {
  local plik=$1
  {
    echo "# oferty-online: for-each-ref"
    git -C $SRC for-each-ref --format='%(objectname) %(refname)'
    echo "# oferty-online: status --porcelain"
    git -C $SRC status --porcelain
    echo "# oferty-online: HEAD"
    git -C $SRC rev-parse HEAD
    echo "# workspace-template: status --porcelain -- .claude CLAUDE.md"
    git -C $SZ status --porcelain -- .claude CLAUDE.md
    echo "# workspace-template: HEAD"
    git -C $SZ rev-parse HEAD
  } > $plik
}

case ${1:-} in
stan)
  [[ ${2:-} == przed || ${2:-} == po ]] || { echo "stan <przed|po>"; exit 1 }
  stan $DANE/stan-$2.txt
  echo "zapisano $DANE/stan-$2.txt ($(wc -l < $DANE/stan-$2.txt) linii)"
  if [[ $2 == po ]]; then
    if diff -q $DANE/stan-przed.txt $DANE/stan-po.txt >/dev/null; then echo "BEZ ZMIAN: oferty-online i .claude/CLAUDE.md szablonu identyczne jak przed"
    else echo "STOP §11: roznica stanu"; diff $DANE/stan-przed.txt $DANE/stan-po.txt; exit 2; fi
  fi
  ;;

narzedzia)
  N=$TR/_narzedzia
  mkdir -p $N
  cat > $N/package.json <<'J'
{
  "name": "test-review-narzedzia",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@size-limit/file": "14.0.1",
    "@stryker-mutator/core": "10.0.0",
    "@stryker-mutator/vitest-runner": "10.0.0",
    "@vitest/eslint-plugin": "1.6.27",
    "eslint": "10.11.0",
    "eslint-plugin-import-x": "4.17.1",
    "eslint-plugin-react-hooks": "7.1.1",
    "globals": "17.12.0",
    "knip": "6.38.0",
    "size-limit": "14.0.1",
    "typescript": "5.9.3",
    "typescript-eslint": "8.70.1",
    "vitest": "4.1.11"
  }
}
J
  # pnpm (menedzer projektu) z plaskim node_modules — konfiguracje ESLint importuja pluginy przez rozwiazywanie ESM w gore katalogow
  (cd $N && pnpm install --config.node-linker=hoisted --reporter=silent)
  echo "narzedzia: $(ls $N/node_modules | wc -l) pakietow w $N/node_modules"
  ;;

kopia)
  SHA=$2; ET=$3; ZAD=$4; INST=${5:-}
  K=$TR/kopie/$ET
  [[ -e $K ]] && { echo "kopia juz istnieje: $K (usun recznie po potwierdzeniu)"; exit 1 }
  if [[ ! -d $MIR ]]; then
    git clone -q --mirror --no-hardlinks $SRC $MIR
    git -C $MIR remote remove origin
  fi
  PELNY=$(git -C $MIR rev-parse --verify "$SHA^{commit}")
  # main z epoki = najnowszy commit first-parent historii main, ktory jest przodkiem fazy (punkt rozgalezienia zadania)
  MAIN_EP=""
  for m in $(git -C $MIR rev-list --first-parent main); do
    if git -C $MIR merge-base --is-ancestor $m $PELNY; then MAIN_EP=$m; break; fi
  done
  [[ -n $MAIN_EP ]] || { echo "brak main z epoki dla $SHA"; exit 1 }
  git -C $MIR branch -f test/$ET $PELNY
  git clone -q --no-tags --single-branch --branch test/$ET $MIR $K
  git -C $K remote remove origin
  git -C $K branch -m test/$ET feature/$ZAD
  git -C $K branch main $MAIN_EP
  # szczelnosc historii: w kopii wylacznie przodkowie fazy
  N_KOPIA=$(git -C $K rev-list --all --count); N_FAZA=$(git -C $MIR rev-list --count $PELNY)
  [[ $N_KOPIA == $N_FAZA ]] || { echo "STOP: kopia ma $N_KOPIA commitow, przodkow fazy $N_FAZA"; exit 2 }

  # overlay maszynerii dzisiejszej (bez zmian) — learned-patterns.md i CLAUDE.md zostaja z epoki
  rsync -a --exclude .DS_Store --exclude settings.local.json --exclude rules/learned-patterns.md $SZ/.claude/ $K/.claude/
  cd $K
  NADPISANE=$(git status --porcelain -- .claude | awk '$1=="M"{print $2}')
  NOWE=$(git status --porcelain --untracked-files=all -- .claude | awk '$1=="??"{print $2}')
  [[ -n $NADPISANE ]] && echo $NADPISANE | xargs git update-index --skip-worktree
  [[ -n $NOWE ]] && echo $NOWE >> .git/info/exclude
  echo "node_modules/" >> .git/info/exclude
  [[ -z $(git status --porcelain) ]] || { echo "STOP: kopia brudna po overlay"; git status --short | head; exit 2 }

  if [[ $INST != --bez-instalacji ]]; then
    pnpm install --frozen-lockfile --prefer-offline --reporter=silent
    [[ -z $(git status --porcelain) ]] || { echo "STOP: kopia brudna po instalacji"; git status --short | head; exit 2 }
  fi
  python3 - $K $ET $PELNY $MAIN_EP $ZAD "$NADPISANE" "$NOWE" $TR/meta/$ET.json <<'P'
import json, subprocess, sys
k, et, sha, main_ep, zad, nadp, nowe, out = sys.argv[1:9]
g = lambda *a: subprocess.run(['git', '-C', k, *a], capture_output=True, text=True).stdout.strip()
json.dump({'etykieta': et, 'sha': sha, 'main_epoki': main_ep, 'zadanie': zad, 'galaz': 'feature/' + zad, 'kopia': k,
           'temat': g('log', '-1', '--format=%s'), 'data': g('log', '-1', '--format=%aI'),
           'commitow_zadania': int(g('rev-list', '--count', main_ep + '..HEAD') or 0),
           'claude_md_zn': len(open(k + '/CLAUDE.md', encoding='utf-8').read()) if g('ls-files', 'CLAUDE.md') else 0,
           'learned_patterns_zn': len(open(k + '/.claude/rules/learned-patterns.md', encoding='utf-8').read())
               if g('ls-files', '.claude/rules/learned-patterns.md') else 0,
           'claude_nadpisane': [x for x in nadp.split() if x], 'claude_nowe': len([x for x in nowe.split() if x])},
          open(out, 'w'), ensure_ascii=False, indent=1)
P
  echo "kopia $ET: $K | main epoki ${MAIN_EP:0:10} | commitow zadania $(git rev-list --count $MAIN_EP..HEAD) | .claude nadpisane $(echo $NADPISANE | grep -c . || true), nowe $(echo $NOWE | grep -c . || true)"
  ;;

*) sed -n 2,11p $0; exit 1 ;;
esac

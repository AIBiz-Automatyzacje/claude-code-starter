#!/bin/zsh
# Mini-run czesc B, krok przygotowania (bez agentow): klon APFS oferty-online do scratchpadu, sanityzacja, hook testowy Stop.
# Uzycie: mr_przygotuj.sh <scratchpad>
set -e
SP=$1; SRC=/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online; K=$SP/oferty-kopia
[ -e $K ] && { echo "kopia juz istnieje: $K"; exit 1; }
mkdir -p $SP/mr/wyniki
cp -cR $SRC $K
cp /Users/kacper_trzepiecinski/Documents/Kodowanie/CLAUDE.md $SP/CLAUDE.md
cd $K
rm -f .env .env.e2e
rm -rf supabase/.temp
git remote remove origin
# hooki Stop kopii (tsc + przypomnienie o bledach; dzialaja tylko w sesji glownej) -> hook testowy f3
python3 - "$SP" <<'P'
import json, sys
sp = sys.argv[1]
s = json.load(open('.claude/settings.json'))
s['hooks'] = {'Stop': [{'hooks': [{'type': 'command', 'command': 'python3 -c "import sys,json,time; d=sys.stdin.read(); open(\'%s/mr/stop-hook.jsonl\',\'a\').write(json.dumps({\'t\': time.time(), \'wejscie\': d})+chr(10))"' % sp}]}]}
json.dump(s, open('.claude/settings.json', 'w'), indent=2, ensure_ascii=False)
P
echo "--- kontrola sanityzacji"
ls -a | grep -E '^\.env' || echo "brak .env*"
ls supabase/.temp 2>/dev/null || echo "brak supabase/.temp"
git remote -v | wc -l | xargs echo "remote:"
git status --short | head
grep -c 'MR-' -r .claude CLAUDE.md 2>/dev/null | grep -v ':0' || echo "brak ciagow MR- w .claude i CLAUDE.md"

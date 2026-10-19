"""Korpus komend Bash ze wszystkich transkryptow ~/.claude/projects (sesje i subagenci) — JSON lines, bez przycinania.
Filtr: komendy z kandydatami E1 (--show-sensitive, printenv, slowo env, set z x, bash/sh -x) albo z .env (kontrola regresji)."""
import json, os, re, sys, glob
wyj = sys.argv[1]
RX = re.compile(r'--show-sensitive|\bprintenv\b|(?:^|[\s;|&(`])env(?:\s|$|;|\|)|\bset\s+-[A-Za-z]*x|\bset\s+-o\s+xtrace|\b(?:ba)?sh\s+-[A-Za-z]*x|\.env')
widziane = set()
n = 0
with open(wyj, 'w') as out:
    for plik in glob.iglob(os.path.expanduser('~/.claude/projects/**/*.jsonl'), recursive=True):
        try:
            f = open(plik, errors='replace')
        except OSError:
            continue
        for linia in f:
            if '"Bash"' not in linia:
                continue
            try:
                d = json.loads(linia)
            except ValueError:
                continue
            tresc = (d.get('message') or {}).get('content')
            if not isinstance(tresc, list):
                continue
            for b in tresc:
                if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'Bash':
                    k = (b.get('input') or {}).get('command')
                    if isinstance(k, str) and RX.search(k) and k not in widziane:
                        widziane.add(k)
                        out.write(json.dumps({'komenda': k, 'plik': plik}, ensure_ascii=False) + '\n')
                        n += 1
print('komend:', n)

#!/usr/bin/env python3
"""Pomiar 4: inter-run agreement review. Z promptow scribe'ow (Findings JSON po verify) grupuje te same (zadanie, faza)
z roznych runow i liczy, ile findingow powtorki to te same co wczesniej (ten sam plik + podobny opis), a ile nowe."""
import csv, glob, os, json, re, collections, difflib, sys
S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
ROOT = os.path.expanduser('~/.claude/projects')
dec = json.JSONDecoder()
rows = [r for r in csv.DictReader(open(S + 'agents.csv')) if r['rola'] == 'scribe']
def prompt_of(r):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    if not jfs: return None
    for line in open(jfs[0], errors='ignore'):
        try: o = json.loads(line)
        except Exception: continue
        if o.get('type') == 'user':
            c = (o.get('message') or {}).get('content')
            return c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    return None
def findings(txt):
    i = txt.find('Findings (JSON)'); j = txt.find('[', i)
    if i < 0 or j < 0: return []
    try: v, _ = dec.raw_decode(txt[j:]); return [f for f in v if isinstance(f, dict)]
    except Exception: return []
grupy = collections.defaultdict(list)
for r in rows:
    t = prompt_of(r)
    if not t: continue
    m = re.search(r'scribe review fazy (\S+) w docs/active/([\w.-]+)', t)
    if not m: continue
    grupy[(r['projekt'], m.group(2), m.group(1))].append({'run': r['run'], 'start': r['start'], 'findings': findings(t)})
def klucz_plik(p): return re.sub(r':\d+$', '', str(p or ''))
def podobne(a, b):
    if klucz_plik(a.get('plik')) != klucz_plik(b.get('plik')): return False
    return difflib.SequenceMatcher(None, str(a.get('opis', ''))[:400].lower(), str(b.get('opis', ''))[:400].lower()).ratio() > 0.45
wyn = []
print('zadanie | faza | runy | findingi per run | w powtorce: te same / nowe (P1/P2/P3 nowych) | nowe-realne? (typ KOD/TEST)')
for (proj, zad, faza), lst in sorted(grupy.items()):
    if len(lst) < 2: continue
    lst.sort(key=lambda x: x['start'])
    widziane = list(lst[0]['findings'])
    opis = [f"{proj}/{zad} f{faza}", str(len(lst)), '/'.join(str(len(x['findings'])) for x in lst)]
    detale = []
    for x in lst[1:]:
        same = [f for f in x['findings'] if any(podobne(f, w) for w in widziane)]
        nowe = [f for f in x['findings'] if f not in same]
        sev = collections.Counter((f.get('severity') or '?').upper() for f in nowe)
        typ = collections.Counter(f.get('typ') for f in nowe)
        detale.append(f"{len(same)} te same / {len(nowe)} nowe (P1 {sev['P1']}, P2 {sev['P2']}, P3 {sev['P3']}; typ {dict(typ)})")
        widziane += nowe
        wyn.append({'projekt': proj, 'zadanie': zad, 'faza': faza, 'run': x['run'], 'start': x['start'], 'n': len(x['findings']), 'te_same': len(same), 'nowe': len(nowe),
                    'nowe_sev': dict(sev), 'nowe_typ': dict(typ), 'nowe_lista': [{'sev': f.get('severity'), 'typ': f.get('typ'), 'plik': f.get('plik'), 'opis': str(f.get('opis', ''))[:160]} for f in nowe]})
    print(' | '.join(opis), '|', ' ; '.join(detale))
json.dump(wyn, open(S + 'pomiar4-powtorki-review.json', 'w'), ensure_ascii=False, indent=1)
print('n grup z >=2 runami:', sum(1 for l in grupy.values() if len(l) >= 2), '-> dane/pomiar4-powtorki-review.json')

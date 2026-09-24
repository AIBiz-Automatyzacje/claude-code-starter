#!/usr/bin/env python3
"""Prompt-audit (HANDOFF 6a pkt 24): liczba wywolan narzedzi i model per rola z plikow harnessu
(~/.claude/projects/<slug>/<sesja>/workflows/<run>.json, pole workflowProgress -> wpisy type=workflow_agent).
Po co: (1) ktore role mechaniczne robia wiele wywolan przy zadaniu deterministycznym (PA-15),
(2) na jakim modelu jechaly dotychczasowe runy (proweniencja: prompty stroje na Opus 5, nie 5.5),
(3) czy pole effort w ogole trafia do pliku harnessu (PA-22/PA-23).
Uzycie: pa_wywolania.py -> dane/pa-wywolania-rol.txt"""
import collections, glob, json, os, re, statistics

OUT = os.path.dirname(os.path.abspath(__file__)) + '/../dane/pa-wywolania-rol.txt'
PLIKI = glob.glob(os.path.expanduser('~/.claude/projects/*/*/workflows/*.json'))


def agenci(o):
    if isinstance(o, dict):
        if o.get('type') == 'workflow_agent':
            yield o
        for v in o.values():
            yield from agenci(v)
    elif isinstance(o, list):
        for v in o:
            yield from agenci(v)


def rola(label):
    lab = re.sub(r'(faza-)?\d+$', '', label or '?')
    lab = re.split(r':(?=[^:]*[/.])', lab)[0]          # verify:<plik> -> verify
    lab = re.sub(r':(tura|IU|unit)-?.*$', r':\1', lab)  # pr:napraw:tura-2 -> pr:napraw:tura
    return lab.rstrip(':-')


dane = collections.defaultdict(list)
efekt = collections.Counter()
plikow = 0
for p in PLIKI:
    try:
        d = json.load(open(p))
    except (OSError, json.JSONDecodeError):
        continue
    plikow += 1
    for a in agenci(d):
        model = re.sub(r'-\d{8}$', '', (a.get('model') or '?').replace('[1m]', ''))
        try:
            dane[(rola(a.get('label')), model)].append((int(a.get('toolCalls') or 0), int(a.get('tokens') or 0)))
        except (TypeError, ValueError):
            continue
        efekt['z polem effort' if 'effort' in a else 'bez pola effort'] += 1

o = [f'# pa_wywolania.py — plikow harnessu: {plikow}, agentow: {sum(len(v) for v in dane.values())}',
     f'# pole effort we wpisach agentow: {dict(efekt)}', '',
     '## role z n>=5, malejaco po medianie wywolan narzedzi',
     'mediana_wywolan  max  n  mediana_tokenow  rola  model']
wiersze = []
for (r, m), v in dane.items():
    if len(v) < 5:
        continue
    wiersze.append((statistics.median(x[0] for x in v), max(x[0] for x in v), len(v), statistics.median(x[1] for x in v), r, m))
for med, mx, n, tok, r, m in sorted(wiersze, reverse=True):
    o.append(f'{med:6.0f} {mx:5d} {n:5d} {tok:9.0f}  {r}  {m}')
o += ['', '## buildery i reviewerzy: liczba agentow per model (proweniencja strojenia promptow)']
licz = collections.Counter()
for (r, m), v in dane.items():
    if r.startswith(('build', 'review:', 'fix', 'scribe')):
        licz[(r.split(':')[0], m)] += len(v)
for (r, m), n in sorted(licz.items()):
    o.append(f'{n:5d}  {r}  {m}')
open(OUT, 'w').write('\n'.join(o) + '\n')
print('\n'.join(o[:3]))

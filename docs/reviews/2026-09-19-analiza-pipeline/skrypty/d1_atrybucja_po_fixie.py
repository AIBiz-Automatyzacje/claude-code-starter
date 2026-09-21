#!/usr/bin/env python3
"""D1 (etap 3 -> panel): atrybucja NOWYCH findingow powtorki review po fixie.
Dla par runow z pomiaru 4, gdzie kod zmienil sie miedzy runami, kazdy nowy finding run2 dostaje klase:
  A = linia findingu powstala w commicie fixa (git blame na HEAD sprzed run2 wskazuje commit z okna miedzy runami)
  B = linia istniala przed fixem, ale plik byl dotkniety fixem (przeoczone w rundzie 1 w pliku, ktory fix zmienil)
  C = kod nietkniety fixem (przeoczone w rundzie 1)
  X = brak numeru linii / plik nie istnieje / poza kodem (docs, CLAUDE.md) — do reki
Wyjscie: dane/pomiar5-atrybucja-po-fixie.json + wydruk.
Uzycie: d1_atrybucja_po_fixie.py <repo_oferty_online>"""
import csv, collections, difflib, glob, json, os, re, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
ROOT = os.path.expanduser('~/.claude/projects')
REPO = sys.argv[1]
PARY = [  # (zadanie-prefix, faza, run1, run2)
    ('faza-9b-wielu-uzytkownikow', '4', 'wf_cf90b5d6-f83', 'wf_29d462f8-85c'),
    ('samodzielna-rejestracja-czlonkow-aa', '3', 'wf_8eefb073-6a9', 'wf_ce87b73b-89f'),
]
dec = json.JSONDecoder()
rows = {(r['run'], r['opis']): r for r in csv.DictReader(open(S + 'agents.csv')) if r['rola'] == 'scribe'}

def prompt_of(r):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    if not jfs:
        return None
    for line in open(jfs[0], errors='ignore'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        if o.get('type') == 'user':
            c = (o.get('message') or {}).get('content')
            return c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    return None

def findings(txt):
    i = txt.find('Findings (JSON)'); j = txt.find('[', i)
    if i < 0 or j < 0:
        return []
    try:
        v, _ = dec.raw_decode(txt[j:]); return [f for f in v if isinstance(f, dict)]
    except Exception:
        return []

def git(*a):
    return subprocess.run(['git', '-C', REPO] + list(a), capture_output=True, text=True).stdout

def plik_linia(p):
    m = re.match(r'^(.*?):(\d+)', str(p or ''))
    return (m.group(1), int(m.group(2))) if m else (re.sub(r':\d+$', '', str(p or '')), None)

def podobne(a, b):
    if plik_linia(a.get('plik'))[0] != plik_linia(b.get('plik'))[0]:
        return False
    return difflib.SequenceMatcher(None, str(a.get('opis', ''))[:400].lower(), str(b.get('opis', ''))[:400].lower()).ratio() > 0.45

wynik = []
for zad, faza, run1, run2 in PARY:
    r1 = rows[(run1, f'scribe:faza-{faza}')]; r2 = rows[(run2, f'scribe:faza-{faza}')]
    f1 = findings(prompt_of(r1)); f2 = findings(prompt_of(r2))
    t1, t2 = r1['start'], r2['start']
    # commity w oknie miedzy startami scribe'ow (wszystkie galezie), bez docs/.claude
    log = git('log', '--reflog', '--format=%H %s', f'--since={t1}', f'--until={t2}').strip().splitlines()
    commity = {l.split()[0]: l.split(' ', 1)[1] for l in log if l}
    zmienione = set()
    for sha in commity:
        for p in git('show', '--name-only', '--format=', sha).split():
            if not p.startswith(('docs/', '.claude/')):
                zmienione.add(p)
    head2 = (list(commity)[0] if commity else git('log', '--reflog', '--format=%H', '-1', f'--until={t2}').strip())
    nowe = [f for f in f2 if not any(podobne(f, w) for w in f1)]
    print(f"\n=== {zad} f{faza}: run1 {run1} ({t1[:16]}) -> run2 {run2} ({t2[:16]}); commitow w oknie {len(commity)}, plikow kodu {len(zmienione)}, HEAD2 {head2[:7]}; nowych {len(nowe)}/{len(f2)}")
    for sha, msg in commity.items():
        print(f"   commit {sha[:7]} {msg[:90]}")
    for f in nowe:
        plik, linia = plik_linia(f.get('plik'))
        klasa, blame_sha, blame_msg = 'X', None, None
        if linia and plik and not plik.startswith(('docs/', 'CLAUDE.md')):
            bl = git('blame', '-L', f'{linia},{linia}', '--porcelain', head2, '--', plik)
            if bl:
                blame_sha = bl.split()[0]
                blame_msg = git('log', '--format=%s %ad', '--date=short', '-1', blame_sha).strip()
                if blame_sha in commity:
                    klasa = 'A'
                elif plik in zmienione:
                    klasa = 'B'
                else:
                    klasa = 'C'
        elif plik and not linia:
            klasa = 'B' if plik in zmienione else 'C'
            klasa += '?'  # bez linii — do reki
        rec = {'zadanie': zad, 'faza': faza, 'sev': f.get('severity'), 'typ': f.get('typ'), 'os': f.get('os') or f.get('reviewer'),
               'plik': f.get('plik'), 'klasa': klasa, 'blame': (blame_sha or '')[:7], 'blame_commit': blame_msg,
               'plik_w_fixie': plik in zmienione, 'opis': str(f.get('opis', ''))[:300]}
        wynik.append(rec)
        print(f"  [{klasa}] {rec['sev']} {rec['plik']} | blame {rec['blame']} ({(blame_msg or '')[:50]}) | {rec['opis'][:110]}")
    c = collections.Counter(w['klasa'] for w in wynik if w['zadanie'] == zad)
    print('  KLASY:', dict(c))
json.dump(wynik, open(S + 'pomiar5-atrybucja-po-fixie.json', 'w'), ensure_ascii=False, indent=1)
print('\nRAZEM:', dict(collections.Counter(w['klasa'] for w in wynik)), '->', S + 'pomiar5-atrybucja-po-fixie.json')

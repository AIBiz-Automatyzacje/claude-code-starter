#!/usr/bin/env python3
"""Ponowny prompt-audit (P16): stan pozycji PA-01…PA-44 i 62 hunkow z pierwszego audytu na biezacym repo.

(1) Kazdy cytat z pola „Cytat:” raportu PROMPT-AUDIT.md: czy nadal jest w pliku z „Lokalizacja:” albo gdziekolwiek w .claude/
    (porownanie po normalizacji bialych znakow, cudzyslowow i ucieczek z JS). Pozycje bez pola „Cytat:” (flagi i niskie,
    zapis w jednym akapicie) -> „do oceny w sesji” z cytatami z akapitu, jesli sa.
(2) Kazdy hunk dane/pa-proponowany.diff: ile usuwanych linii (>= 25 zn) nadal stoi w pliku docelowym i ile dodawanych
    linii hunku jest w pliku (hunk naniesiony jako lata) — hunki wchodzily tez jako tresc (PLAN-POPRAWY §1), wiec
    „0 dodanych” nie znaczy „nie naniesiony”; znaczy to tylko, ze rozstrzyga stara tresc.
Uzycie: pa2_status.py <repo> -> dane/pa2-status.txt"""
import os, re, sys

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
K = os.path.dirname(os.path.abspath(__file__)) + '/..'
raport = open(f'{K}/PROMPT-AUDIT.md', encoding='utf-8').read()
diff = open(f'{K}/dane/pa-proponowany.diff', encoding='utf-8').read()


def norm(t):
    t = t.replace('\\`', '`').replace('\\n', ' ').replace('„', '"').replace('”', '"').replace('“', '"').replace('’', "'")
    return re.sub(r'\s+', ' ', t).strip().lower()


def czytaj(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except (IsADirectoryError, FileNotFoundError):
        return ''


CALOSC = {}
for root, dirs, fs in os.walk(os.path.join(REPO, '.claude')):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '__tests__')]
    for f in fs:
        if f.endswith(('.md', '.js', '.mjs', '.sh', '.yaml', '.ts')):
            p = os.path.join(root, f)
            CALOSC[os.path.relpath(p, REPO)] = norm(czytaj(p))


def plik_repo(s):
    s = re.sub(r'^\./', '', s.strip('`').split(':')[0])
    for kand in (s, '.claude/' + s, '.claude/skills/' + s, '.claude/agents/' + s, '.claude/workflows/' + s):
        if os.path.isfile(os.path.join(REPO, kand)):
            return kand
    return None


def cytaty(tekst):
    # „…” w polu Cytat; dlugie cytaty dzielone na zdania-fragmenty (>= 20 zn), bo raport skracal je wielokropkiem
    wynik = []
    for c in re.findall(r'„([^”]+)”', tekst):
        for frag in re.split(r'…|\.\.\.', c):
            frag = frag.strip(' .;:')
            if len(frag) >= 20:
                wynik.append(frag)
    return wynik


o = ['# Ponowny prompt-audit (P16): stan pozycji PA z PROMPT-AUDIT.md na biezacym repo (pa2_status.py)', f'repo: {REPO}', '',
     '## (1) pozycje PA — cytaty', 'format: PA | status | cytaty nadal obecne / wszystkie | gdzie (pierwszy plik z trafieniem)', '']
bloki = re.split(r'\n\*\*(PA-\d\d) — ', raport)
status_pa = {}
for i in range(1, len(bloki), 2):
    pid, tresc = bloki[i], bloki[i + 1].split('\n**PA-')[0].split('\n## ')[0]
    pole = re.search(r'- Cytat: (.*)', tresc)
    cyt = cytaty(pole.group(1) if pole else tresc)
    lok = re.search(r'Lokalizacja: (.*)', tresc)
    pliki = [p for p in (plik_repo(x) for x in re.findall(r'`([^`]+\.(?:md|js|mjs|sh|yaml))(?::[\d\-,]+)?`', lok.group(1) if lok else tresc)) if p]
    obecne, gdzie = 0, []
    for c in cyt:
        n = norm(c)
        traf = [p for p in pliki if n in CALOSC.get(p, '')] or [p for p, t in CALOSC.items() if n in t]
        if traf:
            obecne += 1
            gdzie.append(traf[0])
    if not cyt:
        st = 'BEZ CYTATU — ocena w sesji'
    elif obecne == 0:
        st = 'ZAMKNIETE (zaden cytat nie wystepuje)'
    elif obecne == len(cyt):
        st = 'OTWARTE (wszystkie cytaty nadal sa)'
    else:
        st = 'CZESCIOWO'
    status_pa[pid] = st
    tytul = tresc.split('\n')[0].strip('*').strip()[:70]
    o.append(f'{pid} | {st} | {obecne}/{len(cyt)} | {", ".join(sorted(set(gdzie)))[:120]} | {tytul}')
licz = {}
for st in status_pa.values():
    k = st.split(' ')[0]
    licz[k] = licz.get(k, 0) + 1
o += ['', 'razem: ' + ', '.join(f'{k} {v}' for k, v in sorted(licz.items())) + f' (pozycji {len(status_pa)})', '']

o += ['## (2) hunki pa-proponowany.diff — stara tresc vs nowa', 'format: H<nn> | plik | usuwane linie nadal w pliku / wszystkie | dodane w pliku / wszystkie', '']
nr, plik, stary_licz = 0, None, {'stara-zostala': 0, 'stara-zniknela': 0, 'bez-usuwanych': 0}
for blok in re.split(r'\n(?=diff --git |@@ )', diff):
    m = re.match(r'diff --git a/(\S+)', blok)
    if m:
        plik = m.group(1)
        continue
    if not blok.startswith('@@'):
        continue
    nr += 1
    tekst = norm(czytaj(os.path.join(REPO, plik))) if plik else ''
    minus = [l[1:] for l in blok.split('\n')[1:] if l.startswith('-') and len(l.strip()) >= 25]
    plus = [l[1:] for l in blok.split('\n')[1:] if l.startswith('+') and len(l.strip()) >= 25]
    m_ob = sum(1 for l in minus if norm(l) in tekst)
    p_ob = sum(1 for l in plus if norm(l) in tekst)
    if not minus:
        stary_licz['bez-usuwanych'] += 1
    elif m_ob:
        stary_licz['stara-zostala'] += 1
    else:
        stary_licz['stara-zniknela'] += 1
    znacznik = '  <- STARA TRESC NADAL' if m_ob else ''
    o.append(f'H{nr:02d} | {plik} | {m_ob}/{len(minus)} | {p_ob}/{len(plus)}{znacznik}')
o += ['', f'hunkow: {nr}; ' + ', '.join(f'{k} {v}' for k, v in stary_licz.items())]
open(f'{K}/dane/pa2-status.txt', 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('\n'.join(o[-1:]), '|', o[o.index('## (2) hunki pa-proponowany.diff — stara tresc vs nowa') - 2])

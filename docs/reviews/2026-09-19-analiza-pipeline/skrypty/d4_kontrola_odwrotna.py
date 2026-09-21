#!/usr/bin/env python3
"""Kontrola odwrotna pakietu wejsciowego panelu (D4): zrodla -> PANEL-WEJSCIE.md.
Dla kazdej jednostki tekstu (bullet / wiersz tabeli / punkt numerowany, z doklejonymi liniami kontynuacji)
w dokumentach zrodlowych, ktora niesie marker decyzji lub wejscia do panelu, liczy najlepsze pokrycie
terminami w jednostkach pakietu (recall terminow jednostki zrodlowej w oknie 1-2 sasiednich jednostek pakietu).
Wynik: lista jednostek posortowana rosnaco po pokryciu; niskie pokrycie = kandydat na luke (do recznego przegladu).
Uzycie: python3 d4_kontrola_odwrotna.py <katalog analizy> > dane/d4-kontrola-odwrotna.txt
"""
import os, re, sys

BASE = sys.argv[1] if len(sys.argv) > 1 else '.'
PAKIET = os.path.join(BASE, 'PANEL-WEJSCIE.md')

# (plik, zakres linii lub None = calosc, opis)
ZRODLA = [
    ('HANDOFF.md', ('## 5.', '## 6.'), 'HANDOFF §5 hipotezy'),
    ('HANDOFF.md', ('## 6a.', '## 7.'), 'HANDOFF §6a decyzje operatora'),
    ('ETAP1-ROZSTRZYGNIECIE.md', None, 'ETAP1'),
    ('ETAP1B-ROZSTRZYGNIECIE.md', None, 'ETAP1B'),
    ('ETAP2-ROZSTRZYGNIECIE.md', None, 'ETAP2'),
    ('POMIARY-ROZSTRZYGNIECIE.md', None, 'POMIARY'),
    ('ETAP3-ROZSTRZYGNIECIE.md', None, 'ETAP3'),
    ('../2026-09-19-przeglad-runow-po-naprawie.md', ('## 7.', '## Decyzje'), 'PRZEGLAD RUNOW §7 rekomendacje'),
    ('../2026-09-19-przeglad-runow-po-naprawie.md', ('## Decyzje', None), 'PRZEGLAD RUNOW decyzje operatora'),
]

MARKERY = re.compile(
    r'do panelu|twarde wejsci|twarde wymog|decyzj|obowiazuj|nieaktualn|zostaw|zastap|zostaje|wymog|przyjet|odrzucon|'
    r'warunek odwrotu|lista zmian|rozstrzyg|operator|wejscie do panelu|wejscia do panelu|do etapu 4|w etapie 4|panel |'
    r'rekomendacj|do wdrozenia|skasowac|usunac|nie scalac|precedens|dodac|wprowadzic|zmienic|przepisac',
    re.I)

STOP = set('''jako oraz przez tylko dla jest nie sie tego tym tej ten ale albo czy juz przy bez tak jak gdy ktore ktory ktora
ktorych ktorego moze byc byl byla bylo tego temu wiec wiecej mniej dzis dzisiaj nasz nasze naszej naszym jego jej ich nas nam
tego zeby aby lub oraz czyli tzn np itd jest sa ma maja tez takze tutaj tam gdzie kiedy potem przed nad pod miedzy wobec
ktora jeden jedna jedno dwa trzy cztery piec razem wszystkie kazdy kazda kazde tego tych zaden zadna zadne tego bardzo'''.split())

def norm(s):
    s = s.lower()
    s = s.replace('ą', 'a').replace('ć', 'c').replace('ę', 'e').replace('ł', 'l').replace('ń', 'n').replace('ó', 'o').replace('ś', 's').replace('ź', 'z').replace('ż', 'z')
    return s

def tokeny(s):
    s = norm(s)
    toks = re.findall(r'[a-z0-9_@:./\-]+', s)
    out = set()
    for t in toks:
        t = t.strip('.:/-')
        if not t: continue
        if t in STOP: continue
        if len(t) < 4 and not re.search(r'\d', t): continue
        out.add(t)
    return out

def jednostki(lines):
    """Sklej linie w jednostki: nowa jednostka zaczyna sie od bulletu, wiersza tabeli, numeru, naglowka lub linii bez wciecia po pustej."""
    units = []
    cur = None; cur_ln = None
    def flush():
        nonlocal cur, cur_ln
        if cur and cur.strip(): units.append((cur_ln, cur.strip()))
        cur = None; cur_ln = None
    for i, raw in enumerate(lines, 1):
        line = raw.rstrip('\n')
        if not line.strip():
            flush(); continue
        start = re.match(r'^(\s*[-*] |\s*\d+\. |\| |#|\*\*)', line) is not None
        if start or cur is None:
            flush(); cur = line; cur_ln = i
        else:
            cur += ' ' + line.strip()
    flush()
    return units

def wytnij(lines, zakres):
    if not zakres: return list(enumerate(lines, 1))
    a, b = zakres
    out = []; on = False
    for i, l in enumerate(lines, 1):
        if l.startswith(a): on = True
        elif b and l.startswith(b) and on: break
        if on: out.append((i, l))
    return out

pak_lines = open(PAKIET, encoding='utf-8').read().split('\n')
pak_units = jednostki(pak_lines)
pak_tok = [(ln, tokeny(u), u) for ln, u in pak_units]
# okna 1 i 2 sasiednich jednostek
okna = []
for i, (ln, t, u) in enumerate(pak_tok):
    okna.append((ln, t))
    if i + 1 < len(pak_tok):
        okna.append((ln, t | pak_tok[i + 1][1]))

wyniki = []
for plik, zakres, opis in ZRODLA:
    p = os.path.join(BASE, plik)
    lines = open(p, encoding='utf-8').read().split('\n')
    sel = wytnij(lines, zakres)
    if not sel: continue
    offset = sel[0][0]
    units = jednostki([l for _, l in sel])
    for ln, u in units:
        if u.startswith('#'): continue
        if not MARKERY.search(norm(u)): continue
        t = tokeny(u)
        if len(t) < 6: continue
        best = (0.0, None)
        for pln, pt in okna:
            s = len(t & pt) / len(t)
            if s > best[0]: best = (s, pln)
        wyniki.append((best[0], opis, ln + offset - 1, best[1], u))

wyniki.sort(key=lambda x: x[0])
print(f'# Kontrola odwrotna D4 — jednostek z markerem: {len(wyniki)}; pakiet: {len(pak_units)} jednostek')
print('# pokrycie = udzial terminow jednostki zrodlowej obecnych w najlepszym oknie pakietu (1-2 jednostki). <0.30 = przejrzec recznie.')
progi = [(0.3, 'NISKIE (<0.30) — KANDYDACI NA LUKE'), (0.5, 'SREDNIE (0.30-0.49) — sprawdzic wyrywkowo'), (2, 'WYSOKIE (>=0.50)')]
lo = 0
for hi, tytul in progi:
    grp = [w for w in wyniki if lo <= w[0] < hi]
    print(f'\n## {tytul}: {len(grp)}')
    for s, opis, ln, pln, u in grp:
        skrot = u if len(u) <= 420 else u[:420] + '…'
        print(f'[{s:.2f}] {opis}:{ln} -> pakiet:{pln}\n    {skrot}')
    lo = hi

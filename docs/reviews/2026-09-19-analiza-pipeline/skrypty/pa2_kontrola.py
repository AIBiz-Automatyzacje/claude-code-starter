#!/usr/bin/env python3
"""Ponowny prompt-audit (P16): kontrola w obie strony PROMPT-AUDIT-2.md <-> repo <-> dane/pa2-proponowany.diff.

(1) raport -> zrodla: kazdy cytat „…” z pola „Cytat:” wystepuje w ktoryms pliku z pola „Lokalizacja:” na commicie BAZA (stan audytowany);
(2) raport -> diff: kazdy plik z „Lokalizacja:” ustalenia wysokiej i sredniej pewnosci (poza plikami wskazanymi tylko jako kontekst sprzecznosci)
    ma hunk w diffie;
(3) diff -> raport: kazdy plik diffu nalezy do co najmniej jednego ustalenia;
(4) liczby: ustalenia PA2-01…06 w sekcji wysokiej, PA2-07…23 w sredniej, pliki i hunki diffu.
Uzycie: pa2_kontrola.py <repo> -> dane/pa2-kontrola.txt (kod 1 przy bledach)"""
import os, re, subprocess, sys

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
K = os.path.dirname(os.path.abspath(__file__)) + '/..'
BAZA = '18ab718'
raport = open(f'{K}/PROMPT-AUDIT-2.md', encoding='utf-8').read()
diff = open(f'{K}/dane/pa2-proponowany.diff', encoding='utf-8').read()
# Pliki wskazane tylko jako druga strona sprzecznosci (bez zmiany w diffie).
KONTEKST = {'.claude/agents/correctness-reviewer.md'}


def norm(t):
    t = t.replace('\\`', '`').replace('„', '"').replace('”', '"').replace('\\\\', '\\')
    return re.sub(r'\s+', ' ', t).strip()


def na_bazie(sciezka):
    r = subprocess.run(['git', '-C', REPO, 'show', f'{BAZA}:{sciezka}'], capture_output=True, text=True)
    return norm(r.stdout) if r.returncode == 0 else None


def sciezki(lok):
    wynik, katalog = [], ''
    for s in re.findall(r'`([^`]+)`', lok):
        s = s.split(':')[0]
        if s.startswith('.claude/'):
            katalog = os.path.dirname(s)
            wynik.append(s)
        elif re.fullmatch(r'[\w.-]+\.(md|js|sh)', s) and katalog:
            wynik.append(f'{katalog}/{s}')
    return wynik


o, bledy = [], 0
sekcja_wys = raport.split('## 3.')[1].split('## 4.')[0]
sekcja_sr = raport.split('## 4.')[1].split('## 5.')[0]
ustalenia = {}
for nazwa, tekst in (('wysoka', sekcja_wys), ('srednia', sekcja_sr)):
    for m in re.finditer(r'\*\*(PA2-\d\d) — (.*?)\n(?=\*\*PA2-|\Z)', tekst, re.S):
        ustalenia[m.group(1)] = (nazwa, m.group(2))
wys = sorted(k for k, v in ustalenia.items() if v[0] == 'wysoka')
sr = sorted(k for k, v in ustalenia.items() if v[0] == 'srednia')
o.append(f'(4) ustalenia: wysoka {len(wys)} ({wys[0]}…{wys[-1]}), srednia {len(sr)} ({sr[0]}…{sr[-1]})')
if wys != [f'PA2-{i:02d}' for i in range(1, 7)] or sr != [f'PA2-{i:02d}' for i in range(7, 24)]:
    bledy += 1
    o.append('  BLAD: numeracja ustalen niezgodna z 6 + 17')

pliki_diffu = sorted(set(re.findall(r'^diff --git a/(\S+)', diff, re.M)))
hunki = len(re.findall(r'^@@', diff, re.M))
o.append(f'    diff: plikow {len(pliki_diffu)}, hunkow {hunki}')

o += ['', '(1) raport -> zrodla (cytaty na commicie %s)' % BAZA]
pliki_raportu = set()
for pid, (_, tekst) in sorted(ustalenia.items()):
    lok = re.search(r'Lokalizacja: (.*)', tekst)
    pl = sciezki(lok.group(1)) if lok else []
    pliki_raportu.update(pl)
    cyt = re.search(r'Cytat: (.*)', tekst)
    if not cyt:
        o.append(f'  {pid}: bez pola Cytat (odsylacz do innego ustalenia)')
        continue
    teksty = {p: na_bazie(p) for p in pl}
    for c in re.findall(r'„(.+?)”', cyt.group(1)):
        ok = any(t and norm(c) in t for t in teksty.values())
        bledy += not ok
        o.append(f'  {pid}: {"OK " if ok else "BRAK"} „{c[:70]}”')

o += ['', '(2) raport -> diff (pliki ustalen bez hunka)']
brak = sorted(p for p in pliki_raportu - KONTEKST if p not in pliki_diffu)
bledy += len(brak)
o += [f'  BRAK hunka: {p}' for p in brak] or ['  (brak)']

o += ['', '(3) diff -> raport (pliki diffu bez ustalenia)']
sieroty = sorted(p for p in pliki_diffu if p not in pliki_raportu)
bledy += len(sieroty)
o += [f'  BEZ USTALENIA: {p}' for p in sieroty] or ['  (brak)']

o.insert(0, f'# Kontrola PROMPT-AUDIT-2 w obie strony (pa2_kontrola.py) — bledow: {bledy}')
open(f'{K}/dane/pa2-kontrola.txt', 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('\n'.join(o))
sys.exit(1 if bledy else 0)

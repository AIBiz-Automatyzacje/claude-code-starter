#!/usr/bin/env python3
"""E5-14: czy rozmiar IU z tabeli planu przewiduje tury i kontekst buildera (propozycja progu w dev-plan 3.3).

Wejscie:
  - telemetria ~/.claude/telemetry/pipeline.jsonl (tylko odczyt): rekordy `agent` z rola `build`, projekt vibersi,
    etykieta `build:IU-<n>`; IU z kilkoma probami (proba > 1) — tury i koszt sumowane, ctx_max = maksimum prob;
  - plany zadan vibersi docs/plans/*-feat-<zadanie>-plan.md: sekcja `**IU-<n>: …**`, tabela pod `**Pliki:**`
    (Akcja | Plik | Linie dzis → po | …) i liczba punktow `- [` w `**Scenariusze testowe:**`.
Miary IU: pliki (wiersze tabeli), pliki_nowe (Akcja „Stwórz”), linie_plan (suma „po − dzis” tam, gdzie obie liczby
sa podane; „—” = brak), scenariusze. Korelacja Spearmana (rangi ze srednia przy remisach) z turami, ctx_max i kosztem.

Uzycie: python3 e5_14_tury_iu.py --repo ../../../../../vibersi [--zadania etap-3-konto-i-auth,...] > ../dane/e5-14-tury-iu.txt
"""
import argparse
import glob
import json
import os
import re
import statistics
from collections import defaultdict

ZADANIA = ['etap-3-konto-i-auth', 'etap-4-dodawanie-i-moderacja', 'etap-5-interakcje-i-profil']
IU = re.compile(r'^- \[[ x]\] \*\*(IU-\d+):')
LINIE = re.compile(r'^\s*(\d+|—)\s*→\s*(\d+|—)\s*$')


def agenci_build(zadania):
    plik = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
    ostatnie = {}
    for linia in open(plik, encoding='utf8'):
        try:
            r = json.loads(linia)
        except json.JSONDecodeError:
            continue
        if isinstance(r.get('klucz'), str):
            ostatnie[r['klucz']] = r
    wynik = defaultdict(list)
    for r in ostatnie.values():
        if r.get('typ') == 'agent' and r.get('projekt') == 'vibersi' and r.get('rola') == 'build' and r.get('zadanie') in zadania:
            m = re.match(r'build:(IU-\d+)$', r.get('etykieta') or '')
            if m:
                wynik[(r['zadanie'], m.group(1))].append(r)
    return wynik


def iu_planu(sciezka):
    wynik = {}
    biezace = None
    sekcja = None
    for l in open(sciezka, encoding='utf8'):
        m = IU.match(l)
        if m:
            biezace = wynik.setdefault(m.group(1), {'pliki': 0, 'pliki_nowe': 0, 'linie_plan': 0, 'linie_brak': 0, 'scenariusze': 0})
            sekcja = None
            continue
        if biezace is None:
            continue
        if l.startswith('**'):
            sekcja = l.strip().strip('*').rstrip(':').strip()
            continue
        if sekcja == 'Pliki' and l.startswith('| ') and not l.startswith('| Akcja') and not l.startswith('|---'):
            pola = [p.strip() for p in l.strip().strip('|').split('|')]
            biezace['pliki'] += 1
            if pola[0].startswith('Stwórz'):
                biezace['pliki_nowe'] += 1
            ml = LINIE.match(pola[2]) if len(pola) > 2 else None
            if ml and ml.group(1) != '—' and ml.group(2) != '—':
                biezace['linie_plan'] += max(0, int(ml.group(2)) - int(ml.group(1)))
            elif ml and ml.group(1) == '—' and ml.group(2) != '—':
                biezace['linie_plan'] += int(ml.group(2))
            else:
                biezace['linie_brak'] += 1
        if sekcja == 'Scenariusze testowe' and l.startswith('- ['):
            biezace['scenariusze'] += 1
    return wynik


def rangi(x):
    porzadek = sorted(range(len(x)), key=lambda i: x[i])
    r = [0.0] * len(x)
    i = 0
    while i < len(x):
        j = i
        while j + 1 < len(x) and x[porzadek[j + 1]] == x[porzadek[i]]:
            j += 1
        for k in range(i, j + 1):
            r[porzadek[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(x, y):
    rx, ry = rangi(x), rangi(y)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    licznik = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    mianownik = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return licznik / mianownik if mianownik else float('nan')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--zadania', default=','.join(ZADANIA))
    a = ap.parse_args()
    zadania = a.zadania.split(',')
    agenci = agenci_build(set(zadania))
    wiersze = []
    for z in zadania:
        plany = glob.glob(os.path.join(a.repo, 'docs', 'plans', f'*-feat-{z}-plan.md'))
        if len(plany) != 1:
            print(f'UWAGA {z}: planow {len(plany)} — pominiete')
            continue
        for iu, miary in iu_planu(plany[0]).items():
            proby = agenci.get((z, iu), [])
            if not proby:
                print(f'UWAGA {z} {iu}: brak rekordu buildera w telemetrii — pominiete')
                continue
            wiersze.append({'zadanie': z, 'iu': iu, **miary, 'proby': len(proby),
                            'tury': sum(p.get('tury') or 0 for p in proby),
                            'ctx_max': max(p.get('ctx_max') or 0 for p in proby),
                            'koszt': sum(p.get('koszt_jedn') or 0 for p in proby),
                            'wynik': ','.join(sorted({str(p.get('wynik')) for p in proby}))})
    print(f'E5-14 — tury i kontekst builderow vs rozmiar IU z planu (vibersi, {", ".join(zadania)})')
    print(f'IU z rekordem buildera: {len(wiersze)}\n')
    print(f"{'zadanie':<30} {'IU':<6} {'pliki':>5} {'nowe':>4} {'linie':>6} {'brak':>4} {'scen':>4} {'prob':>4} {'tury':>5} {'ctx_max':>8} {'koszt M':>8} wynik")
    for w in sorted(wiersze, key=lambda w: (w['zadanie'], int(w['iu'][3:]))):
        print(f"{w['zadanie']:<30} {w['iu']:<6} {w['pliki']:>5} {w['pliki_nowe']:>4} {w['linie_plan']:>6} {w['linie_brak']:>4} "
              f"{w['scenariusze']:>4} {w['proby']:>4} {w['tury']:>5} {w['ctx_max'] // 1000:>7}k {w['koszt'] / 1e6:>8.2f} {w['wynik']}")
    print('\nKorelacja Spearmana (n = %d):' % len(wiersze))
    for miara in ('pliki', 'pliki_nowe', 'linie_plan', 'scenariusze'):
        x = [w[miara] for w in wiersze]
        print(f"  {miara:<12} tury {spearman(x, [w['tury'] for w in wiersze]):+.2f}   ctx_max {spearman(x, [w['ctx_max'] for w in wiersze]):+.2f}"
              f"   koszt {spearman(x, [w['koszt'] for w in wiersze]):+.2f}")
    print('\nTury i ctx_max wg liczby plikow IU (mediana; kubelki):')
    for nazwa, od, do in (('1–3', 1, 3), ('4–6', 4, 6), ('7–9', 7, 9), ('10+', 10, 10 ** 6)):
        g = [w for w in wiersze if od <= w['pliki'] <= do]
        if g:
            print(f"  pliki {nazwa:<5} n={len(g):<3} tury p50 {statistics.median(w['tury'] for w in g):>5.0f}   ctx_max p50 "
                  f"{statistics.median(w['ctx_max'] for w in g) / 1000:>4.0f}k   ctx_max max {max(w['ctx_max'] for w in g) / 1000:>4.0f}k"
                  f"   proba > 1: {sum(1 for w in g if w['proby'] > 1)}")
    print('\nTury i ctx_max wg scenariuszy testowych IU (mediana; kubelki):')
    for nazwa, od, do in (('1–3', 0, 3), ('4–6', 4, 6), ('7–9', 7, 9), ('10+', 10, 10 ** 6)):
        g = [w for w in wiersze if od <= w['scenariusze'] <= do]
        if g:
            print(f"  scen. {nazwa:<5} n={len(g):<3} tury p50 {statistics.median(w['tury'] for w in g):>5.0f}   ctx_max p50 "
                  f"{statistics.median(w['ctx_max'] for w in g) / 1000:>4.0f}k   ctx_max max {max(w['ctx_max'] for w in g) / 1000:>4.0f}k")


if __name__ == '__main__':
    main()

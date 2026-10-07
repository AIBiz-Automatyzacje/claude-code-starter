#!/usr/bin/env python3
"""Ślepy test P12 — sumy wyniku sędziego po fazach (razem, klucz 1/2, grupy klas D10 / pokryte / inne, pary stary–nowy z etykietą fazy)
i drzewa .claude, na których szła faza (`~/test-review/p12/<et>/claude.json`, zapis z `przygotuj`). Liczy test_review_p12_cli.py wynik."""
import json, os

from test_review_p12 import OCENY, WARIANTY_SEDZIEGO

GRUPY = (('d10', 'D10'), ('pokryte', 'pokryte'), ('inne', 'inne'))
POLA = ('razem', 'klucz1', 'klucz2')


def _pusty():
    return dict({o: 0 for o in OCENY}, brak_oceny=0)


def _dodaj(cel, zrodlo):
    for o, n in zrodlo.items(): cel[o] = cel.get(o, 0) + n


def suma_faz(sedziowie):
    """{et: wynik_sedziego} → per wariant sumy pól i grup; pary 'tylko_nowy' itd. jako '<et> K<n>'; klucze = liczba kluczy razem."""
    s = {w: {p: _pusty() for p in POLA} for w in WARIANTY_SEDZIEGO}
    for w in WARIANTY_SEDZIEGO: s[w]['grupy'] = {g: _pusty() for g, _ in GRUPY}
    s['pary'], s['klucze'] = {}, 0
    for et, sed in sedziowie.items():
        for w in WARIANTY_SEDZIEGO:
            for p in POLA: _dodaj(s[w][p], sed[w][p])
            for g, t in sed[w]['grupy'].items(): _dodaj(s[w]['grupy'].setdefault(g, _pusty()), t)
        for k, lista in sed['pary'].items(): s['pary'].setdefault(k, []).extend('%s %s' % (et, x) for x in lista)
        s['klucze'] += len(sed['klucze'])
    return s


def linia_grup(w):
    """O/Z/B per grupa klas jednego wariantu."""
    return ' | '.join('%s %s' % (n, '/'.join(str(w['grupy'].get(g, {}).get(o, 0)) for o in OCENY)) for g, n in GRUPY)


def drzewa(p12, et):
    p = os.path.join(p12, et, 'claude.json')
    if not os.path.exists(p): return 'drzewa .claude: brak zapisu'
    with open(p) as f: d = json.load(f)
    dop = '; '.join(x for x in ('gałąź przy %s' % d['nowy_commit'][:7] if d.get('nowy_commit') else '', d.get('uwaga') or '') if x)
    return 'drzewa .claude: stary %s, nowy %s%s' % (d['stary'][:7], d['nowy'][:7], ' (%s)' % dop if dop else '')
